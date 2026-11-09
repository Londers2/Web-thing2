import { useEffect, useState, type FormEvent } from 'react'
import { api, jsonBody } from '../api'
import type { User } from '../types'
import { Button } from './catalyst/button'
import { Dialog, DialogActions, DialogBody, DialogDescription, DialogTitle } from './catalyst/dialog'
import { Field, FieldGroup, Fieldset, Label } from './catalyst/fieldset'
import { Input } from './catalyst/input'
import { Select } from './catalyst/select'
import { ErrorAlert } from './Loading'

export function UserFormDialog({ open, onClose, user, onSaved }: { open: boolean; onClose: () => void; user?: User | null; onSaved: (user: User) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>('user')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setName(user?.name || '')
      setEmail(user?.email || '')
      setPassword('')
      setRole(user?.role || 'user')
      setError('')
    }
  }, [open, user])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const saved = await api<User>(user ? `/users/${user.id}` : '/users', { method: user ? 'PATCH' : 'POST', body: jsonBody({ name, email, role, ...(password ? { password } : {}) }) })
      onSaved(saved)
      onClose()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить пользователя') }
    finally { setBusy(false) }
  }

  return <Dialog open={open} onClose={onClose}><DialogTitle>{user ? 'Изменить пользователя' : 'Новый пользователь'}</DialogTitle><DialogDescription>{user ? 'Оставьте пароль пустым, если менять его не нужно.' : 'Передайте сотруднику данные для входа по защищённому каналу.'}</DialogDescription><form onSubmit={submit}><DialogBody><Fieldset><FieldGroup className="space-y-6">
    <Field><Label>Имя</Label><Input required autoFocus minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></Field>
    <Field><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
    <Field><Label>{user ? 'Новый пароль' : 'Пароль'}</Label><Input type="password" required={!user} minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Не менее 10 символов" /></Field>
    <Field><Label>Роль</Label><Select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'user')}><option value="user">Сотрудник</option><option value="admin">Администратор</option></Select></Field>
  </FieldGroup></Fieldset><ErrorAlert>{error}</ErrorAlert></DialogBody><DialogActions><Button plain type="button" onClick={onClose}>Отмена</Button><Button type="submit" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить'}</Button></DialogActions></form></Dialog>
}
