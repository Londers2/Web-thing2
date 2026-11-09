import type { OrderStatus, TaskType } from './types'

export const statusLabels: Record<OrderStatus, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  done: 'Завершён',
  cancelled: 'Отменён',
}

export const statusColors: Record<OrderStatus, 'blue' | 'amber' | 'lime' | 'zinc'> = {
  new: 'blue',
  in_progress: 'amber',
  done: 'lime',
  cancelled: 'zinc',
}

export const taskTypeLabels: Record<TaskType, string> = {
  measurement: 'Замер',
  delivery: 'Доставка',
  assembly: 'Сборка',
  complaint: 'Рекламация',
}

export const taskTypeColors: Record<TaskType, 'cyan' | 'amber' | 'violet' | 'red'> = {
  measurement: 'cyan',
  delivery: 'amber',
  assembly: 'violet',
  complaint: 'red',
}

export function formatDate(value: string | null | undefined, includeYear = true) {
  if (!value) return 'Не указан'
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', ...(includeYear ? { year: 'numeric' } : {}) }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value))
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value)
}

export function formatAmountInput(value: string) {
  const normalized = value.replace(/[^\d.,]/g, '').replace('.', ',')
  const [integer = '', ...decimalParts] = normalized.split(',')
  const grouped = integer.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return decimalParts.length ? `${grouped},${decimalParts.join('').slice(0, 2)}` : grouped
}

export function parseAmount(value: string) {
  return Number(value.replace(/\s/g, '').replace(',', '.')) || 0
}

export function formatPhoneInput(value: string) {
  if (!value) return ''
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`
  if (!digits.startsWith('7')) digits = `7${digits}`
  digits = digits.slice(0, 11)
  const local = digits.slice(1)
  let result = '+7'
  if (local.length) result += ` (${local.slice(0, 3)}`
  if (local.length >= 3) result += ')'
  if (local.length > 3) result += ` ${local.slice(3, 6)}`
  if (local.length > 6) result += ` ${local.slice(6, 8)}`
  if (local.length > 8) result += `-${local.slice(8, 10)}`
  return result
}

export function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export function isOverdue(date: string, completed = false) {
  return !completed && new Date(`${date}T23:59:59`) < new Date()
}

export function formatDaysUntil(value: string | null) {
  if (!value) return ''
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const due = new Date(`${value}T00:00:00`)
  const days = Math.round((due.getTime() - start.getTime()) / 86400000)
  if (days === 0) return 'сегодня'
  if (days === 1) return 'завтра'
  if (days === -1) return 'вчера'
  return days > 0 ? `через ${days} дн.` : `${Math.abs(days)} дн. назад`
}
