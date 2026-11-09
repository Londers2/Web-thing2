import { pool } from './db'
import { HttpError } from './auth'
import { assertOrderAccess } from './access'
import { logActivity } from './activity'

export interface MessageAttachment {
  path: string
  name: string
  mime: string
  duration?: number | null
  size?: number | null
}

export const messageSelect = `
  SELECT messages.id, messages.body, messages.created_at AS "createdAt", messages.order_id AS "orderId",
    messages.recipient_id AS "recipientId", messages.attachment_name AS "attachmentName",
    messages.attachment_mime AS "attachmentMime", messages.attachment_duration AS "attachmentDuration",
    messages.attachment_size::float8 AS "attachmentSize", messages.transcript,
    CASE WHEN messages.attachment_path IS NOT NULL THEN '/api/messages/' || messages.id || '/attachment' END AS "attachmentUrl",
    json_build_object('id', users.id, 'name', users.name, 'email', users.email, 'avatarUrl', users.avatar_url) AS user
  FROM messages JOIN users ON users.id = messages.user_id
`

export async function withMessageMetadata(messages: any[], userId: string) {
  if (!messages.length) return messages
  const ids = messages.map((message) => message.id)
  const [reads, reactions] = await Promise.all([
    pool.query('SELECT message_id, user_id, users.name FROM message_reads JOIN users ON users.id = message_reads.user_id WHERE message_id = ANY($1::uuid[])', [ids]),
    pool.query(
      `SELECT message_id, emoji, COUNT(*)::int AS count, BOOL_OR(user_id = $2) AS reacted
       FROM message_reactions WHERE message_id = ANY($1::uuid[]) GROUP BY message_id, emoji`,
      [ids, userId]
    ),
  ])
  return messages.map((message) => ({
    ...message,
    readBy: reads.rows.filter((row) => row.message_id === message.id).map((row) => ({ id: row.user_id, name: row.name })),
    reactions: reactions.rows.filter((row) => row.message_id === message.id).map((row) => ({ emoji: row.emoji, count: row.count, reacted: row.reacted })),
  }))
}

export async function sendMessage({ sender, body, orderId, recipientId, attachment }: {
  sender: { id: string; name: string; email: string; avatarUrl?: string | null }
  body: string
  orderId?: string
  recipientId?: string
  attachment?: MessageAttachment
}) {
  const text = body.trim()
  if (text.length > 4000 || (!text && !attachment) || Boolean(orderId) === Boolean(recipientId)) throw new HttpError(400, 'Некорректное сообщение')
  const active = await pool.query('SELECT 1 FROM users WHERE id = $1 AND active = TRUE', [sender.id])
  if (!active.rowCount) throw new HttpError(401, 'Учётная запись недоступна')
  let recipients: string[]
  if (orderId) {
    await assertOrderAccess(orderId, sender.id)
    const result = await pool.query('SELECT order_members.user_id FROM order_members JOIN users ON users.id = order_members.user_id AND users.active = TRUE WHERE order_members.order_id = $1', [orderId])
    recipients = result.rows.map((row) => row.user_id)
  } else {
    if (recipientId === sender.id) throw new HttpError(400, 'Нельзя отправить сообщение самому себе')
    const result = await pool.query('SELECT id FROM users WHERE id = $1 AND active = TRUE', [recipientId])
    if (!result.rowCount) throw new HttpError(404, 'Получатель недоступен')
    recipients = [sender.id, recipientId!]
  }
  const inserted = await pool.query(
    `INSERT INTO messages (order_id, recipient_id, user_id, body, attachment_path, attachment_name, attachment_mime, attachment_duration, attachment_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [orderId || null, recipientId || null, sender.id, text, attachment?.path || null, attachment?.name || null, attachment?.mime || null, attachment?.duration || null, attachment?.size || null]
  )
  if (orderId) await logActivity(orderId, sender.id, 'message', attachment ? 'добавил вложение в чат' : 'добавил сообщение в чат')
  const { rows } = await pool.query(`${messageSelect} WHERE messages.id = $1`, [inserted.rows[0].id])
  const [message] = await withMessageMetadata(rows, sender.id)
  return { message, recipients: [...new Set(recipients)] }
}

export async function getMessageAccess(messageId: string, userId: string) {
  const { rows } = await pool.query('SELECT id, order_id, recipient_id, user_id, attachment_path, attachment_mime, attachment_name FROM messages WHERE id = $1', [messageId])
  const message = rows[0]
  if (!message) throw new HttpError(404, 'Сообщение не найдено')
  let recipients: string[]
  if (message.order_id) {
    await assertOrderAccess(message.order_id, userId)
    const result = await pool.query('SELECT user_id FROM order_members JOIN users ON users.id = order_members.user_id AND users.active = TRUE WHERE order_id = $1', [message.order_id])
    recipients = result.rows.map((row) => row.user_id)
  } else if (message.recipient_id && (message.user_id === userId || message.recipient_id === userId)) {
    recipients = [message.user_id, message.recipient_id]
  } else {
    throw new HttpError(404, 'Сообщение не найдено')
  }
  return { message, recipients: [...new Set(recipients)] }
}
