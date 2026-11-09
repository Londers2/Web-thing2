import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { pool } from './db'
import { HttpError, publicUser, requireAdmin, requireAuth, type AuthUser } from './auth'
import { emailSchema, idSchema, passwordSchema, clientInputSchema } from './validation'
import { ordersRouter } from './orders'
import { calendarRouter } from './calendar'
import { messengerRouter } from './messenger'
import { profilesRouter } from './profiles'
import { priceListsRouter } from './price-lists'
import { geoRouter } from './geo'
import { adminSettingsRouter, getNumberSetting } from './settings'

export const apiRouter = Router()

apiRouter.post('/auth/login', async (req, res, next) => {
  try {
    const input = z.object({ email: emailSchema, password: z.string().min(1) }).parse(req.body)
    const { rows } = await pool.query<(AuthUser & { password_hash: string })>(
      'SELECT id, name, email, role, active, password_hash, avatar_url AS "avatarUrl", job_role AS "jobRole", job_roles AS "jobRoles", accent_color AS "accentColor" FROM users WHERE email = $1',
      [input.email]
    )
    const user = rows[0]
    if (!user || !user.active || !(await bcrypt.compare(input.password, user.password_hash))) {
      throw new HttpError(401, 'Неверный email или пароль')
    }
    await new Promise<void>((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()))
    req.session.userId = user.id
    await new Promise<void>((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()))
    res.json({ user: publicUser(user) })
  } catch (error) { next(error) }
})

apiRouter.get('/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user!) }))
apiRouter.post('/auth/logout', requireAuth, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error)
    res.clearCookie('connect.sid')
    res.status(204).end()
  })
})

apiRouter.use(requireAuth)
apiRouter.use('/calendar', calendarRouter)
apiRouter.use(messengerRouter)
apiRouter.use(profilesRouter)
apiRouter.use('/price-lists', priceListsRouter)
apiRouter.use('/geo', geoRouter)
apiRouter.use('/admin/settings', adminSettingsRouter)

apiRouter.patch('/profile', async (req, res, next) => {
  try {
    const input = z.object({
      name: z.string().trim().min(2).max(120),
      jobRoles: z.array(z.enum(['manager', 'assembler', 'measurer'])).min(1),
      accentColor: z.enum(['zinc', 'blue', 'emerald', 'violet', 'amber', 'rose']),
      currentPassword: z.string().optional(),
      newPassword: passwordSchema.optional(),
    }).parse(req.body)
    if (input.newPassword) {
      const { rows } = await pool.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [req.user!.id])
      if (!input.currentPassword || !(await bcrypt.compare(input.currentPassword, rows[0].password_hash))) {
        throw new HttpError(400, 'Текущий пароль указан неверно')
      }
      const hash = await bcrypt.hash(input.newPassword, 12)
      await pool.query('UPDATE users SET name = $1, password_hash = $2, job_role = $3, job_roles = $4, accent_color = $5 WHERE id = $6', [input.name, hash, input.jobRoles[0], input.jobRoles, input.accentColor, req.user!.id])
    } else {
      await pool.query('UPDATE users SET name = $1, job_role = $2, job_roles = $3, accent_color = $4 WHERE id = $5', [input.name, input.jobRoles[0], input.jobRoles, input.accentColor, req.user!.id])
    }
    res.json({ user: { ...req.user!, name: input.name, jobRole: input.jobRoles[0], jobRoles: input.jobRoles, accentColor: input.accentColor } })
  } catch (error) { next(error) }
})

apiRouter.get('/users', async (req, res, next) => {
  try {
    const condition = req.user!.role === 'admin' ? '' : 'WHERE active = TRUE'
    const { rows } = await pool.query(`SELECT id, name, email, role, active, avatar_url AS "avatarUrl", job_role AS "jobRole", job_roles AS "jobRoles", created_at AS "createdAt" FROM users ${condition} ORDER BY name`)
    res.json(rows)
  } catch (error) { next(error) }
})

apiRouter.post('/users', requireAdmin, async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(2).max(120), email: emailSchema, password: passwordSchema, role: z.enum(['admin', 'user']).default('user') }).parse(req.body)
    const hash = await bcrypt.hash(input.password, 12)
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, active, avatar_url AS "avatarUrl", created_at AS "createdAt"',
      [input.name, input.email, hash, input.role]
    )
    res.status(201).json(rows[0])
  } catch (error) { next(error) }
})

apiRouter.patch('/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const input = z.object({
      name: z.string().trim().min(2).max(120).optional(),
      email: emailSchema.optional(),
      password: passwordSchema.optional(),
      role: z.enum(['admin', 'user']).optional(),
      active: z.boolean().optional(),
    }).refine((value) => Object.keys(value).length > 0).parse(req.body)
    if (id === req.user!.id && (input.active === false || (input.role && input.role !== 'admin'))) {
      throw new HttpError(400, 'Нельзя отключить или понизить собственную учётную запись')
    }
    const current = await pool.query<AuthUser>('SELECT id, name, email, role, active FROM users WHERE id = $1', [id])
    if (!current.rows[0]) throw new HttpError(404, 'Пользователь не найден')
    if (current.rows[0].role === 'admin' && (input.role === 'user' || input.active === false)) {
      const admins = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users WHERE role = 'admin' AND active = TRUE")
      if (Number(admins.rows[0].count) <= 1) throw new HttpError(400, 'В системе должен остаться хотя бы один активный администратор')
    }
    const hash = input.password ? await bcrypt.hash(input.password, 12) : undefined
    const { rows } = await pool.query(
      `UPDATE users SET name = COALESCE($2, name), email = COALESCE($3, email), role = COALESCE($4, role),
       active = COALESCE($5, active), password_hash = COALESCE($6, password_hash)
       WHERE id = $1 RETURNING id, name, email, role, active, avatar_url AS "avatarUrl", created_at AS "createdAt"`,
      [id, input.name ?? null, input.email ?? null, input.role ?? null, input.active ?? null, hash ?? null]
    )
    res.json(rows[0])
  } catch (error) { next(error) }
})

apiRouter.get('/clients', async (req, res, next) => {
  try {
    const { q, page } = z.object({ q: z.string().trim().max(200).optional(), page: z.coerce.number().int().min(1).optional() }).parse(req.query)
    const values: string[] = []
    let where = ''
    if (q) {
      values.push(`%${q}%`)
      where = 'WHERE name ILIKE $1 OR call_sign ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1'
    }
    const pageSize = await getNumberSetting('page_size', 10)
    const offset = page ? (page - 1) * pageSize : 0
    const { rows } = page
      ? await pool.query(`SELECT id, name, call_sign AS "callSign", email, phone, notes, created_at AS "createdAt" FROM clients ${where} ORDER BY name LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, offset])
      : await pool.query(`SELECT id, name, call_sign AS "callSign", email, phone, notes, created_at AS "createdAt" FROM clients ${where} ORDER BY name LIMIT 500`, values)
    if (page) {
      const count = await pool.query(`SELECT COUNT(*)::int AS count FROM clients ${where}`, values)
      res.json({ items: rows, total: count.rows[0].count, page, pages: Math.max(1, Math.ceil(count.rows[0].count / pageSize)) })
    } else {
      res.json(rows)
    }
  } catch (error) { next(error) }
})

apiRouter.post('/clients', async (req, res, next) => {
  try {
    const input = clientInputSchema.parse(req.body)
    const { rows } = await pool.query(
      `INSERT INTO clients (name, call_sign, email, phone, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, call_sign AS "callSign", email, phone, notes, created_at AS "createdAt"`,
      [input.name, input.callSign, input.email, input.phone, input.notes, req.user!.id]
    )
    res.status(201).json(rows[0])
  } catch (error) { next(error) }
})

apiRouter.patch('/clients/:id', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const input = clientInputSchema.parse(req.body)
    const { rows } = await pool.query(
      `UPDATE clients SET name = $2, call_sign = $3, email = $4, phone = $5, notes = $6 WHERE id = $1
       RETURNING id, name, call_sign AS "callSign", email, phone, notes, created_at AS "createdAt"`,
      [id, input.name, input.callSign, input.email, input.phone, input.notes]
    )
    if (!rows[0]) throw new HttpError(404, 'Клиент не найден')
    res.json(rows[0])
  } catch (error) { next(error) }
})

apiRouter.delete('/clients/:id', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const { rowCount } = await pool.query('DELETE FROM clients WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM orders WHERE client_id = $1)', [id])
    if (!rowCount) throw new HttpError(400, 'Клиент не найден или связан с заказами')
    res.status(204).end()
  } catch (error) { next(error) }
})

apiRouter.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const [totals, monthly, upcoming] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE orders.status = 'new')::int AS new,
          COUNT(*) FILTER (WHERE orders.status = 'in_progress')::int AS "inProgress",
          COUNT(*) FILTER (WHERE orders.status = 'done')::int AS done,
          COUNT(*) FILTER (WHERE orders.status = 'cancelled')::int AS cancelled,
          COUNT(*) FILTER (WHERE orders.creator_id = $1)::int AS created,
          COALESCE(SUM(orders.amount) FILTER (WHERE orders.status != 'cancelled'), 0)::float8 AS amount
         FROM orders JOIN order_members ON order_members.order_id = orders.id AND order_members.user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT to_char(months.month, 'YYYY-MM') AS month,
          COUNT(orders.id)::int AS orders,
          COUNT(orders.id) FILTER (WHERE orders.status = 'done')::int AS done
         FROM generate_series(date_trunc('month', CURRENT_DATE) - interval '5 months', date_trunc('month', CURRENT_DATE), interval '1 month') AS months(month)
         LEFT JOIN orders ON date_trunc('month', orders.created_at) = months.month
          AND EXISTS (SELECT 1 FROM order_members WHERE order_id = orders.id AND user_id = $1)
         GROUP BY months.month ORDER BY months.month`,
        [userId]
      ),
      pool.query(
        `SELECT tasks.id, tasks.title, tasks.task_type AS "taskType", tasks.due_date AS "dueDate", tasks.completed,
          tasks.created_by AS "createdBy", tasks.created_at AS "createdAt",
          orders.id AS "orderId", orders.title AS "orderTitle", orders.number::int AS "orderNumber"
         FROM tasks JOIN orders ON orders.id = tasks.order_id
         JOIN order_members ON order_members.order_id = orders.id AND order_members.user_id = $1
         WHERE tasks.completed = FALSE ORDER BY tasks.due_date LIMIT 8`,
        [userId]
      ),
    ])
    const tasks = await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE completed)::int AS completed
       FROM tasks JOIN order_members ON order_members.order_id = tasks.order_id AND order_members.user_id = $1`,
      [userId]
    )
    let amount = totals.rows[0].amount
    if (req.user!.jobRoles?.includes('assembler') && !req.user!.jobRoles.includes('manager')) {
      const percent = await getNumberSetting('assembly_percent', 10)
      const earnings = await pool.query(
        `SELECT COALESCE(SUM(COALESCE(orders.assembly_amount, orders.amount * $2 / 100) + COALESCE((
          SELECT SUM(price_list_items.price) FROM order_price_items
          JOIN price_list_items ON price_list_items.id = order_price_items.price_item_id
          WHERE order_price_items.order_id = orders.id AND order_price_items.completed
        ), 0)), 0)::float8 AS amount
         FROM orders JOIN order_members ON order_members.order_id = orders.id AND order_members.user_id = $1
         WHERE orders.status != 'cancelled'`,
        [userId, percent]
      )
      amount = earnings.rows[0].amount
    }
    res.json({ ...totals.rows[0], amount, tasks: tasks.rows[0], monthly: monthly.rows, upcoming: upcoming.rows })
  } catch (error) { next(error) }
})

apiRouter.use('/orders', ordersRouter)
