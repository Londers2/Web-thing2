import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon, ChatBubbleLeftRightIcon, ClipboardDocumentListIcon, MagnifyingGlassIcon, UserIcon } from '@heroicons/react/16/solid'
import { io } from 'socket.io-client'
import { api } from '../api'
import type { Conversation } from '../types'
import { formatDateTime } from '../utils'
import { UserAvatar } from '../components/UserAvatar'
import { Badge } from '../components/catalyst/badge'
import { Button } from '../components/catalyst/button'
import { Input, InputGroup } from '../components/catalyst/input'
import { Link } from '../components/catalyst/link'
import { ChatBox } from '../components/ChatBox'
import { ErrorAlert, Loading } from '../components/Loading'

type Filter = 'all' | 'direct' | 'order'

export function ChatPage() {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  const [searchParams, setSearchParams] = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api<Conversation[]>('/conversations')
      setConversations(data)
      setSelected((current) => current ? data.find((item) => item.type === current.type && item.id === current.id) || null : current)
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить диалоги') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const socket = io({ withCredentials: true })
    socket.on('message:new', () => void load())
    return () => { socket.disconnect() }
  }, [load])

  useEffect(() => {
    const type = searchParams.get('type')
    const id = searchParams.get('id')
    if ((type === 'direct' || type === 'order') && id && conversations.length) {
      setSelected(conversations.find((item) => item.type === type && item.id === id) || null)
    }
  }, [searchParams, conversations])

  const filtered = useMemo(() => conversations.filter((conversation) => {
    const matchesFilter = filter === 'all' || conversation.type === filter
    const matchesQuery = `${conversation.title} ${conversation.subtitle}`.toLowerCase().includes(query.toLowerCase())
    return matchesFilter && matchesQuery
  }), [conversations, filter, query])

  function select(conversation: Conversation) {
    setSelected(conversation)
    setSearchParams({ type: conversation.type, id: conversation.id }, { replace: true })
  }

  function back() {
    setSelected(null)
    setSearchParams({}, { replace: true })
  }

  return (
    <>
      <ErrorAlert>{error}</ErrorAlert>
      <div className="grid h-[calc(100svh-8rem)] min-h-[520px] overflow-hidden rounded-xl border border-zinc-950/10 max-md:-m-6 max-md:h-[calc(100dvh-4rem)] max-md:min-h-0 max-md:w-full max-md:max-w-full max-md:grid-cols-[minmax(0,1fr)] max-md:rounded-none max-md:border-0 md:grid-cols-[320px_1fr] dark:border-white/10">
        <aside className={`flex min-h-0 min-w-0 flex-col border-r border-zinc-950/10 dark:border-white/10 ${selected ? 'max-md:hidden' : ''}`}>
          <div className="space-y-3 border-b border-zinc-950/10 p-3 dark:border-white/10">
            <InputGroup><MagnifyingGlassIcon /><Input aria-label="Поиск диалогов" placeholder="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} /></InputGroup>
            <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">{([['all', 'Все'], ['direct', 'Личные'], ['order', 'Заказы']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${filter === value ? 'bg-white shadow-sm dark:bg-zinc-700' : 'text-zinc-500'}`}>{label}</button>)}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? <Loading /> : filtered.length === 0 ? <p className="p-4 text-center text-sm text-zinc-500">Диалоги не найдены.</p> : filtered.map((conversation) => {
              const active = selected?.type === conversation.type && selected.id === conversation.id
              return (
                <button key={`${conversation.type}:${conversation.id}`} type="button" onClick={() => select(conversation)} className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition ${active ? 'bg-zinc-100 dark:bg-white/10' : 'hover:bg-zinc-50 dark:hover:bg-white/5'}`}>
                  {conversation.type === 'direct' ? <UserAvatar user={{ id: conversation.id, name: conversation.title, avatarUrl: conversation.avatarUrl }} className="size-10" /> : <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800"><ClipboardDocumentListIcon className="size-5 text-zinc-500" /></span>}
                  <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{conversation.title}</span>{conversation.unreadCount > 0 && <Badge color="red">{conversation.unreadCount}</Badge>}</span><span className="block truncate text-xs text-zinc-500">{conversation.lastMessage ? `${conversation.lastMessage.senderName}: ${conversation.lastMessage.body}` : conversation.subtitle}</span>{conversation.lastMessage && <span className="block text-[10px]/4 text-zinc-400">{formatDateTime(conversation.lastMessage.createdAt)}</span>}</span>
                </button>
              )
            })}
          </div>
        </aside>
        <section className={`flex min-h-0 min-w-0 flex-col ${!selected ? 'max-md:hidden' : ''}`}>
          {selected ? <>
            <div className="flex items-center gap-3 border-b border-zinc-950/10 px-4 py-3 dark:border-white/10"><Button plain className="md:hidden" aria-label="Назад к диалогам" onClick={back}><ArrowLeftIcon /></Button>{selected.type === 'direct' ? <UserIcon className="size-5 text-zinc-400" /> : <ChatBubbleLeftRightIcon className="size-5 text-zinc-400" />}<div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{selected.title}</div><div className="truncate text-xs text-zinc-500">{selected.subtitle}</div></div>{selected.type === 'order' && <Link href={`/orders/${selected.id}`} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white">Открыть заказ</Link>}</div>
            <div className="min-h-0 flex-1 p-4"><ChatBox key={`${selected.type}:${selected.id}`} orderId={selected.type === 'order' ? selected.id : undefined} peerId={selected.type === 'direct' ? selected.id : undefined} onActivity={() => void load()} /></div>
          </> : <div className="flex h-full flex-col items-center justify-center p-8 text-center"><ChatBubbleLeftRightIcon className="size-10 text-zinc-300" /><p className="mt-4 text-sm font-medium">Выберите диалог</p><p className="mt-1 text-sm text-zinc-500">Напишите сотруднику или откройте обсуждение заказа.</p></div>}
        </section>
      </div>
    </>
  )
}
