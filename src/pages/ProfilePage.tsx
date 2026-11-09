import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, jsonBody } from '../api'
import { useAuth } from '../auth'
import type { Stats, User } from '../types'
import { Button } from '../components/catalyst/button'
import { Divider } from '../components/catalyst/divider'
import { DescriptionDetails, DescriptionList, DescriptionTerm } from '../components/catalyst/description-list'
import { Field, FieldGroup, Fieldset, Label } from '../components/catalyst/fieldset'
import { Heading, Subheading } from '../components/catalyst/heading'
import { Input } from '../components/catalyst/input'
import { Checkbox } from '../components/catalyst/checkbox'
import { ErrorAlert, Loading } from '../components/Loading'
import { StatsView } from '../components/StatsView'
import { UserAvatar } from '../components/UserAvatar'

const tabs = [
  { id: 'info', label: 'Информация об аккаунте' },
  { id: 'stats', label: 'Статистика' },
  { id: 'settings', label: 'Настройки аккаунта' },
]
const roleLabels = { manager: 'Менеджер', assembler: 'Сборщик', measurer: 'Замерщик' }
const palettes = [
  { id: 'blue', label: 'Синий', className: 'bg-blue-600' },
  { id: 'emerald', label: 'Изумрудный', className: 'bg-emerald-600' },
  { id: 'violet', label: 'Фиолетовый', className: 'bg-violet-600' },
  { id: 'amber', label: 'Янтарный', className: 'bg-amber-500' },
  { id: 'rose', label: 'Розовый', className: 'bg-rose-600' },
]

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState('info')
  const [stats, setStats] = useState<Stats | null>(null)
  const [name, setName] = useState(user?.name || '')
  const [jobRoles, setJobRoles] = useState<NonNullable<User['jobRoles']>>(user?.jobRoles || [user?.jobRole || 'manager'])
  const [accentColor, setAccentColor] = useState(user?.accentColor || 'blue')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api<Stats>('/stats').then(setStats).catch((reason) => setError(reason.message))
  }, [])

  if (!user) return null

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = await api<{ user: User }>('/profile', {
        method: 'PATCH',
        body: jsonBody({ name, jobRoles, accentColor, currentPassword: currentPassword || undefined, newPassword: newPassword || undefined }),
      })
      setUser(data.user)
      setCurrentPassword('')
      setNewPassword('')
      setMessage('Настройки сохранены')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить настройки')
    } finally {
      setBusy(false)
    }
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file) return
    const body = new FormData()
    body.append('avatar', file)
    try {
      const data = await api<{ user: User }>('/profile/avatar', { method: 'POST', body })
      setUser(data.user)
      setMessage('Аватар обновлён')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось загрузить аватар')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeAvatar() {
    const data = await api<{ user: User }>('/profile/avatar', { method: 'DELETE' })
    setUser(data.user)
  }

  return (
    <>
      <Heading>Мой профиль</Heading>
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-zinc-950/10 dark:border-white/10">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${tab === item.id ? 'border-zinc-900 text-zinc-950 dark:border-white dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <section className="mt-8 max-w-2xl">
          <div className="flex items-center gap-5">
            <UserAvatar user={user} className="size-24" square />
            <div>
              <div className="text-xl font-semibold">{user.name}</div>
              <div className="mt-1 text-sm text-zinc-500">{user.email}</div>
              <span className="mt-2 inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium dark:bg-zinc-800">{(jobRoles || ['manager']).map((role) => roleLabels[role]).join(', ')}</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" className="hidden" onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
            <Button outline onClick={() => fileRef.current?.click()}>Загрузить фото</Button>
            {user.avatarUrl && <Button plain onClick={() => void removeAvatar()}>Сбросить фото</Button>}
          </div>
          <Divider className="my-6" />
          <DescriptionList>
            <DescriptionTerm>Email</DescriptionTerm>
            <DescriptionDetails>{user.email}</DescriptionDetails>
            <DescriptionTerm>Системная роль</DescriptionTerm>
            <DescriptionDetails>{user.role === 'admin' ? 'Администратор' : 'Сотрудник'}</DescriptionDetails>
            <DescriptionTerm>Роль в команде</DescriptionTerm>
            <DescriptionDetails>{(jobRoles || ['manager']).map((role) => roleLabels[role]).join(', ')}</DescriptionDetails>
          </DescriptionList>
        </section>
      )}

      {tab === 'stats' && <section className="mt-8">{stats ? <StatsView stats={stats} /> : <Loading />}</section>}

      {tab === 'settings' && (
        <section className="mt-8 max-w-xl">
          <Subheading>Настройки аккаунта</Subheading>
          <Divider className="my-4" />
          <form onSubmit={save}>
            <Fieldset>
              <FieldGroup className="space-y-6">
                <Field>
                  <Label>Имя</Label>
                  <Input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} />
                </Field>
                <Field>
                  <Label>Роли в команде</Label>
                  <div className="mt-3 space-y-2">{Object.entries(roleLabels).map(([role, label]) => (
                    <label key={role} className="flex items-center gap-3 text-sm">
                      <Checkbox
                        checked={jobRoles.includes(role as NonNullable<User['jobRole']>)}
                        disabled={jobRoles.length === 1 && jobRoles.includes(role as NonNullable<User['jobRole']>)}
                        onChange={(checked) => setJobRoles((current) => checked ? [...current, role as NonNullable<User['jobRole']>] : current.filter((item) => item !== role))}
                      />
                      {label}
                    </label>
                  ))}</div>
                </Field>
                <Field>
                  <Label>Цветовая палитра</Label>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {palettes.map((palette) => (
                      <button
                        key={palette.id}
                        type="button"
                        title={palette.label}
                        aria-label={palette.label}
                        onClick={() => setAccentColor(palette.id)}
                        className={`size-9 rounded-full ${palette.className} ${accentColor === palette.id ? 'ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-900' : 'ring-1 ring-black/10'}`}
                      />
                    ))}
                  </div>
                </Field>
                <Field>
                  <Label>Новый пароль</Label>
                  <Input type="password" autoComplete="new-password" minLength={10} placeholder="Не менее 10 символов" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                </Field>
                {newPassword && (
                  <Field>
                    <Label>Текущий пароль</Label>
                    <Input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                  </Field>
                )}
              </FieldGroup>
            </Fieldset>
            <ErrorAlert>{error}</ErrorAlert>
            {message && <p className="mt-4 text-sm text-lime-700 dark:text-lime-400">{message}</p>}
            <Button type="submit" className="mt-6" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить настройки'}</Button>
          </form>
        </section>
      )}
    </>
  )
}
