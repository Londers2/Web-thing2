import { useEffect, useState } from 'react'
import { api } from '../api'
import { Input } from './catalyst/input'

export interface AddressValue {
  address: string
  lat: number | null
  lng: number | null
}

export function AddressSearch({ value, onChange }: { value: AddressValue; onChange: (value: AddressValue) => void }) {
  const [query, setQuery] = useState(value.address)
  const [suggestions, setSuggestions] = useState<AddressValue[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => { setQuery(value.address) }, [value.address])
  useEffect(() => {
    if (query.trim().length < 3 || query === value.address) { setSuggestions([]); return }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      api<AddressValue[]>(`/geo/search?q=${encodeURIComponent(query)}`, { signal: controller.signal }).then((data) => { setSuggestions(data); setOpen(true) }).catch(() => undefined)
    }, 350)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, value.address])

  return (
    <div className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
      <Input aria-label="Адрес" value={query} onChange={(event) => { setQuery(event.target.value); onChange({ address: event.target.value, lat: null, lng: null }); setOpen(true) }} onFocus={() => setOpen(true)} placeholder="Город, улица, дом, квартира" autoComplete="off" />
      {open && suggestions.length > 0 && <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl bg-white p-1 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:ring-white/10">{suggestions.map((suggestion) => <button key={`${suggestion.lat}-${suggestion.lng}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(suggestion.address); onChange(suggestion); setOpen(false) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700">{suggestion.address}<span className="mt-1 block text-xs text-zinc-500">Точный адрес будет отмечен на карте</span></button>)}</div>}
    </div>
  )
}
