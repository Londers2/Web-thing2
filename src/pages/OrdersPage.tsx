import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/16/solid'
import { api } from '../api'
import type { Order, User } from '../types'
import { formatDate, formatDaysUntil, formatMoney, statusColors, statusLabels } from '../utils'
import { Badge } from '../components/catalyst/badge'
import { Button } from '../components/catalyst/button'
import { Heading } from '../components/catalyst/heading'
import { Input, InputGroup } from '../components/catalyst/input'
import { Select } from '../components/catalyst/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/catalyst/table'
import { EmptyState, ErrorAlert, Loading } from '../components/Loading'
import { OrderFormDialog } from '../components/OrderFormDialog'
import { Pagination } from '../components/Pagination'

export function OrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)

  const loadOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (query) params.set('q', query)
      if (status) params.set('status', status)
      const result = await api<{ items: Order[]; total: number; pages: number }>(`/orders?${params}`)
      setOrders(result.items)
      setTotal(result.total)
      setPages(result.pages)
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить заказы') }
    finally { setLoading(false) }
  }, [query, status, page])

  useEffect(() => {
    const timeout = setTimeout(() => void loadOrders(), 250)
    return () => clearTimeout(timeout)
  }, [loadOrders])
  useEffect(() => { setPage(1) }, [query, status])
  useEffect(() => { api<User[]>('/users').then(setUsers).catch(() => undefined) }, [])

  return (
    <>
      <div className="flex items-end justify-between gap-4"><Heading>Заказы</Heading><Button className="-my-0.5" onClick={() => setFormOpen(true)}><PlusIcon />Создать заказ</Button></div>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <InputGroup className="sm:max-w-xs"><MagnifyingGlassIcon /><Input aria-label="Поиск заказов" placeholder="Название или клиент" value={query} onChange={(e) => setQuery(e.target.value)} /></InputGroup>
        <Select aria-label="Фильтр по статусу" className="sm:max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Все статусы</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      </div>
      <ErrorAlert>{error}</ErrorAlert>
      {loading ? <Loading /> : orders.length === 0 ? <EmptyState title={query || status ? 'Ничего не найдено' : 'Заказов пока нет'} description={query || status ? 'Измените условия поиска.' : 'Создайте первый заказ и добавьте участников, чтобы начать совместную работу.'} action={!query && !status && <Button onClick={() => setFormOpen(true)}><PlusIcon />Создать заказ</Button>} /> : (
        <>
          <Table className="mt-6 [--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
            <TableHead><TableRow><TableHeader>Заказ</TableHeader><TableHeader>Клиент</TableHeader><TableHeader>Статус</TableHeader><TableHeader>Ближайшая задача</TableHeader><TableHeader>Задачи</TableHeader><TableHeader className="text-right">Сумма</TableHeader></TableRow></TableHead>
            <TableBody>{orders.map((order) => <TableRow key={order.id} href={`/orders/${order.id}`} title={order.title}><TableCell className="max-w-64"><span className="block truncate font-medium">{order.title}</span><span className="block truncate text-xs text-zinc-500">{order.creator.name}</span></TableCell><TableCell>{order.client.name}</TableCell><TableCell><Badge color={statusColors[order.status]}>{statusLabels[order.status]}</Badge></TableCell><TableCell className="text-zinc-500">{formatDate(order.nearestDeadline, false)}{order.nearestDeadline && <span className="ml-1 text-xs text-zinc-400">({formatDaysUntil(order.nearestDeadline)})</span>}</TableCell><TableCell className="text-zinc-500">{order.taskDone}/{order.taskTotal}</TableCell><TableCell className="text-right font-medium">{formatMoney(order.amount)}</TableCell></TableRow>)}</TableBody>
          </Table>
          <Pagination page={page} pages={pages} total={total} onPage={setPage} />
        </>
      )}
      <OrderFormDialog open={formOpen} onClose={() => setFormOpen(false)} users={users} onSaved={(order) => navigate(`/orders/${order.id}`)} />
    </>
  )
}
