import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import multer from 'multer'
import { z } from 'zod'
import { pool } from './db'
import { HttpError } from './auth'
import { assertOrderAccess, orderAccessSql } from './access'
import { idSchema, orderInputSchema } from './validation'
import { mapOrder, orderSelect } from './format'
import { messageSelect, withMessageMetadata } from './message-service'
import { logActivity } from './activity'
import { getNumberSetting } from './settings'

export const ordersRouter = Router()
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './data/uploads')
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => mkdir(uploadDir, { recursive: true }).then(() => callback(null, uploadDir), (error) => callback(error, uploadDir)),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase().slice(0, 10)}`),
  }),
  fileFilter: (_req, file, callback) => callback(null, /^image\/(jpeg|png|gif|webp|avif)$/.test(file.mimetype)),
})
const taskTypeSchema = z.enum(['measurement', 'delivery', 'assembly', 'complaint'])

async function getOrder(id: string, userId: string) {
  const { rows } = await pool.query(`${orderSelect} WHERE orders.id = $2 AND ${orderAccessSql}`, [userId, id])
  if (!rows[0]) throw new HttpError(404, 'Заказ не найден')
  return mapOrder(rows[0])
}

ordersRouter.get('/', async (req, res, next) => {
  try {
    const filters = z.object({ q: z.string().trim().max(200).optional(), status: z.enum(['new', 'in_progress', 'done', 'cancelled']).optional(), page: z.coerce.number().int().min(1).optional() }).parse(req.query)
    const values: any[] = [req.user!.id]
    let where = `WHERE ${orderAccessSql}`
    if (filters.status) {
      values.push(filters.status)
      where += ` AND orders.status = $${values.length}`
    }
    if (filters.q) {
      values.push(`%${filters.q}%`)
      where += ` AND (orders.title ILIKE $${values.length} OR orders.number::text = $${values.length + 1} OR clients.name ILIKE $${values.length})`
      values.push(filters.q.replace(/^#/, ''))
    }
    const pageSize = await getNumberSetting('page_size', 10)
    const offset = filters.page ? (filters.page - 1) * pageSize : 0
    const rowsQuery = `SELECT accessible.*,
       (SELECT COUNT(*) FROM tasks WHERE tasks.order_id = accessible.id)::int AS task_total,
       (SELECT COUNT(*) FROM tasks WHERE tasks.order_id = accessible.id AND completed)::int AS task_done,
       (SELECT COUNT(*) FROM order_images WHERE order_images.order_id = accessible.id)::int AS image_count
       FROM (${orderSelect} ${where}) AS accessible
       ORDER BY accessible.created_at DESC`
    const { rows } = filters.page
      ? await pool.query(`${rowsQuery} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, offset])
      : await pool.query(`${rowsQuery} LIMIT 500`, values)
    if (filters.page) {
      const count = await pool.query(`SELECT COUNT(*)::int AS count FROM orders JOIN clients ON clients.id = orders.client_id ${where}`, values)
      res.json({ items: rows.map(mapOrder), total: count.rows[0].count, page: filters.page, pages: Math.max(1, Math.ceil(count.rows[0].count / pageSize)) })
    } else {
      res.json(rows.map(mapOrder))
    }
  } catch (error) { next(error) }
})

ordersRouter.post('/', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const input = orderInputSchema.parse(req.body)
    await client.query('BEGIN')
    const clientExists = await client.query('SELECT 1 FROM clients WHERE id = $1', [input.clientId])
    if (!clientExists.rowCount) throw new HttpError(400, 'Клиент не найден')
    const memberIds = [...new Set([req.user!.id, ...input.memberIds])]
    const members = await client.query('SELECT id FROM users WHERE id = ANY($1::uuid[]) AND active = TRUE', [memberIds])
    if (members.rowCount !== memberIds.length) throw new HttpError(400, 'Один из участников недоступен')
    const editorIds = new Set(input.editorIds)
    const assemblyPercent = await getNumberSetting('assembly_percent', 10)
    const assemblyAmount = input.assemblyAmount ?? Number((input.amount * assemblyPercent / 100).toFixed(2))
    const { rows } = await client.query(
      `INSERT INTO orders (title, description, address, address_lat, address_lng, status, amount, advance_amount, assembly_amount, client_id, creator_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [input.title, input.description, input.address, input.addressLat, input.addressLng, input.status, input.amount, input.advanceAmount, assemblyAmount, input.clientId, req.user!.id]
    )
    for (const userId of memberIds) {
      await client.query('INSERT INTO order_members (order_id, user_id, can_edit) VALUES ($1, $2, $3)', [rows[0].id, userId, userId === req.user!.id || editorIds.has(userId)])
    }
    await logActivity(rows[0].id, req.user!.id, 'created', 'создал заказ', client)
    await client.query('COMMIT')
    res.status(201).json(await getOrder(rows[0].id, req.user!.id))
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally { client.release() }
})

const taskSelect = `
  SELECT tasks.id, tasks.title, tasks.task_type AS "taskType", tasks.due_date AS "dueDate", tasks.completed,
    tasks.created_by AS "createdBy", tasks.created_at AS "createdAt",
    COALESCE((
      SELECT json_agg(json_build_object('id', users.id, 'name', users.name, 'email', users.email, 'avatarUrl', users.avatar_url) ORDER BY users.name)
      FROM task_members JOIN users ON users.id = task_members.user_id WHERE task_members.task_id = tasks.id
    ), '[]') AS assignees
  FROM tasks
`

async function getTask(taskId: string) {
  const { rows } = await pool.query(`${taskSelect} WHERE tasks.id = $1`, [taskId])
  return rows[0]
}

async function validateTaskMembers(client: any, orderId: string, memberIds: string[]) {
  if (!memberIds.length) return
  const { rowCount } = await client.query(
    'SELECT user_id FROM order_members JOIN users ON users.id = order_members.user_id AND users.active = TRUE WHERE order_members.order_id = $1 AND order_members.user_id = ANY($2::uuid[])',
    [orderId, memberIds]
  )
  if (rowCount !== memberIds.length) throw new HttpError(400, 'Исполнители должны быть участниками заказа')
}

async function getOrderPriceList(orderId: string, priceListId: string | null) {
  if (!priceListId) return { priceList: null, priceTotal: 0 }
  const { rows } = await pool.query('SELECT id, title, print_title AS "printTitle", notes, created_at AS "createdAt", updated_at AS "updatedAt" FROM price_lists WHERE id = $1', [priceListId])
  if (!rows[0]) return { priceList: null, priceTotal: 0 }
  const items = await pool.query(
    `SELECT items.id, items.kind, items.category, items.name, items.price::float8, items.position,
      COALESCE(order_price_items.completed, FALSE) AS completed
     FROM price_list_items items
     LEFT JOIN order_price_items ON order_price_items.price_item_id = items.id AND order_price_items.order_id = $2
     WHERE items.list_id = $1 ORDER BY items.position`,
    [priceListId, orderId]
  )
  return { priceList: { ...rows[0], items: items.rows }, priceTotal: items.rows.filter((item) => item.completed).reduce((sum, item) => sum + item.price, 0) }
}

ordersRouter.get('/:id', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const order = await getOrder(id, req.user!.id)
    const [tasks, images, price] = await Promise.all([
      pool.query(`${taskSelect} WHERE tasks.order_id = $1 ORDER BY tasks.due_date, tasks.created_at`, [id]),
      pool.query(`SELECT id, original_name AS "originalName", mime_type AS "mimeType", size, uploaded_by AS "uploadedBy", created_at AS "createdAt" FROM order_images WHERE order_id = $1 ORDER BY created_at DESC`, [id]),
      getOrderPriceList(id, order.priceListId),
    ])
    res.json({ ...order, tasks: tasks.rows, images: images.rows, ...price })
  } catch (error) { next(error) }
})

ordersRouter.patch('/:id/price-list', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const access = await assertOrderAccess(id, req.user!.id)
    if (access.creator_id !== req.user!.id && !access.can_edit) throw new HttpError(403, 'Недостаточно прав для изменения заказа')
    const { priceListId } = z.object({ priceListId: idSchema.nullable() }).parse(req.body)
    if (priceListId) {
      const exists = await pool.query('SELECT 1 FROM price_lists WHERE id = $1', [priceListId])
      if (!exists.rowCount) throw new HttpError(404, 'Прайс-лист не найден')
    }
    await pool.query('UPDATE orders SET price_list_id = $2, updated_at = NOW() WHERE id = $1', [id, priceListId])
    await logActivity(id, req.user!.id, 'price', priceListId ? 'прикрепил прайс-лист' : 'открепил прайс-лист')
    res.json(await getOrderPriceList(id, priceListId))
  } catch (error) { next(error) }
})

ordersRouter.patch('/:id/price-items/:itemId', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const itemId = idSchema.parse(req.params.itemId)
    await assertOrderAccess(id, req.user!.id)
    const { completed } = z.object({ completed: z.boolean() }).parse(req.body)
    const { rows } = await pool.query('SELECT items.name FROM price_list_items items JOIN orders ON orders.price_list_id = items.list_id WHERE orders.id = $1 AND items.id = $2', [id, itemId])
    if (!rows[0]) throw new HttpError(404, 'Услуга не найдена в прикреплённом прайс-листе')
    await pool.query(
      `INSERT INTO order_price_items (order_id, price_item_id, completed, updated_by, updated_at) VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (order_id, price_item_id) DO UPDATE SET completed = $3, updated_by = $4, updated_at = NOW()`,
      [id, itemId, completed, req.user!.id]
    )
    await logActivity(id, req.user!.id, 'price', `${completed ? 'отметил выполненной' : 'вернул в работу'} услугу «${rows[0].name}»`)
    const order = await getOrder(id, req.user!.id)
    res.json(await getOrderPriceList(id, order.priceListId))
  } catch (error) { next(error) }
})

ordersRouter.get('/:id/activities', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    await assertOrderAccess(id, req.user!.id)
    const { rows } = await pool.query(
      `SELECT order_activities.id, order_activities.action, order_activities.body, order_activities.created_at AS "createdAt",
        CASE WHEN users.id IS NULL THEN NULL ELSE json_build_object('id', users.id, 'name', users.name, 'avatarUrl', users.avatar_url) END AS user
       FROM order_activities LEFT JOIN users ON users.id = order_activities.user_id
       WHERE order_activities.order_id = $1 ORDER BY order_activities.created_at DESC LIMIT 300`, [id]
    )
    res.json(rows)
  } catch (error) { next(error) }
})

ordersRouter.patch('/:id', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const id = idSchema.parse(req.params.id)
    const access = await assertOrderAccess(id, req.user!.id)
    if (access.creator_id !== req.user!.id && !access.can_edit) throw new HttpError(403, 'Недостаточно прав для изменения заказа')
    const input = orderInputSchema.parse(req.body)
    await client.query('BEGIN')
    const clientExists = await client.query('SELECT 1 FROM clients WHERE id = $1', [input.clientId])
    if (!clientExists.rowCount) throw new HttpError(400, 'Клиент не найден')
    const memberIds = [...new Set([req.user!.id, ...input.memberIds])]
    const members = await client.query('SELECT id FROM users WHERE id = ANY($1::uuid[]) AND active = TRUE', [memberIds])
    if (members.rowCount !== memberIds.length) throw new HttpError(400, 'Один из участников недоступен')
    const editorIds = new Set(input.editorIds)
    const assemblyPercent = await getNumberSetting('assembly_percent', 10)
    const assemblyAmount = input.assemblyAmount ?? Number((input.amount * assemblyPercent / 100).toFixed(2))
    await client.query(
      `UPDATE orders SET title = $2, description = $3, address = $4, address_lat = $5, address_lng = $6, status = $7, amount = $8, advance_amount = $9, assembly_amount = $10, client_id = $11, updated_at = NOW() WHERE id = $1`,
      [id, input.title, input.description, input.address, input.addressLat, input.addressLng, input.status, input.amount, input.advanceAmount, assemblyAmount, input.clientId]
    )
    await client.query('DELETE FROM order_members WHERE order_id = $1', [id])
    for (const userId of memberIds) await client.query('INSERT INTO order_members (order_id, user_id, can_edit) VALUES ($1, $2, $3)', [id, userId, userId === access.creator_id || editorIds.has(userId)])
    await logActivity(id, req.user!.id, 'updated', 'изменил параметры и участников заказа', client)
    await client.query('COMMIT')
    res.json(await getOrder(id, req.user!.id))
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally { client.release() }
})

ordersRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const access = await assertOrderAccess(id, req.user!.id)
    if (access.creator_id !== req.user!.id) throw new HttpError(403, 'Только создатель может удалить заказ')
    const images = await pool.query('SELECT stored_name FROM order_images WHERE order_id = $1', [id])
    await pool.query('DELETE FROM orders WHERE id = $1', [id])
    await Promise.all(images.rows.map((image) => unlink(path.join(uploadDir, path.basename(image.stored_name))).catch(() => undefined)))
    res.status(204).end()
  } catch (error) { next(error) }
})

ordersRouter.post('/:id/tasks', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const id = idSchema.parse(req.params.id)
    await assertOrderAccess(id, req.user!.id)
    const input = z.object({ taskType: taskTypeSchema, dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), assigneeIds: z.array(idSchema).max(100).default([]) }).parse(req.body)
    const assigneeIds = [...new Set(input.assigneeIds)]
    await client.query('BEGIN')
    await validateTaskMembers(client, id, assigneeIds)
    const { rows } = await client.query('INSERT INTO tasks (order_id, title, task_type, due_date, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id', [id, input.taskType, input.taskType, input.dueDate, req.user!.id])
    for (const userId of assigneeIds) await client.query('INSERT INTO task_members (task_id, user_id) VALUES ($1, $2)', [rows[0].id, userId])
    await logActivity(id, req.user!.id, 'task', `добавил задачу «${input.taskType}» на ${input.dueDate}`, client)
    await client.query('COMMIT')
    res.status(201).json(await getTask(rows[0].id))
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally { client.release() }
})

ordersRouter.patch('/:id/tasks/:taskId', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const id = idSchema.parse(req.params.id)
    const taskId = idSchema.parse(req.params.taskId)
    await assertOrderAccess(id, req.user!.id)
    const input = z.object({ taskType: taskTypeSchema.optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), completed: z.boolean().optional(), assigneeIds: z.array(idSchema).max(100).optional() }).parse(req.body)
    await client.query('BEGIN')
    if (input.assigneeIds) {
      const assigneeIds = [...new Set(input.assigneeIds)]
      await validateTaskMembers(client, id, assigneeIds)
      await client.query('DELETE FROM task_members WHERE task_id = $1', [taskId])
      for (const userId of assigneeIds) await client.query('INSERT INTO task_members (task_id, user_id) VALUES ($1, $2)', [taskId, userId])
    }
    await client.query('UPDATE tasks SET task_type = COALESCE($3, task_type), due_date = COALESCE($4, due_date), completed = COALESCE($5, completed) WHERE id = $1 AND order_id = $2', [taskId, id, input.taskType ?? null, input.dueDate ?? null, input.completed ?? null])
    await logActivity(id, req.user!.id, 'task', input.completed === undefined ? 'изменил задачу' : input.completed ? 'отметил задачу выполненной' : 'вернул задачу в работу', client)
    await client.query('COMMIT')
    const task = await getTask(taskId)
    if (!task) throw new HttpError(404, 'Задача не найдена')
    res.json(task)
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally { client.release() }
})

ordersRouter.delete('/:id/tasks/:taskId', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const taskId = idSchema.parse(req.params.taskId)
    await assertOrderAccess(id, req.user!.id)
    await pool.query('DELETE FROM tasks WHERE id = $1 AND order_id = $2', [taskId, id])
    await logActivity(id, req.user!.id, 'task', 'удалил задачу')
    res.status(204).end()
  } catch (error) { next(error) }
})

ordersRouter.post('/:id/images', upload.array('images'), async (req, res, next) => {
  const files = (req.files || []) as Express.Multer.File[]
  try {
    const id = idSchema.parse(req.params.id)
    await assertOrderAccess(id, req.user!.id)
    if (!files.length) throw new HttpError(400, 'Выберите изображения JPG, PNG, GIF, WebP или AVIF')
    const inserted = []
    for (const file of files) {
      const { rows } = await pool.query(
        `INSERT INTO order_images (order_id, original_name, stored_name, mime_type, size, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, original_name AS "originalName", mime_type AS "mimeType", size, uploaded_by AS "uploadedBy", created_at AS "createdAt"`,
        [id, file.originalname, file.filename, file.mimetype, file.size, req.user!.id]
      )
      inserted.push(rows[0])
    }
    await logActivity(id, req.user!.id, 'image', `добавил изображения: ${files.length}`)
    res.status(201).json(inserted)
  } catch (error) {
    await Promise.all(files.map((file) => unlink(file.path).catch(() => undefined)))
    next(error)
  }
})

ordersRouter.get('/:id/images/:imageId', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const imageId = idSchema.parse(req.params.imageId)
    await assertOrderAccess(id, req.user!.id)
    const { rows } = await pool.query('SELECT stored_name, mime_type FROM order_images WHERE id = $1 AND order_id = $2', [imageId, id])
    if (!rows[0]) throw new HttpError(404, 'Изображение не найдено')
    res.type(rows[0].mime_type)
    res.sendFile(path.join(uploadDir, path.basename(rows[0].stored_name)))
  } catch (error) { next(error) }
})

ordersRouter.delete('/:id/images/:imageId', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const imageId = idSchema.parse(req.params.imageId)
    const access = await assertOrderAccess(id, req.user!.id)
    const { rows } = await pool.query('SELECT stored_name, uploaded_by FROM order_images WHERE id = $1 AND order_id = $2', [imageId, id])
    if (!rows[0]) throw new HttpError(404, 'Изображение не найдено')
    if (rows[0].uploaded_by !== req.user!.id && access.creator_id !== req.user!.id) throw new HttpError(403, 'Недостаточно прав')
    await pool.query('DELETE FROM order_images WHERE id = $1', [imageId])
    await unlink(path.join(uploadDir, path.basename(rows[0].stored_name))).catch(() => undefined)
    await logActivity(id, req.user!.id, 'image', 'удалил изображение')
    res.status(204).end()
  } catch (error) { next(error) }
})

ordersRouter.get('/:id/messages', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    await assertOrderAccess(id, req.user!.id)
    const { rows } = await pool.query(`${messageSelect} WHERE messages.order_id = $1 ORDER BY messages.created_at DESC LIMIT 150`, [id])
    res.json(await withMessageMetadata(rows.reverse(), req.user!.id))
  } catch (error) { next(error) }
})
