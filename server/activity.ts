import { pool } from './db'

export async function logActivity(orderId: string, userId: string, action: string, body: string, client: any = pool) {
  await client.query('INSERT INTO order_activities (order_id, user_id, action, body) VALUES ($1, $2, $3, $4)', [orderId, userId, action, body])
}
