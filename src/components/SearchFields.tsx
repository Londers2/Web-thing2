import { useEffect, useState } from 'react'
import * as Headless from '@headlessui/react'
import { CheckIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { api } from '../api'
import type { Client, User } from '../types'
import { Input } from './catalyst/input'
import { UserAvatar } from './UserAvatar'

const optionClasses = 'group flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-950 select-none data-focus:bg-zinc-900 data-focus:text-white dark:text-white dark:data-focus:bg-zinc-700'

export function ClientSearch({ value, onChange }: { value: Client | null; onChange: (client: Client | null) => void }) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<Client[]>([])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      api<Client[]>(`/clients?q=${encodeURIComponent(query)}`, { signal: controller.signal }).then((data) => setOptions(data.slice(0, 30))).catch(() => undefined)
    }, 200)
    return () => { controller.abort(); clearTimeout(timeout) }
  }, [query])

  return (
    <Headless.Combobox value={value} onChange={onChange} onClose={() => setQuery('')}>
      <div className="relative">
        <Headless.ComboboxInput as={Input} aria-label="Клиент" required displayValue={(client: Client | null) => client?.name || ''} onChange={(event) => setQuery(event.target.value)} placeholder="Начните вводить имя, email или телефон" autoComplete="off" />
        <Headless.ComboboxOptions className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl bg-white p-1 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:ring-white/10">
          {options.length === 0 ? <div className="px-3 py-3 text-sm text-zinc-500">Клиенты не найдены</div> : options.map((client) => (
            <Headless.ComboboxOption key={client.id} value={client} className={optionClasses}>
              <span className="min-w-0 flex-1"><span className="block truncate">{client.name}{client.callSign ? ` · ${client.callSign}` : ''}</span><span className="block truncate text-xs text-zinc-500 group-data-focus:text-zinc-300">{[client.phone, client.email].filter(Boolean).join(' · ') || 'Контакты не указаны'}</span></span><CheckIcon className="hidden size-4 group-data-selected:block" />
            </Headless.ComboboxOption>
          ))}
        </Headless.ComboboxOptions>
      </div>
    </Headless.Combobox>
  )
}

export function MemberSearch({ users, value, onChange, creatorId }: { users: User[]; value: string[]; onChange: (ids: string[]) => void; creatorId?: string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = users.filter((user) => value.includes(user.id))
  const matches = users.filter((user) => user.active !== false && !value.includes(user.id) && `${user.name} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 30)

  function add(user: User) {
    onChange([...value, user.id])
    setQuery('')
    setOpen(false)
  }

  return (
    <div>
      {selected.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{selected.map((user) => <span key={user.id} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-1 pl-1 pr-1 text-xs dark:bg-zinc-800"><UserAvatar user={user} className="size-5" />{user.name}{user.id === creatorId ? ' (создатель)' : ''}{user.id !== creatorId && <button type="button" aria-label={`Убрать ${user.name}`} onClick={() => onChange(value.filter((id) => id !== user.id))} className="rounded-full p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700"><XMarkIcon className="size-3" /></button>}</span>)}</div>}
      <div className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
        <Input aria-label="Поиск участников" value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true) }} onKeyDown={(event) => {
          if (event.key === 'Enter' && query && matches[0]) { event.preventDefault(); add(matches[0]) }
          if (event.key === 'Escape') setOpen(false)
        }} placeholder="Найти сотрудника по имени или email" autoComplete="off" />
        {open && query && <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl bg-white p-1 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:ring-white/10">
          {matches.length === 0 ? <div className="px-3 py-3 text-sm text-zinc-500">Сотрудники не найдены</div> : matches.map((user) => <button key={user.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => add(user)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"><UserAvatar user={user} className="size-7" /><span className="block truncate text-sm">{user.name}</span><span className="block truncate text-xs text-zinc-500">{user.email}</span></button>)}
        </div>}
      </div>
    </div>
  )
}
