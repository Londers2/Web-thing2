import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Button } from '../components/catalyst/button'
import { Field, FieldGroup, Fieldset, Label } from '../components/catalyst/fieldset'
import { Input } from '../components/catalyst/input'
import { ErrorAlert } from '../components/Loading'

export function LoginPage() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось войти')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-zinc-100 p-6 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-950/5 sm:p-10 dark:bg-zinc-900 dark:ring-white/10">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-900 dark:bg-white">
            <span className="flex h-5 w-5 flex-col justify-between py-1">
              <span className="h-0.5 rounded bg-white dark:bg-zinc-900" />
              <span className="h-0.5 rounded bg-white dark:bg-zinc-900" />
              <span className="h-0.5 w-3 rounded bg-white dark:bg-zinc-900" />
            </span>
          </span>
          <span className="text-xl font-semibold tracking-tight">Порядок</span>
        </div>
        <h1 className="mt-10 text-2xl/8 font-semibold tracking-tight">С возвращением</h1>
        <p className="mt-2 text-sm/6 text-zinc-500">Войдите в рабочее пространство вашей команды.</p>
        <form onSubmit={submit} className="mt-8">
          <Fieldset>
            <FieldGroup className="space-y-6">
              <Field>
                <Label>Email</Label>
                <Input type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.ru" />
              </Field>
              <Field>
                <Label>Пароль</Label>
                <Input type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </FieldGroup>
          </Fieldset>
          <ErrorAlert>{error}</ErrorAlert>
          <Button type="submit" className="mt-6 w-full" disabled={busy}>{busy ? 'Вход…' : 'Войти'}</Button>
        </form>
      </div>
    </main>
  )
}
