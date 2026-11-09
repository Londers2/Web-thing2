import { pool } from './db'
import { HttpError } from './auth'

export const orderAccessSql = `EXISTS (
  SELECT 1 FROM order_members access_members
  WHERE access_members.order_id = orders.id AND access_members.user_id = $1
)`

export async function assertOrderAccess(orderId: string, userId: string) {
  const { rows } = await pool.query<{ creator_id: string; can_edit: boolean }>(
    `SELECT orders.id, orders.creator_id, access_members.can_edit FROM orders
     JOIN order_members access_members ON access_members.order_id = orders.id AND access_members.user_id = $1
     WHERE orders.id = $2 AND ${orderAccessSql}`,
    [userId, orderId]
  )
  if (!rows[0]) throw new HttpError(404, 'Заказ не найден')
  return rows[0]
}
