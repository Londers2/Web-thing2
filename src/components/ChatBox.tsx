import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckIcon, FaceSmileIcon, MicrophoneIcon, PaperAirplaneIcon, PaperClipIcon, PhotoIcon, StopIcon } from '@heroicons/react/16/solid'
import { io, type Socket } from 'socket.io-client'
import { api, jsonBody } from '../api'
import { useAuth } from '../auth'
import type { Message, OrderImage } from '../types'
import { formatDate } from '../utils'
import { Button } from './catalyst/button'
import { Dialog, DialogBody, DialogTitle } from './catalyst/dialog'
import { Input } from './catalyst/input'
import { ErrorAlert, Loading } from './Loading'
import { UserAvatar } from './UserAvatar'
import { VoiceMessage } from './VoiceMessage'

const quickEmojis = ['👍', '❤️', '😂', '🎉', '😮', '😢']
const time = (value: string) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const dayKey = (value: string) => value.slice(0, 10)

export function ChatBox({ orderId, peerId, compact = false, onActivity }: { orderId?: string; peerId?: string; compact?: boolean; onActivity?: () => void }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [reactionFor, setReactionFor] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [preview, setPreview] = useState<Message | null>(null)
  const [orderImages, setOrderImages] = useState<OrderImage[]>([])
  const socketRef = useRef<Socket | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingStartRef = useRef(0)
  const activityRef = useRef(onActivity)
  activityRef.current = onActivity

  const addMessage = useCallback((message: Message) => {
    setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
    activityRef.current?.()
  }, [])

  const markRead = useCallback(async () => {
    try {
      await api('/messages/read', { method: 'POST', body: jsonBody({ orderId, peerId }) })
      socketRef.current?.emit('conversation:read', { orderId, peerId })
      window.dispatchEvent(new Event('messages:read'))
      activityRef.current?.()
    } catch {}
  }, [orderId, peerId])

  useEffect(() => {
    let active = true
    setLoading(true)
    setMessages([])
    const endpoint = orderId ? `/orders/${orderId}/messages` : `/messages/direct/${peerId}`
    api<Message[]>(endpoint).then((data) => {
      if (!active) return
      setMessages(data)
      void markRead()
    }).catch((reason) => active && setError(reason.message)).finally(() => active && setLoading(false))

    const socket = io({ withCredentials: true })
    socketRef.current = socket
    socket.on('connect', () => {
      setConnected(true)
      if (orderId) socket.emit('order:join', orderId)
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))
    socket.on('message:new', (message: Message) => {
      const matches = orderId ? message.orderId === orderId : !message.orderId && ((message.user.id === user?.id && message.recipientId === peerId) || (message.user.id === peerId && message.recipientId === user?.id))
      if (!matches) return
      addMessage(message)
      if (message.user.id !== user?.id) void markRead()
    })
    socket.on('message:reaction', ({ messageId, reactions }: { messageId: string; reactions: Message['reactions'] }) => {
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, reactions } : message))
    })
    socket.on('messages:read', ({ orderId: readOrderId, peerId: readPeerId, reader }: { orderId?: string; peerId?: string; reader: Message['user'] }) => {
      if (readOrderId !== orderId || readPeerId !== peerId) return
      setMessages((current) => current.map((message) => message.user.id === user?.id && !message.readBy.some((item) => item.id === reader.id) ? { ...message, readBy: [...message.readBy, reader] } : message))
    })
    return () => {
      active = false
      socket.disconnect()
      socketRef.current = null
    }
  }, [orderId, peerId, user?.id, markRead, addMessage])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages])
  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setRecordingTime(Math.floor((Date.now() - recordingStartRef.current) / 1000)), 500)
    return () => window.clearInterval(timer)
  }, [recording])

  function send(event: FormEvent) {
    event.preventDefault()
    const text = body.trim()
    if (!text || !socketRef.current?.connected) return
    socketRef.current.emit('message:send', { body: text, orderId, recipientId: peerId }, (response: { ok: boolean; error?: string }) => {
      if (!response.ok) setError(response.error || 'Сообщение не отправлено')
    })
    setBody('')
  }

  function toggleReaction(messageId: string, emoji: string) {
    socketRef.current?.emit('reaction:toggle', { messageId, emoji })
    setReactionFor(null)
  }

  async function uploadFile(file: File, duration?: number) {
    setUploading(true)
    setError('')
    const data = new FormData()
    data.append('file', file)
    data.append('body', body)
    if (duration) data.append('duration', String(duration))
    if (orderId) data.append('orderId', orderId)
    if (peerId) data.append('recipientId', peerId)
    try {
      const message = await api<Message>('/messages/attachments', { method: 'POST', body: data })
      addMessage(message)
      setBody('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось отправить вложение') }
    finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function openOrderImages() {
    setPickerOpen(true)
    if (!orderId) return
    const details = await api<{ images: OrderImage[] }>(`/orders/${orderId}`)
    setOrderImages(details.images)
  }

  async function chooseOrderImage(image: OrderImage) {
    const message = await api<Message>('/messages/order-image', { method: 'POST', body: jsonBody({ orderId, imageId: image.id, body }) })
    addMessage(message)
    setBody('')
    setPickerOpen(false)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const duration = Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000))
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: recorder.mimeType })
        stream.getTracks().forEach((track) => track.stop())
        void uploadFile(file, duration)
      }
      recorderRef.current = recorder
      recordingStartRef.current = Date.now()
      setRecordingTime(0)
      recorder.start()
      setRecording(true)
    } catch { setError('Не удалось получить доступ к микрофону') }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 ${compact ? 'max-h-none' : ''}`}>
        {loading ? <Loading label="Загружаем сообщения…" /> : messages.length === 0 ? <div className="flex h-full min-h-48 items-center justify-center text-center text-sm text-zinc-500">Сообщений пока нет.<br />Начните обсуждение первым.</div> : messages.map((message, index) => {
          const own = message.user.id === user?.id
          const previous = messages[index - 1]
          const showDay = index === 0 || dayKey(previous.createdAt) !== dayKey(message.createdAt)
          return (
            <Fragment key={message.id}>
              {showDay && <div className="flex items-center gap-3 py-2 text-xs text-zinc-400"><span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" /><span>{formatDate(message.createdAt, false)}</span><span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" /></div>}
              <div className={`group flex gap-2 ${own ? 'flex-row-reverse' : ''}`}>
                <UserAvatar user={message.user} className="size-8" />
                <div className={`max-w-[85%] max-sm:max-w-[78%] ${own ? 'text-right' : ''}`}>
                  {!own && <div className="mb-1 text-xs text-zinc-500">{message.user.name}</div>}
                  <div className={`relative inline-block max-w-full rounded-2xl px-3 py-2 text-left ${own ? 'rounded-tr-sm bg-zinc-900 text-white dark:bg-zinc-700' : 'rounded-tl-sm bg-zinc-100 dark:bg-zinc-800'}`}>
                    {message.attachmentUrl && message.attachmentMime?.startsWith('image/') && <button type="button" onClick={() => setPreview(message)}><img src={message.attachmentUrl} alt={message.attachmentName || 'Фото'} className="max-h-80 max-w-full rounded-lg object-cover" /></button>}
                    {message.attachmentUrl && message.attachmentMime?.startsWith('audio/') && <VoiceMessage message={message} />}
                    {message.body && <div className="whitespace-pre-wrap break-words text-sm/6">{message.body}</div>}
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60"><span>{time(message.createdAt)}</span>{own && (message.readBy.length > 0 ? <span title={orderId ? `Прочитано: ${message.readBy.length}` : 'Прочитано'} className="flex items-center"><CheckIcon className="size-3 text-blue-400" /><CheckIcon className="-ml-2 size-3 text-blue-400" /></span> : <CheckIcon className="size-3" />)}</div>
                    <button type="button" aria-label="Добавить реакцию" onClick={() => setReactionFor(reactionFor === message.id ? null : message.id)} className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white p-1.5 text-zinc-500 opacity-0 shadow ring-1 ring-zinc-950/10 group-hover:opacity-100 max-sm:opacity-100 dark:bg-zinc-700 dark:text-zinc-200 ${own ? 'max-sm:left-1 -left-9' : 'max-sm:right-1 -right-9'}`}><FaceSmileIcon className="size-4" /></button>
                    {reactionFor === message.id && <div className={`absolute top-full z-20 mt-2 flex gap-1 rounded-full bg-white p-1 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-700 dark:ring-white/10 ${own ? 'right-0' : 'left-0'} max-sm:right-0 max-sm:left-auto max-sm:max-w-[calc(100vw-3rem)] max-sm:overflow-x-auto`}>{quickEmojis.map((emoji) => <button key={emoji} type="button" className="rounded-full p-1 text-lg hover:bg-zinc-100 dark:hover:bg-zinc-600" onClick={() => toggleReaction(message.id, emoji)}>{emoji}</button>)}</div>}
                  </div>
                  {message.reactions.length > 0 && <div className={`mt-1 flex flex-wrap gap-1 ${own ? 'justify-end' : ''}`}>{message.reactions.map((reaction) => <button key={reaction.emoji} type="button" onClick={() => toggleReaction(message.id, reaction.emoji)} className={`rounded-full px-2 py-0.5 text-xs ring-1 ${reaction.reacted ? 'bg-blue-50 ring-blue-500/30 dark:bg-blue-500/20' : 'bg-zinc-100 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10'}`}>{reaction.emoji} {reaction.count}</button>)}</div>}
                </div>
              </div>
            </Fragment>
          )
        })}
        <div ref={endRef} />
      </div>
      <ErrorAlert>{error}</ErrorAlert>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadFile(e.target.files[0])} />
      <form onSubmit={send} className="mt-4 border-t border-zinc-950/10 pt-3 dark:border-white/10">
        {recording && <div className="mb-3 flex items-center gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"><span className="size-2 animate-pulse rounded-full bg-red-500" />Запись {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}<Button plain className="ml-auto" onClick={stopRecording}><StopIcon />Остановить</Button></div>}
        <div className="flex items-end gap-1 sm:gap-2">
          <Button plain type="button" aria-label="Прикрепить фото" disabled={uploading || recording} onClick={() => fileRef.current?.click()}><PaperClipIcon /></Button>
          {orderId && <Button plain type="button" aria-label="Выбрать фото из заказа" disabled={uploading || recording} onClick={() => void openOrderImages()}><PhotoIcon /></Button>}
          <Input aria-label="Сообщение" className="min-w-0 flex-1" placeholder={connected ? 'Написать сообщение…' : 'Подключение…'} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} />
          <Button plain type="button" aria-label={recording ? 'Остановить запись' : 'Записать голосовое'} disabled={uploading} onClick={recording ? stopRecording : () => void startRecording()}>{recording ? <StopIcon /> : <MicrophoneIcon />}</Button>
          <Button type="submit" disabled={!connected || !body.trim() || uploading} aria-label="Отправить"><PaperAirplaneIcon /><span className="max-sm:hidden">Отправить</span></Button>
        </div>
      </form>
      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} size="3xl" zIndex={70}><DialogTitle>Фотографии заказа</DialogTitle><DialogBody>{orderImages.length === 0 ? <p className="text-sm text-zinc-500">В заказе пока нет изображений.</p> : <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">{orderImages.map((image) => <button key={image.id} type="button" onClick={() => void chooseOrderImage(image)} className="group relative aspect-square overflow-hidden rounded-lg"><img src={`/api/orders/${orderId}/images/${image.id}`} alt={image.originalName} className="size-full object-cover transition group-hover:scale-105" /><span className="absolute inset-x-0 bottom-0 truncate bg-zinc-950/60 px-2 py-1 text-xs text-white">{image.originalName}</span></button>)}</div>}</DialogBody></Dialog>
      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} size="4xl" zIndex={80}><DialogTitle className="truncate pr-8">{preview?.attachmentName || 'Фотография'}</DialogTitle>{preview?.attachmentUrl && <img src={preview.attachmentUrl} alt={preview.attachmentName || 'Фотография'} className="mt-6 max-h-[75vh] w-full rounded-lg object-contain" />}</Dialog>
    </div>
  )
}
