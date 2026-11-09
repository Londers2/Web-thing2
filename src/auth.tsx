import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, jsonBody } from './api'
import type { User } from './types'
import { applyAccent } from './accent'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<{ user: User }>('/auth/me').then((data) => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false))
    const unauthorized = () => setUser(null)
    window.addEventListener('auth:unauthorized', unauthorized)
    return () => window.removeEventListener('auth:unauthorized', unauthorized)
  }, [])

  useEffect(() => {
    if (user) applyAccent(user.accentColor)
  }, [user])

  async function login(email: string, password: string) {
    const data = await api<{ user: User }>('/auth/login', { method: 'POST', body: jsonBody({ email, password }) })
    setUser(data.user)
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
