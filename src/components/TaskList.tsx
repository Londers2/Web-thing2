import { useState, type FormEvent } from 'react'
import { PlusIcon, TrashIcon } from '@heroicons/react/16/solid'
import { api, jsonBody } from '../api'
import { useAuth } from '../auth'
import type { Task, TaskType, User } from '../types'
import { formatDate, isOverdue, taskTypeColors, taskTypeLabels } from '../utils'
import { Badge } from './catalyst/badge'
import { Button } from './catalyst/button'
import { Checkbox } from './catalyst/checkbox'
import { Description, Field, Label } from './catalyst/fieldset'
import { Input } from './catalyst/input'
import { Select } from './catalyst/select'
import { ErrorAlert } from './Loading'
import { MemberSearch } from './SearchFields'
import { UserAvatar } from './UserAvatar'

export function TaskList({ orderId, tasks, users, onChange }: { orderId: string; tasks: Task[]; users: User[]; onChange: (tasks: Task[]) => void }) {
  const { user } = useAuth()
  const [taskType, setTaskType] = useState<TaskType>('measurement')
  const [dueDate, setDueDate] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>(user ? [user.id] : [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function addTask(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const task = await api<Task>(`/orders/${orderId}/tasks`, { method: 'POST', body: jsonBody({ taskType, dueDate, assigneeIds }) })
      onChange([...tasks, task].sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
      setDueDate('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось добавить задачу') }
    finally { setBusy(false) }
  }

  async function toggle(task: Task, completed: boolean) {
    try {
      const updated = await api<Task>(`/orders/${orderId}/tasks/${task.id}`, { method: 'PATCH', body: jsonBody({ completed }) })
      onChange(tasks.map((item) => item.id === task.id ? updated : item))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось обновить задачу') }
  }

  async function remove(task: Task) {
    await api(`/orders/${orderId}/tasks/${task.id}`, { method: 'DELETE' })
    onChange(tasks.filter((item) => item.id !== task.id))
  }

  return (
    <div>
      <form onSubmit={addTask} className="space-y-4 rounded-xl bg-zinc-50 p-4 dark:bg-white/[2.5%]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[180px_180px_auto]"><Select aria-label="Тип задачи" value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)}>{Object.entries(taskTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Input aria-label="Срок задачи" required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /><Button type="submit" disabled={busy}><PlusIcon />Добавить задачу</Button></div>
        <Field><Label>Исполнители</Label><Description>Можно выбрать одного или нескольких участников заказа.</Description><div className="mt-2"><MemberSearch users={users} value={assigneeIds} onChange={setAssigneeIds} /></div></Field>
      </form>
      <ErrorAlert>{error}</ErrorAlert>
      <div className="mt-4 divide-y divide-zinc-950/5 dark:divide-white/5">
        {tasks.length === 0 ? <p className="py-6 text-sm text-zinc-500">Задач пока нет. Выберите тип, дату и исполнителей.</p> : tasks.map((task) => (
          <div key={task.id} className="group flex items-start gap-3 py-4">
            <Checkbox className="mt-1" aria-label={task.completed ? 'Вернуть задачу в работу' : 'Отметить выполненной'} checked={task.completed} onChange={(checked) => void toggle(task, checked)} />
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge color={taskTypeColors[task.taskType]}>{taskTypeLabels[task.taskType]}</Badge><span className={`text-xs/5 ${isOverdue(task.dueDate, task.completed) ? 'font-medium text-red-600' : 'text-zinc-500'}`}>{isOverdue(task.dueDate, task.completed) ? 'Просрочено · ' : ''}{formatDate(task.dueDate)}</span></div><div className="mt-2 flex flex-wrap gap-2">{task.assignees.length === 0 ? <span className="text-xs text-zinc-400">Исполнитель не назначен</span> : task.assignees.map((assignee) => <span key={assignee.id} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-1 pl-1 pr-2 text-xs dark:bg-zinc-800"><UserAvatar user={assignee} className="size-5" />{assignee.name}</span>)}</div></div>
            <Button plain aria-label="Удалить задачу" onClick={() => void remove(task)}><TrashIcon /></Button>
          </div>
        ))}
      </div>
    </div>
  )
}
