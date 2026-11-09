import { useEffect, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from '@heroicons/react/16/solid'
import { api, jsonBody } from '../api'
import { useAuth } from '../auth'
import type { AssemblerAvailability, UnavailableDay } from '../types'
import { formatDate } from '../utils'
import { Badge } from './catalyst/badge'
import { Button } from './catalyst/button'
import { Input } from './catalyst/input'
import { ErrorAlert, Loading } from './Loading'
import { UserAvatar } from './UserAvatar'

const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const currentWeek = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
}

export function AvailabilityCalendar() {
  const { user } = useAuth()
  const [week, setWeek] = useState(currentWeek)
  const [users, setUsers] = useState<AssemblerAvailability[]>([])
  const [days, setDays] = useState<UnavailableDay[]>([])
  const [newDay, setNewDay] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const weekKey = dateKey(week)
  const assembler = user?.jobRoles?.includes('assembler')

  async function load() {
    setLoading(true)
    try {
      const requests: Promise<unknown>[] = [api<AssemblerAvailability[]>(`/calendar/availability?week=${weekKey}`)]
      if (assembler) requests.push(api<UnavailableDay[]>('/calendar/availability/days'))
      const [availability, unavailable] = await Promise.all(requests)
      setUsers(availability as AssemblerAvailability[])
      if (unavailable) setDays(unavailable as UnavailableDay[])
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить доступность') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [weekKey])

  async function addDay() {
    if (!newDay) return
    await api('/calendar/availability/days', { method: 'POST', body: jsonBody({ date: newDay, reason }) })
    setNewDay('')
    setReason('')
    await load()
  }

  async function removeDay(date: string) {
    await api(`/calendar/availability/days/${date}`, { method: 'DELETE' })
    await load()
  }

  function move(offset: number) {
    setWeek((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + offset * 7))
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Доступность сборщиков</h2><p className="mt-1 text-sm text-zinc-500">{formatDate(weekKey, false)} — {formatDate(dateKey(new Date(week.getFullYear(), week.getMonth(), week.getDate() + 6)), false)}</p></div><div className="flex gap-2"><Button plain aria-label="Предыдущая неделя" onClick={() => move(-1)}><ChevronLeftIcon /></Button><Button outline onClick={() => setWeek(currentWeek())}>Эта неделя</Button><Button plain aria-label="Следующая неделя" onClick={() => move(1)}><ChevronRightIcon /></Button></div></div>
      <ErrorAlert>{error}</ErrorAlert>
      {loading ? <Loading /> : <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-950/10 dark:border-white/10"><table className="min-w-full text-left text-sm"><thead className="bg-zinc-50 dark:bg-white/[2.5%]"><tr><th className="px-4 py-3 font-medium">Сборщик</th>{users[0]?.days.map((day) => <th key={day.date} className="px-3 py-3 text-center font-medium">{formatDate(day.date, false)}</th>)}</tr></thead><tbody>{users.map((assemblerUser) => <tr key={assemblerUser.id} className="border-t border-zinc-950/5 dark:border-white/5"><td className="px-4 py-3"><span className="flex items-center gap-2"><UserAvatar user={assemblerUser} className="size-7" />{assemblerUser.name}</span></td>{assemblerUser.days.map((day) => <td key={day.date} className="px-3 py-3 text-center"><Badge color={day.busy ? 'red' : 'lime'}>{day.busy ? 'Занят' : 'Свободен'}</Badge></td>)}</tr>)}</tbody></table>{users.length === 0 && <p className="p-6 text-sm text-zinc-500">Сборщиков в команде нет.</p>}</div>}
      {assembler && <div className="mt-8 max-w-xl rounded-xl border border-zinc-950/10 p-4 dark:border-white/10"><h3 className="text-sm font-semibold">Мои недоступные дни</h3><div className="mt-4 grid gap-3 sm:grid-cols-[170px_1fr_auto]"><Input type="date" aria-label="Недоступный день" value={newDay} onChange={(event) => setNewDay(event.target.value)} /><Input aria-label="Причина" placeholder="Причина (необязательно)" value={reason} onChange={(event) => setReason(event.target.value)} /><Button disabled={!newDay} onClick={() => void addDay()}><PlusIcon />Добавить</Button></div><div className="mt-4 divide-y divide-zinc-950/5 dark:divide-white/5">{days.map((day) => <div key={day.date} className="flex items-center gap-3 py-2 text-sm"><span>{formatDate(day.date)}</span><span className="flex-1 text-zinc-500">{day.reason}</span><Button plain aria-label="Удалить день" onClick={() => void removeDay(day.date)}><TrashIcon /></Button></div>)}</div></div>}
    </section>
  )
}
