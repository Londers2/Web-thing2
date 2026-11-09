import type http from 'node:http'
import type { RequestHandler } from 'express'
import { Server } from 'socket.io'
import { z } from 'zod'
import { pool } from './db'
import { assertOrderAccess } from './access'
import { idSchema } from './validation'
import { getMessageAccess, sendMessage } from './message-service'

let realtimeIo: Server | null = null
const allowedEmojis = ['👍', '❤️', '😂', '🎉', '😮', '😢']

export function broadcastMessage(message: unknown, recipients: string[]) {
  if (!realtimeIo) return
  for (const recipient of recipients) realtimeIo.to(`user:${recipient}`).emit('message:new', message)
}

export function setupSocket(server: http.Server, sessionMiddleware: RequestHandler) {
  const io = new Server(server, { serveClient: false })
  realtimeIo = io
  io.engine.use(sessionMiddleware)

  io.use(async (socket, next) => {
    try {
      const request = socket.request as http.IncomingMessage & { session?: { userId?: string } }
      const userId = request.session?.userId
      if (!userId) return next(new Error('unauthorized'))
      const { rows } = await pool.query('SELECT id, name, email, avatar_url AS "avatarUrl" FROM users WHERE id = $1 AND active = TRUE', [userId])
      if (!rows[0]) return next(new Error('unauthorized'))
      socket.data.user = rows[0]
      next()
    } catch (error) { next(error as Error) }
  })

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.user.id}`)

    socket.on('order:join', async (value, callback) => {
      try {
        const orderId = idSchema.parse(value)
        await assertOrderAccess(orderId, socket.data.user.id)
        socket.join(`order:${orderId}`)
        if (typeof callback === 'function') callback({ ok: true })
      } catch {
        if (typeof callback === 'function') callback({ ok: false, error: 'Заказ недоступен' })
      }
    })

    socket.on('order:leave', (value) => {
      const parsed = idSchema.safeParse(value)
      if (parsed.success) socket.leave(`order:${parsed.data}`)
    })

    socket.on('conversation:read', async (value) => {
      try {
        const input = z.object({ orderId: idSchema.optional(), peerId: idSchema.optional() }).refine((data) => Boolean(data.orderId) !== Boolean(data.peerId)).parse(value)
        let recipients: string[]
        if (input.orderId) {
          await assertOrderAccess(input.orderId, socket.data.user.id)
          const result = await pool.query('SELECT user_id FROM order_members JOIN users ON users.id = order_members.user_id AND users.active = TRUE WHERE order_id = $1', [input.orderId])
          recipients = result.rows.map((row) => row.user_id)
        } else {
          recipients = [socket.data.user.id, input.peerId!]
        }
        for (const recipient of new Set(recipients)) io.to(`user:${recipient}`).emit('messages:read', { ...input, reader: socket.data.user })
      } catch {}
    })

    socket.on('message:send', async (value, callback) => {
      try {
        const input = z.object({ body: z.string().max(4000), orderId: idSchema.optional(), recipientId: idSchema.optional() }).parse(value)
        const { message, recipients } = await sendMessage({ sender: socket.data.user, ...input })
        broadcastMessage(message, recipients)
        if (typeof callback === 'function') callback({ ok: true, message })
      } catch {
        if (typeof callback === 'function') callback({ ok: false, error: 'Сообщение не отправлено' })
      }
    })

    socket.on('reaction:toggle', async (value, callback) => {
      try {
        const input = z.object({ messageId: idSchema, emoji: z.enum(allowedEmojis as [string, ...string[]]) }).parse(value)
        const userId = socket.data.user.id
        const { recipients } = await getMessageAccess(input.messageId, userId)
        const existing = await pool.query('SELECT 1 FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3', [input.messageId, userId, input.emoji])
        if (existing.rowCount) {
          await pool.query('DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3', [input.messageId, userId, input.emoji])
        } else {
          await pool.query('INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)', [input.messageId, userId, input.emoji])
        }
        const { rows } = await pool.query('SELECT user_id, emoji FROM message_reactions WHERE message_id = $1', [input.messageId])
        for (const recipient of recipients) {
          const counts = new Map<string, number>()
          for (const row of rows) counts.set(row.emoji, (counts.get(row.emoji) || 0) + 1)
          const reactions = [...counts].map(([emoji, count]) => ({ emoji, count, reacted: rows.some((row) => row.emoji === emoji && row.user_id === recipient) }))
          io.to(`user:${recipient}`).emit('message:reaction', { messageId: input.messageId, reactions })
        }
        if (typeof callback === 'function') callback({ ok: true })
      } catch {
        if (typeof callback === 'function') callback({ ok: false, error: 'Не удалось изменить реакцию' })
      }
    })
  })

  return io
}
