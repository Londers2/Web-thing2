import { useEffect, useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid'
import { api } from '../api'
import type { CalendarTask } from '../types'
import { formatDate, taskTypeColors, taskTypeLabels } from '../utils'
import { Badge } from '../components/catalyst/badge'
import { Button } from '../components/catalyst/button'
import { Heading, Subheading } from '../components/catalyst/heading'
import { Link } from '../components/catalyst/link'
import { ErrorAlert, Loading } from '../components/Loading'
import { AvailabilityCalendar } from '../components/AvailabilityCalendar'
import { useAuth } from '../auth'
import { AssigneeAvatars } from '../components/AssigneeAvatars'

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

export function DashboardPage() {
  const { user } = useAuth()
  const [mode, setMode] = useState<'tasks' | 'availability'>('tasks')
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [tasks, setTasks] = useState<CalendarTask[]>([])
  const [weekTasks, setWeekTasks] = useState<CalendarTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const range = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const offset = (new Date(year, month, 1).getDay() + 6) % 7
    const start = new Date(year, month, 1 - offset)
    return { start: dateKey(start), end: dateKey(addDays(start, 42)) }
  }, [currentMonth])

  useEffect(() => { api<CalendarTask[]>('/calendar/weeks').then(setWeekTasks).catch((reason) => setError(reason.message)) }, [])
  useEffect(() => {
    setLoading(true)
    api<CalendarTask[]>(`/calendar?start=${range.start}&end=${range.end}`).then((data) => {
      setTasks(data)
      setError('')
    }).catch((reason) => setError(reason.message)).finally(() => setLoading(false))
  }, [range])

  const days = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const offset = (new Date(year, month, 1).getDay() + 6) % 7
    const start = new Date(year, month, 1 - offset)
    return Array.from({ length: 42 }, (_, index) => addDays(start, index))
  }, [currentMonth])

  const weeks = useMemo(() => {
    const now = new Date()
    const monday = addDays(now, -((now.getDay() + 6) % 7))
    return Array.from({ length: 4 }, (_, index) => addDays(monday, index * 7))
  }, [])
  const monthDays = useMemo(() => days.filter((day) => day.getMonth() === currentMonth.getMonth()), [days, currentMonth])
  const today = dateKey(new Date())
  const monthTitle = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(currentMonth)
  const moveMonth = (offset: number) => setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() + offset, 1))
  const weekTitles = ['Задачи на эту неделю', 'Задачи на следующую', 'Через 2 недели', 'Через 3 недели']
  const manager = user?.jobRoles?.includes('manager')

  if (manager && mode === 'availability') return <><div className="flex flex-wrap items-center justify-between gap-3"><Heading>Календарь</Heading><Button outline onClick={() => setMode('tasks')}>Показать задачи</Button></div><AvailabilityCalendar /></>

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3"><Heading>Календарь задач</Heading>{manager && <Button outline onClick={() => setMode('availability')}>Свободные сборщики</Button>}</div>
      <ErrorAlert>{error}</ErrorAlert>
      <section className="mt-6"><Subheading>Ближайшие недели</Subheading><div className="mt-4 grid gap-4 max-sm:flex max-sm:snap-x max-sm:overflow-x-auto max-sm:pb-3 sm:grid-cols-2 xl:grid-cols-4">
        {weeks.map((start, index) => {
          const end = addDays(start, 7)
          const items = weekTasks.filter((task) => task.dueDate >= dateKey(start) && task.dueDate < dateKey(end))
          return <div key={dateKey(start)} className="min-w-0 rounded-xl border border-zinc-950/10 p-4 max-sm:w-[85vw] max-sm:shrink-0 max-sm:snap-start dark:border-white/10"><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold">{weekTitles[index]}</h3><Badge color="zinc">{items.length}</Badge></div><p className="mt-1 text-xs text-zinc-500">{formatDate(dateKey(start), false)} — {formatDate(dateKey(addDays(start, 6)), false)}</p><div className="mt-4 max-h-64 space-y-2 overflow-y-auto">{items.length === 0 ? <p className="py-4 text-sm text-zinc-400">Задач нет</p> : items.map((task) => <Link key={task.id} href={`/orders/${task.orderId}`} className={`block rounded-lg bg-zinc-50 p-3 hover:bg-zinc-100 dark:bg-white/5 dark:hover:bg-white/10 ${task.completed ? 'opacity-50' : ''}`}><div className="flex items-center justify-between gap-2"><Badge color={taskTypeColors[task.taskType]}>{taskTypeLabels[task.taskType]}</Badge><span className="text-xs text-zinc-500">{formatDate(task.dueDate, false)}</span></div><div className="mt-1 truncate text-sm font-medium">{task.orderTitle}</div><AssigneeAvatars users={task.assignees} /></Link>)}</div></div>
        })}
      </div></section>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-4"><div><Subheading>Календарь</Subheading><p className="mt-2 text-sm text-zinc-500 first-letter:uppercase">{monthTitle}</p></div><div className="flex items-center gap-1 sm:gap-2"><Button outline className="max-sm:px-2" onClick={() => setCurrentMonth(new Date())}>Сегодня</Button><Button plain aria-label="Предыдущий месяц" onClick={() => moveMonth(-1)}><ChevronLeftIcon /></Button><Button plain aria-label="Следующий месяц" onClick={() => moveMonth(1)}><ChevronRightIcon /></Button></div></div>
      {loading ? <Loading label="Загружаем задачи…" /> : <>
        <div className="mt-6 space-y-5 md:hidden">{monthDays.map((day) => {
          const dayTasks = tasks.filter((task) => task.dueDate === dateKey(day))
          const isToday = dateKey(day) === today
          return <section key={dateKey(day)} className="flex gap-4"><div className="w-10 shrink-0 text-center"><div className="text-xs text-zinc-500">{weekDays[(day.getDay() + 6) % 7]}</div><div className={`mx-auto mt-1 flex size-8 items-center justify-center rounded-full text-sm ${isToday ? 'bg-blue-600 font-semibold text-white' : ''}`}>{day.getDate()}</div></div><div className="min-w-0 flex-1 space-y-2 border-l border-zinc-200 pl-4 dark:border-zinc-700">{dayTasks.length === 0 ? <div className="py-2 text-xs text-zinc-400">Нет задач</div> : dayTasks.map((task) => <Link key={task.id} href={`/orders/${task.orderId}`} className={`block rounded-lg bg-blue-50 p-3 ring-1 ring-blue-600/10 dark:bg-blue-500/10 ${task.completed ? 'opacity-50' : ''}`}><div className="flex items-center justify-between gap-2"><Badge color={taskTypeColors[task.taskType]}>{taskTypeLabels[task.taskType]}</Badge><span className="text-xs text-zinc-500">{formatDate(task.dueDate, false)}</span></div><div className="mt-1 truncate text-sm font-medium">{task.orderTitle}</div><AssigneeAvatars users={task.assignees} /></Link>)}</div></section>
        })}</div>
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-950/10 max-md:hidden dark:border-white/10"><div className="grid grid-cols-7 border-b border-zinc-950/10 bg-zinc-50 dark:border-white/10 dark:bg-white/[2.5%]">{weekDays.map((day) => <div key={day} className="px-3 py-2 text-xs font-medium text-zinc-500">{day}</div>)}</div><div className="grid grid-cols-7">{days.map((day) => {
          const dayKey = dateKey(day)
          const dayTasks = tasks.filter((task) => task.dueDate === dayKey)
          const outside = day.getMonth() !== currentMonth.getMonth()
          return <div key={dayKey} className={`h-36 overflow-y-auto border-b border-r border-zinc-950/5 p-2 [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0 dark:border-white/5 ${outside ? 'bg-zinc-50/70 dark:bg-white/[1.5%]' : ''}`}><div className={`mb-2 flex size-7 items-center justify-center rounded-full text-xs ${dayKey === today ? 'bg-zinc-900 font-semibold text-white dark:bg-white dark:text-zinc-900' : outside ? 'text-zinc-400' : 'text-zinc-600 dark:text-zinc-300'}`}>{day.getDate()}</div><div className="space-y-1.5">{dayTasks.map((task) => <Link key={task.id} href={`/orders/${task.orderId}`} className={`block rounded-md bg-zinc-50 p-1.5 ring-1 ring-zinc-950/5 transition hover:bg-zinc-100 dark:bg-white/5 dark:ring-white/10 dark:hover:bg-white/10 ${task.completed ? 'opacity-50' : ''}`}><Badge color={taskTypeColors[task.taskType]} className="px-1.5 py-0 text-[10px]/4">{taskTypeLabels[task.taskType]}</Badge><span className="mt-1 block truncate text-[10px]/4 text-zinc-500">{task.orderTitle}</span><AssigneeAvatars users={task.assignees} /></Link>)}</div></div>
        })}</div></div>
      </>}
      {!loading && tasks.length === 0 && <p className="mt-4 text-sm text-zinc-500">В этом месяце задач нет. Добавьте задачи в заказы, и они появятся в календаре.</p>}
    </>
  )
}
