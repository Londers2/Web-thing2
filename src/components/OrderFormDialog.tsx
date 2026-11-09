import { useEffect, useState, type FormEvent } from 'react'
import { api, jsonBody } from '../api'
import { useAuth } from '../auth'
import type { Client, Order, OrderInput, OrderStatus, User } from '../types'
import { formatAmountInput, formatMoney, parseAmount, statusLabels } from '../utils'
import { AddressSearch } from './AddressSearch'
import { Button } from './catalyst/button'
import { Checkbox } from './catalyst/checkbox'
import { Dialog, DialogActions, DialogBody, DialogDescription, DialogTitle } from './catalyst/dialog'
import { Description, Field, FieldGroup, Fieldset, Label } from './catalyst/fieldset'
import { Input } from './catalyst/input'
import { Select } from './catalyst/select'
import { Textarea } from './catalyst/textarea'
import { ErrorAlert } from './Loading'
import { ClientSearch, MemberSearch } from './SearchFields'
import { UserAvatar } from './UserAvatar'

export function OrderFormDialog({ open, onClose, order, users, onSaved }: { open: boolean; onClose: () => void; order?: Order | null; users: User[]; onSaved: (order: Order) => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [addressLat, setAddressLat] = useState<number | null>(null)
  const [addressLng, setAddressLng] = useState<number | null>(null)
  const [status, setStatus] = useState<OrderStatus>('new')
  const [amount, setAmount] = useState('0')
  const [advanceAmount, setAdvanceAmount] = useState('0')
  const [assemblyAmount, setAssemblyAmount] = useState('0')
  const [assemblyTouched, setAssemblyTouched] = useState(false)
  const [client, setClient] = useState<Client | null>(null)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [editorIds, setEditorIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(order?.title || '')
    setDescription(order?.description || '')
    setAddress(order?.address || '')
    setAddressLat(order?.addressLat ?? null)
    setAddressLng(order?.addressLng ?? null)
    setStatus(order?.status || 'new')
    setAmount(formatAmountInput(String(order?.amount || 0)))
    setAdvanceAmount(formatAmountInput(String(order?.advanceAmount || 0)))
    setAssemblyAmount(formatAmountInput(String(order?.assemblyAmount ?? (order?.amount || 0) * 0.1)))
    setAssemblyTouched(false)
    setClient(order?.client || null)
    setMemberIds(order?.members.map((member) => member.id) || [])
    setEditorIds(order?.members.filter((member) => member.canEdit).map((member) => member.id) || [])
    setError('')
  }, [open, order])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const payload: OrderInput = { title, description, address, addressLat, addressLng, status, amount: parseAmount(amount), advanceAmount: parseAmount(advanceAmount), assemblyAmount: assemblyTouched ? parseAmount(assemblyAmount) : null, clientId: client!.id, memberIds, editorIds }
    try {
      const saved = await api<Order>(order ? `/orders/${order.id}` : '/orders', { method: order ? 'PATCH' : 'POST', body: jsonBody(payload) })
      onSaved(saved)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить заказ')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onClose={onClose} size="2xl">
      <DialogTitle>{order ? `Изменить «${order.title}»` : 'Новый заказ'}</DialogTitle>
      <DialogDescription>{order ? 'Обновите сведения и список участников.' : 'Заполните основные сведения. Задачи и изображения можно добавить после создания.'}</DialogDescription>
      <form onSubmit={submit}><DialogBody><Fieldset><FieldGroup className="space-y-6">
        <Field><Label>Название</Label><Input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, кухня для квартиры" /></Field>
        <div className="space-y-6"><Field><Label>Клиент</Label><ClientSearch value={client} onChange={setClient} /></Field>{order && <Field><Label>Статус</Label><Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>}</div>
        <div className="grid gap-4 sm:grid-cols-3"><Field><Label>Общая стоимость, ₽</Label><Input inputMode="decimal" required value={amount} onChange={(e) => { const value = formatAmountInput(e.target.value); setAmount(value); if (!assemblyTouched) setAssemblyAmount(formatAmountInput(String(parseAmount(value) * 0.1))) }} placeholder="0" /></Field><Field><Label>Аванс, ₽</Label><Input inputMode="decimal" value={advanceAmount} onChange={(e) => setAdvanceAmount(formatAmountInput(e.target.value))} placeholder="0" /></Field><Field><Label>Сборка, ₽</Label><Input inputMode="decimal" value={assemblyAmount} onChange={(e) => { setAssemblyTouched(true); setAssemblyAmount(formatAmountInput(e.target.value)) }} placeholder="0" /></Field></div>
        <p className="text-sm text-zinc-500">Доплата: {formatMoney(Math.max(0, parseAmount(amount) - parseAmount(advanceAmount)))}{!assemblyTouched && ' · Сборка рассчитывается автоматически по настройке администратора'}</p>
        <Field><Label>Описание</Label><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Пожелания клиента и важные детали…" /></Field>
        <Field><Label>Адрес</Label><AddressSearch value={{ address, lat: addressLat, lng: addressLng }} onChange={(value) => { setAddress(value.address); setAddressLat(value.lat); setAddressLng(value.lng) }} /></Field>
        <Field><Label>Участники</Label><Description>Только вы и выбранные сотрудники увидят этот заказ.</Description><div className="mt-3"><MemberSearch users={users} value={memberIds} onChange={(ids) => { setMemberIds(ids); setEditorIds((current) => current.filter((id) => ids.includes(id))) }} creatorId={order?.creatorId} /></div></Field>
        {(!order || order.creatorId === user?.id) && memberIds.length > 0 && <Field><Label>Права редактирования</Label><Description>Отметьте участников, которые могут изменять заказ.</Description><div className="mt-3 space-y-2">{memberIds.map((id) => { const member = users.find((entry) => entry.id === id); if (!member) return null; const creator = id === user?.id; return <label key={id} className="flex items-center gap-3 text-sm"><Checkbox disabled={creator} checked={creator || editorIds.includes(id)} onChange={(checked) => setEditorIds((current) => checked ? [...current, id] : current.filter((entry) => entry !== id))} /><UserAvatar user={member} className="size-6" />{member.name}{creator ? ' (создатель)' : ''}</label> })}</div></Field>}
      </FieldGroup></Fieldset><ErrorAlert>{error}</ErrorAlert></DialogBody>
      <DialogActions><Button type="button" plain onClick={onClose}>Отмена</Button><Button type="submit" disabled={busy || !client}>{busy ? 'Сохранение…' : order ? 'Сохранить изменения' : 'Создать заказ'}</Button></DialogActions></form>
    </Dialog>
  )
}
