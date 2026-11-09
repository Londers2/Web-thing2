import { useEffect, useState } from 'react'
import { PencilSquareIcon, PlusIcon } from '@heroicons/react/16/solid'
import { api, jsonBody } from '../api'
import { useAuth } from '../auth'
import type { User } from '../types'
import { formatDate } from '../utils'
import { Badge } from '../components/catalyst/badge'
import { Button } from '../components/catalyst/button'
import { Heading } from '../components/catalyst/heading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/catalyst/table'
import { ErrorAlert, Loading } from '../components/Loading'
import { UserFormDialog } from '../components/UserFormDialog'
import { UserAvatar } from '../components/UserAvatar'

const roleLabels = { manager: 'Менеджер', assembler: 'Сборщик', measurer: 'Замерщик' }

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<User | null>(null)

  useEffect(() => { api<User[]>('/users').then(setUsers).catch((reason) => setError(reason.message)).finally(() => setLoading(false)) }, [])

  function saved(user: User) {
    setUsers((current) => {
      const exists = current.some((item) => item.id === user.id)
      return exists ? current.map((item) => item.id === user.id ? user : item) : [...current, user]
    })
  }

  async function toggleActive(user: User) {
    if (user.active && !window.confirm(`Отключить доступ для ${user.name}?`)) return
    try {
      const updated = await api<User>(`/users/${user.id}`, { method: 'PATCH', body: jsonBody({ active: !user.active }) })
      saved(updated)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось изменить доступ') }
  }

  return <><div className="flex items-end justify-between gap-4"><Heading>Пользователи</Heading><Button onClick={() => { setSelected(null); setOpen(true) }}><PlusIcon />Добавить пользователя</Button></div><p className="mt-2 text-sm text-zinc-500">Управление доступом к рабочему пространству.</p><ErrorAlert>{error}</ErrorAlert>{loading ? <Loading /> : <Table className="mt-8 [--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]"><TableHead><TableRow><TableHeader><span className="sr-only">Аватар</span></TableHeader><TableHeader>Имя</TableHeader><TableHeader>Email</TableHeader><TableHeader>Роль</TableHeader><TableHeader>Роль в команде</TableHeader><TableHeader>Статус</TableHeader><TableHeader>Добавлен</TableHeader><TableHeader><span className="sr-only">Действия</span></TableHeader></TableRow></TableHead><TableBody>{users.map((user) => <TableRow key={user.id}><TableCell><UserAvatar user={user} className="size-8" /></TableCell><TableCell className="font-medium">{user.name}{user.id === currentUser?.id ? ' (вы)' : ''}</TableCell><TableCell className="text-zinc-500">{user.email}</TableCell><TableCell>{user.role === 'admin' ? 'Администратор' : 'Сотрудник'}</TableCell><TableCell className="text-zinc-500">{(user.jobRoles || [user.jobRole || 'manager']).map((role) => roleLabels[role]).join(', ')}</TableCell><TableCell><Badge color={user.active ? 'lime' : 'zinc'}>{user.active ? 'Активен' : 'Отключён'}</Badge></TableCell><TableCell className="text-zinc-500">{formatDate(user.createdAt)}</TableCell><TableCell><div className="flex justify-end gap-1"><Button plain aria-label="Изменить" onClick={() => { setSelected(user); setOpen(true) }}><PencilSquareIcon /></Button>{user.id !== currentUser?.id && <Button plain onClick={() => void toggleActive(user)}>{user.active ? 'Отключить' : 'Включить'}</Button>}</div></TableCell></TableRow>)}</TableBody></Table>}<UserFormDialog open={open} onClose={() => setOpen(false)} user={selected} onSaved={saved} /></>
}
