import { useEffect, useState, type FormEvent } from 'react'
import { api, jsonBody } from '../api'
import type { Client } from '../types'
import { formatPhoneInput } from '../utils'
import { Button } from './catalyst/button'
import { Dialog, DialogActions, DialogBody, DialogDescription, DialogTitle } from './catalyst/dialog'
import { Field, FieldGroup, Fieldset, Label } from './catalyst/fieldset'
import { Input } from './catalyst/input'
import { Textarea } from './catalyst/textarea'
import { ErrorAlert } from './Loading'

export function ClientFormDialog({ open, onClose, client, onSaved }: { open: boolean; onClose: () => void; client?: Client | null; onSaved: (client: Client) => void }) {
  const [form, setForm] = useState({ name: '', callSign: '', email: '', phone: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm({ name: client?.name || '', callSign: client?.callSign || '', email: client?.email || '', phone: client?.phone ? formatPhoneInput(client.phone) : '', notes: client?.notes || '' })
      setError('')
    }
  }, [open, client])

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const saved = await api<Client>(client ? `/clients/${client.id}` : '/clients', { method: client ? 'PATCH' : 'POST', body: jsonBody(form) })
      onSaved(saved)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить клиента')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{client ? 'Изменить клиента' : 'Новый клиент'}</DialogTitle>
      <DialogDescription>Контактные данные будут доступны всей команде.</DialogDescription>
      <form onSubmit={submit}>
        <DialogBody><Fieldset><FieldGroup className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2"><Field><Label>Имя</Label><Input required autoFocus value={form.name} onChange={(e) => update('name', e.target.value)} /></Field><Field><Label>Позывной</Label><Input value={form.callSign} onChange={(e) => update('callSign', e.target.value)} placeholder="Короткое обращение" /></Field></div>
          <Field><Label>Телефон</Label><Input type="tel" inputMode="tel" placeholder="+7 (123) 123 12-12" value={form.phone} onChange={(e) => update('phone', formatPhoneInput(e.target.value))} /></Field>
          <Field><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></Field>
          <Field><Label>Заметки</Label><Textarea rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} /></Field>
        </FieldGroup></Fieldset><ErrorAlert>{error}</ErrorAlert></DialogBody>
        <DialogActions><Button type="button" plain onClick={onClose}>Отмена</Button><Button type="submit" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить'}</Button></DialogActions>
      </form>
    </Dialog>
  )
}
