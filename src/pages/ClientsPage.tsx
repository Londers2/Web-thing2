import { useCallback, useEffect, useState } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/16/solid'
import { api } from '../api'
import type { Client } from '../types'
import { Button } from '../components/catalyst/button'
import { Heading } from '../components/catalyst/heading'
import { Input, InputGroup } from '../components/catalyst/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/catalyst/table'
import { ClientFormDialog } from '../components/ClientFormDialog'
import { EmptyState, ErrorAlert, Loading } from '../components/Loading'
import { Pagination } from '../components/Pagination'

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)

  const load = useCallback(async () => {
    try {
      const result = await api<{ items: Client[]; total: number; pages: number }>(`/clients?q=${encodeURIComponent(query)}&page=${page}`)
      setClients(result.items)
      setTotal(result.total)
      setPages(result.pages)
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить клиентов') }
    finally { setLoading(false) }
  }, [query, page])

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 200)
    return () => clearTimeout(timeout)
  }, [load])
  useEffect(() => { setPage(1) }, [query])

  function saved(client: Client) {
    setClients((current) => {
      const exists = current.some((item) => item.id === client.id)
      return (exists ? current.map((item) => item.id === client.id ? client : item) : [...current, client]).sort((a, b) => a.name.localeCompare(b.name))
    })
  }

  return (
    <>
      <div className="flex items-end justify-between gap-4"><Heading>Клиенты</Heading><Button onClick={() => { setSelected(null); setOpen(true) }}><PlusIcon />Добавить клиента</Button></div>
      <InputGroup className="my-6 rounded-xl bg-zinc-50 p-2 sm:max-w-md dark:bg-white/[2.5%]"><MagnifyingGlassIcon /><Input aria-label="Поиск клиентов" placeholder="Имя, телефон или email" value={query} onChange={(e) => setQuery(e.target.value)} /></InputGroup>
      <ErrorAlert>{error}</ErrorAlert>
      {loading ? <Loading /> : clients.length === 0 ? <EmptyState title={query ? 'Клиенты не найдены' : 'Клиентов пока нет'} description={query ? 'Попробуйте изменить запрос.' : 'Добавьте клиента, чтобы связать его с первым заказом.'} action={!query && <Button onClick={() => setOpen(true)}><PlusIcon />Добавить клиента</Button>} /> : (
        <>
          <Table className="mt-6 [--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]"><TableHead><TableRow><TableHeader>Клиент</TableHeader><TableHeader>Позывной</TableHeader><TableHeader>Телефон</TableHeader><TableHeader>Email</TableHeader><TableHeader><span className="sr-only">Действия</span></TableHeader></TableRow></TableHead><TableBody>{clients.map((client) => <TableRow key={client.id}><TableCell className="font-medium">{client.name}</TableCell><TableCell className="text-zinc-500">{client.callSign || '—'}</TableCell><TableCell className="text-zinc-500">{client.phone || '—'}</TableCell><TableCell className="text-zinc-500">{client.email || '—'}</TableCell><TableCell><Button plain aria-label={`Изменить ${client.name}`} onClick={() => { setSelected(client); setOpen(true) }}><PencilSquareIcon /></Button></TableCell></TableRow>)}</TableBody></Table>
          <Pagination page={page} pages={pages} total={total} onPage={setPage} />
        </>
      )}
      <ClientFormDialog open={open} onClose={() => setOpen(false)} client={selected} onSaved={saved} />
    </>
  )
}
