import { Router } from 'express'
import { z } from 'zod'
import { pool } from './db'

export const calendarRouter = Router()

calendarRouter.get('/', async (req, res, next) => {
  try {
    const { month, start, end } = z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).parse(req.query)
    const startDate = start || `${month}-01`
    const endDate = end || `${month}-01`
    const { rows } = await pool.query(
      `SELECT tasks.id, tasks.title, tasks.task_type AS "taskType", tasks.due_date AS "dueDate", tasks.completed,
        tasks.created_by AS "createdBy", tasks.created_at AS "createdAt",
        orders.id AS "orderId", orders.title AS "orderTitle", orders.number::int AS "orderNumber",
        COALESCE((
          SELECT json_agg(json_build_object('id', users.id, 'name', users.name, 'email', users.email, 'avatarUrl', users.avatar_url))
          FROM task_members JOIN users ON users.id = task_members.user_id WHERE task_members.task_id = tasks.id
        ), '[]') AS assignees
       FROM tasks
       JOIN orders ON orders.id = tasks.order_id
       JOIN order_members ON order_members.order_id = orders.id AND order_members.user_id = $1
       WHERE tasks.due_date >= $2::date
         AND tasks.due_date < ${end ? '$3::date' : "($2::date + interval '1 month')::date"}
       ORDER BY tasks.due_date, tasks.created_at`,
      [req.user!.id, startDate, endDate]
    )
    res.json(rows)
  } catch (error) { next(error) }
})

calendarRouter.get('/weeks', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT tasks.id, tasks.title, tasks.task_type AS "taskType", tasks.due_date AS "dueDate", tasks.completed,
        tasks.created_by AS "createdBy", tasks.created_at AS "createdAt",
        orders.id AS "orderId", orders.title AS "orderTitle", orders.number::int AS "orderNumber",
        COALESCE((
          SELECT json_agg(json_build_object('id', users.id, 'name', users.name, 'email', users.email, 'avatarUrl', users.avatar_url))
          FROM task_members JOIN users ON users.id = task_members.user_id WHERE task_members.task_id = tasks.id
        ), '[]') AS assignees
       FROM tasks
       JOIN orders ON orders.id = tasks.order_id
       JOIN order_members ON order_members.order_id = orders.id AND order_members.user_id = $1
       WHERE tasks.due_date >= date_trunc('week', CURRENT_DATE)::date
         AND tasks.due_date < (date_trunc('week', CURRENT_DATE)::date + interval '4 weeks')::date
       ORDER BY tasks.due_date, tasks.created_at`,
      [req.user!.id]
    )
    res.json(rows)
  } catch (error) { next(error) }
})

calendarRouter.get('/availability', async (req, res, next) => {
  try {
    if (!req.user!.jobRoles?.includes('manager')) return res.status(403).json({ error: 'Режим доступен менеджеру' })
    const { week } = z.object({ week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.query)
    const { rows } = await pool.query(
      `SELECT users.id AS user_id, users.name, users.avatar_url AS "avatarUrl", to_char(days.date, 'YYYY-MM-DD') AS date,
        EXISTS(
          SELECT 1 FROM tasks JOIN task_members ON task_members.task_id = tasks.id
          WHERE task_members.user_id = users.id AND tasks.due_date = days.date
        ) OR EXISTS(SELECT 1 FROM unavailable_days WHERE unavailable_days.user_id = users.id AND unavailable_days.date = days.date) AS busy
       FROM users CROSS JOIN generate_series($1::date, $1::date + interval '6 days', interval '1 day') AS days(date)
       WHERE users.active AND 'assembler' = ANY(users.job_roles)
       ORDER BY users.name, days.date`,
      [week]
    )
    const users = new Map<string, any>()
    for (const row of rows) {
      if (!users.has(row.user_id)) users.set(row.user_id, { id: row.user_id, name: row.name, avatarUrl: row.avatarUrl, days: [] })
      users.get(row.user_id).days.push({ date: row.date, busy: row.busy })
    }
    res.json([...users.values()])
  } catch (error) { next(error) }
})

calendarRouter.get('/availability/days', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT date::text AS date, reason FROM unavailable_days WHERE user_id = $1 ORDER BY date', [req.user!.id])
    res.json(rows)
  } catch (error) { next(error) }
})

calendarRouter.post('/availability/days', async (req, res, next) => {
  try {
    if (!req.user!.jobRoles?.includes('assembler')) return res.status(403).json({ error: 'Недоступные дни отмечает сборщик' })
    const input = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().trim().max(300).optional() }).parse(req.body)
    await pool.query('INSERT INTO unavailable_days (user_id, date, reason) VALUES ($1, $2, $3) ON CONFLICT (user_id, date) DO UPDATE SET reason = $3', [req.user!.id, input.date, input.reason || null])
    res.status(201).json(input)
  } catch (error) { next(error) }
})

calendarRouter.delete('/availability/days/:date', async (req, res, next) => {
  try {
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.params.date)
    await pool.query('DELETE FROM unavailable_days WHERE user_id = $1 AND date = $2', [req.user!.id, date])
    res.status(204).end()
  } catch (error) { next(error) }
})
