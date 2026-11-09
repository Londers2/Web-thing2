import { useEffect, useState, type FormEvent } from 'react'
import { api, jsonBody } from '../api'
import { Button } from '../components/catalyst/button'
import { Divider } from '../components/catalyst/divider'
import { Description, Field, FieldGroup, Fieldset, Label } from '../components/catalyst/fieldset'
import { Heading, Subheading } from '../components/catalyst/heading'
import { Input } from '../components/catalyst/input'
import { ErrorAlert, Loading } from '../components/Loading'

interface Settings {
  assemblyPercent: number
  pageSize: number
}

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => { api<Settings>('/admin/settings').then(setSettings).catch((reason) => setError(reason.message)) }, [])
  if (!settings) return <><ErrorAlert>{error}</ErrorAlert><Loading /></>

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const saved = await api<Settings>('/admin/settings', { method: 'PATCH', body: jsonBody(settings) })
      setSettings(saved)
      setMessage('Глобальные настройки сохранены')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить настройки') }
    finally { setBusy(false) }
  }

  async function resetData() {
    if (window.prompt('Все данные и файлы будут удалены без возможности восстановления. Введите УДАЛИТЬ для подтверждения:') !== 'УДАЛИТЬ') return
    setBusy(true)
    try {
      await api('/admin/settings/reset-data', { method: 'POST' })
      window.location.assign('/login')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось очистить данные')
      setBusy(false)
    }
  }

  async function seedData() {
    if (!window.confirm('Заполнить сайт тестовыми данными? Продолжение возможно только на пустой базе.')) return
    setBusy(true)
    setError('')
    try {
      const result = await api<{ users: number; clients: number; orders: number; tasks: number; messages: number }>('/admin/settings/seed-data', { method: 'POST' })
      setMessage(`Добавлено: ${result.users} пользователей, ${result.clients} клиентов, ${result.orders} заказов, ${result.tasks} задач и ${result.messages} сообщений`)
      window.setTimeout(() => window.location.assign('/'), 1500)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось заполнить данные')
    } finally { setBusy(false) }
  }

  return (
    <div className="max-w-xl">
      <Heading>Настройки сайта</Heading><p className="mt-2 text-sm text-zinc-500">Глобальные переменные и стандартные значения для всех пользователей.</p>
      <form onSubmit={save} className="mt-8"><Subheading>Работа и отображение</Subheading><Divider className="my-4" /><Fieldset><FieldGroup className="space-y-6">
        <Field><Label>Процент стоимости сборки, %</Label><Input type="number" min="0" max="100" step="0.01" required value={settings.assemblyPercent} onChange={(event) => setSettings({ ...settings, assemblyPercent: Number(event.target.value) })} /><Description>Используется при автоматическом расчёте сборки от общей стоимости заказа.</Description></Field>
        <Field><Label>Записей на странице</Label><Input type="number" min="5" max="100" step="1" required value={settings.pageSize} onChange={(event) => setSettings({ ...settings, pageSize: Number(event.target.value) })} /><Description>Стандартная пагинация заказов и клиентов.</Description></Field>
      </FieldGroup></Fieldset><ErrorAlert>{error}</ErrorAlert>{message && <p className="mt-4 text-sm text-lime-700 dark:text-lime-400">{message}</p>}<Button type="submit" className="mt-6" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить настройки'}</Button></form>
      {import.meta.env.DEV && <section className="mt-12 rounded-xl border border-(--accent) p-5"><Subheading>Тестовые данные</Subheading><p className="mt-2 text-sm text-zinc-500">Заполнить сайт пользователями, клиентами, заказами, задачами, прайс-листами, сообщениями и медиа. Операция доступна только на пустой базе.</p><Button className="mt-4" disabled={busy} onClick={() => void seedData()}>Заполнить тестовыми данными</Button></section>}
      {import.meta.env.DEV && <section className="mt-12 rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/20"><Subheading>Опасная зона</Subheading><p className="mt-2 text-sm text-red-700 dark:text-red-300">Удалить все заказы, клиентов, пользователей, сообщения, прайс-листы и загруженные файлы. Администратор из `.env` будет создан заново.</p><Button color="red" className="mt-4" disabled={busy} onClick={() => void resetData()}>Очистить все данные</Button></section>}
    </div>
  )
}
