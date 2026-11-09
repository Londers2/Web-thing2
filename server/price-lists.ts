import { Router } from 'express'
import { z } from 'zod'
import { pool } from './db'
import { HttpError } from './auth'
import { idSchema, optionalText } from './validation'

export const priceListsRouter = Router()
const itemSchema = z.object({
  kind: z.enum(['service', 'divider']).default('service'),
  category: z.string().trim().min(1).max(160).default('Услуги'),
  name: z.string().trim().min(1).max(500),
  price: z.coerce.number().finite().min(0).max(999999999999).default(0),
})
const listSchema = z.object({
  title: z.string().trim().min(1).max(200),
  printTitle: optionalText(5000),
  notes: optionalText(5000),
  items: z.array(itemSchema).max(1000).default([]),
})

async function getList(id: string) {
  const { rows } = await pool.query('SELECT id, title, print_title AS "printTitle", notes, created_at AS "createdAt", updated_at AS "updatedAt" FROM price_lists WHERE id = $1', [id])
  if (!rows[0]) throw new HttpError(404, 'Прайс-лист не найден')
  const items = await pool.query('SELECT id, kind, category, name, price::float8, position FROM price_list_items WHERE list_id = $1 ORDER BY position', [id])
  return { ...rows[0], items: items.rows }
}

priceListsRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id FROM price_lists ORDER BY updated_at DESC')
    res.json(await Promise.all(rows.map((row) => getList(row.id))))
  } catch (error) { next(error) }
})

priceListsRouter.post('/', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const input = listSchema.parse(req.body)
    await client.query('BEGIN')
    const { rows } = await client.query('INSERT INTO price_lists (title, print_title, notes, created_by) VALUES ($1, $2, $3, $4) RETURNING id', [input.title, input.printTitle, input.notes, req.user!.id])
    for (const [position, item] of input.items.entries()) {
      await client.query('INSERT INTO price_list_items (list_id, kind, category, name, price, position) VALUES ($1, $2, $3, $4, $5, $6)', [rows[0].id, item.kind, item.category, item.name, item.kind === 'divider' ? 0 : item.price, position])
    }
    await client.query('COMMIT')
    res.status(201).json(await getList(rows[0].id))
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally { client.release() }
})

priceListsRouter.patch('/:id', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const id = idSchema.parse(req.params.id)
    const input = listSchema.parse(req.body)
    await client.query('BEGIN')
    const { rowCount } = await client.query('UPDATE price_lists SET title = $2, print_title = $3, notes = $4, updated_at = NOW() WHERE id = $1', [id, input.title, input.printTitle, input.notes])
    if (!rowCount) throw new HttpError(404, 'Прайс-лист не найден')
    await client.query('DELETE FROM price_list_items WHERE list_id = $1', [id])
    for (const [position, item] of input.items.entries()) {
      await client.query('INSERT INTO price_list_items (list_id, kind, category, name, price, position) VALUES ($1, $2, $3, $4, $5, $6)', [id, item.kind, item.category, item.name, item.kind === 'divider' ? 0 : item.price, position])
    }
    await client.query('COMMIT')
    res.json(await getList(id))
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally { client.release() }
})

priceListsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    await pool.query('UPDATE orders SET price_list_id = NULL WHERE price_list_id = $1', [id])
    const { rowCount } = await pool.query('DELETE FROM price_lists WHERE id = $1', [id])
    if (!rowCount) throw new HttpError(404, 'Прайс-лист не найден')
    res.status(204).end()
  } catch (error) { next(error) }
})
