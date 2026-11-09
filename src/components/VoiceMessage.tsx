import { useRef, useState } from 'react'
import { PauseIcon, PlayIcon } from '@heroicons/react/16/solid'
import { api } from '../api'
import type { Message } from '../types'

function seconds(value: number) {
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
}

export function VoiceMessage({ message }: { message: Message }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(message.attachmentDuration || 0)
  const [transcript, setTranscript] = useState(message.transcript || '')
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState('')
  const bars = Array.from({ length: 42 }, (_, index) => 5 + ((message.id.charCodeAt(index % message.id.length) * (index % 7 + 2)) % 20))
  const progress = duration ? currentTime / duration : 0

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else void audio.play()
    setPlaying(!playing)
  }

  async function transcribe() {
    setTranscribing(true)
    setError('')
    try {
      const result = await api<{ transcript: string }>(`/messages/${message.id}/transcribe`, { method: 'POST' })
      setTranscript(result.transcript)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось расшифровать') }
    finally { setTranscribing(false) }
  }

  return (
    <div className="w-64 max-w-full">
      <audio ref={audioRef} src={message.attachmentUrl || undefined} preload="metadata" onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || message.attachmentDuration || 0)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onEnded={() => { setPlaying(false); setCurrentTime(0) }} />
      <div className="flex items-center gap-3">
        <button type="button" aria-label={playing ? 'Пауза' : 'Слушать'} onClick={toggle} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white"><span>{playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}</span></button>
        <div className="min-w-0 flex-1">
          <div className="flex h-7 items-center gap-[2px] overflow-hidden">{bars.map((height, index) => <span key={index} className={`w-[2px] shrink-0 rounded-full ${index / bars.length <= progress ? 'bg-blue-400' : 'bg-current opacity-40'}`} style={{ height }} />)}</div>
          <div className="mt-1 text-[10px] opacity-70">{seconds(currentTime || duration)}{message.attachmentSize ? `, ${(message.attachmentSize / 1024).toFixed(1)} КБ` : ''}</div>
        </div>
        <button type="button" disabled={transcribing} onClick={() => void transcribe()} className="self-start rounded px-1 text-[10px] font-medium text-blue-400 disabled:opacity-50">{transcribing ? '…' : '→А'}</button>
      </div>
      {transcript && <div className="mt-2 border-t border-current/10 pt-2 text-sm/5">{transcript}</div>}
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
    </div>
  )
}
