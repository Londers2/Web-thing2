import { Router } from 'express'
import { z } from 'zod'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { ensureInitialAdmin, pool } from './db'
import { HttpError, requireAdmin } from './auth'
import { seedDemoData } from './seed'

export const adminSettingsRouter = Router()

export async function getNumberSetting(key: string, fallback: number) {
  const { rows } = await pool.query('SELECT value FROM app_settings WHERE key = $1', [key])
  const value = Number(rows[0]?.value)
  return Number.isFinite(value) ? value : fallback
}

adminSettingsRouter.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const [assemblyPercent, pageSize] = await Promise.all([getNumberSetting('assembly_percent', 10), getNumberSetting('page_size', 10)])
    res.json({ assemblyPercent, pageSize })
  } catch (error) { next(error) }
})

adminSettingsRouter.patch('/', requireAdmin, async (req, res, next) => {
  try {
    const input = z.object({ assemblyPercent: z.number().min(0).max(100), pageSize: z.number().int().min(5).max(100) }).parse(req.body)
    await Promise.all([
      pool.query('INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['assembly_percent', String(input.assemblyPercent)]),
      pool.query('INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['page_size', String(input.pageSize)]),
    ])
    res.json(input)
  } catch (error) { next(error) }
})

adminSettingsRouter.post('/reset-data', requireAdmin, async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') return next(new HttpError(404, 'Операция доступна только в режиме разработки'))
  try {
    await pool.query('BEGIN')
    await pool.query(`TRUNCATE TABLE
      order_activities, order_price_items, order_images, task_members, tasks,
      message_reactions, message_reads, messages, order_members, orders,
      price_list_items, price_lists, clients, unavailable_days, app_settings,
      session, users RESTART IDENTITY CASCADE`)
    await pool.query('COMMIT')
    await pool.query("INSERT INTO app_settings (key, value) VALUES ('assembly_percent', '10'), ('page_size', '10')")
    await ensureInitialAdmin()
    await Promise.all(['uploads', 'avatars', 'message-files'].map(async (directory) => {
      const target = path.resolve('data', directory)
      await rm(target, { recursive: true, force: true })
      await mkdir(target, { recursive: true })
    }))
    req.session.destroy(() => res.status(204).end())
  } catch (error) {
    await pool.query('ROLLBACK')
    next(error)
  }
})

adminSettingsRouter.post('/seed-data', requireAdmin, async (_req, res, next) => {
  if (process.env.NODE_ENV === 'production') return next(new HttpError(404, 'Операция доступна только в режиме разработки'))
  try {
    res.json(await seedDemoData())
  } catch (error) {
    if (error instanceof Error && error.message.includes('дубликатов')) return next(new HttpError(409, error.message))
    next(error)
  }
})
