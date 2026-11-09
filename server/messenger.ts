import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rename, rm, unlink } from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import multer from 'multer'
import { z } from 'zod'
import { pool } from './db'
import { HttpError } from './auth'
import { assertOrderAccess } from './access'
import { idSchema } from './validation'
import { getMessageAccess, messageSelect, sendMessage, withMessageMetadata } from './message-service'
import { broadcastMessage } from './socket'

export const messengerRouter = Router()
const dataRoot = path.resolve('./data')
const messageFileDir = path.join(dataRoot, 'message-files')
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => mkdir(messageFileDir, { recursive: true }).then(() => callback(null, messageFileDir), (error) => callback(error, messageFileDir)),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase().slice(0, 12)}`),
  }),
  fileFilter: (_req, file, callback) => callback(null, /^image\/(jpeg|png|gif|webp|avif)$/.test(file.mimetype) || /^audio\/(webm|ogg|mpeg|mp4|wav|x-wav)(;|$)/.test(file.mimetype)),
})

const execFileAsync = promisify(execFile)

async function transcribeLocally(filePath: string) {
  const executable = process.env.LOCAL_WHISPER_EXECUTABLE
  if (!executable) return null
  const outputDir = await mkdtemp(path.join(tmpdir(), 'order-whisper-'))
  try {
    if (process.env.LOCAL_WHISPER_RUNNER === 'faster') {
      const script = path.join(process.cwd(), 'server', 'whisper_transcribe.py')
      const result = await execFileAsync(executable, [script, filePath, process.env.LOCAL_WHISPER_MODEL || 'base'], { timeout: 300000, maxBuffer: 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
      return result.stdout.trim()
    }
    await execFileAsync(executable, [filePath, '--model', process.env.LOCAL_WHISPER_MODEL || 'base', '--language', 'Russian', '--output_format', 'txt', '--output_dir', outputDir], { timeout: 120000, maxBuffer: 1024 * 1024 })
    const outputFile = path.join(outputDir, `${path.basename(filePath, path.extname(filePath))}.txt`)
    return (await readFile(outputFile, 'utf8')).trim()
  } finally {
    await rm(outputDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

messengerRouter.get('/conversations', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const [direct, orders] = await Promise.all([
      pool.query(
        `SELECT users.id, users.name AS title, users.email AS subtitle, users.avatar_url AS "avatarUrl",
          (SELECT COUNT(*)::int FROM messages m
            WHERE m.user_id = users.id AND m.recipient_id = $1
              AND NOT EXISTS (SELECT 1 FROM message_reads r WHERE r.message_id = m.id AND r.user_id = $1)
          ) AS unread_count,
          (SELECT json_build_object('body', CASE WHEN m.body != '' THEN m.body ELSE 'Вложение' END, 'createdAt', m.created_at, 'senderName', sender.name)
            FROM messages m JOIN users sender ON sender.id = m.user_id
            WHERE m.order_id IS NULL AND ((m.user_id = $1 AND m.recipient_id = users.id) OR (m.user_id = users.id AND m.recipient_id = $1))
            ORDER BY m.created_at DESC LIMIT 1
          ) AS last_message
         FROM users WHERE users.active = TRUE AND users.id != $1 ORDER BY users.name`,
        [userId]
      ),
      pool.query(
        `SELECT orders.id, orders.title, 'Заказ' AS subtitle,
          (SELECT COUNT(*)::int FROM messages m
            WHERE m.order_id = orders.id AND m.user_id != $1
              AND NOT EXISTS (SELECT 1 FROM message_reads r WHERE r.message_id = m.id AND r.user_id = $1)
          ) AS unread_count,
          (SELECT json_build_object('body', CASE WHEN m.body != '' THEN m.body ELSE 'Вложение' END, 'createdAt', m.created_at, 'senderName', sender.name)
            FROM messages m JOIN users sender ON sender.id = m.user_id
            WHERE m.order_id = orders.id ORDER BY m.created_at DESC LIMIT 1
          ) AS last_message
         FROM orders JOIN order_members ON order_members.order_id = orders.id AND order_members.user_id = $1`,
        [userId]
      ),
    ])
    const conversations = [
      ...direct.rows.map((row) => ({ type: 'direct', id: row.id, title: row.title, subtitle: row.subtitle, avatarUrl: row.avatarUrl, unreadCount: row.unread_count, lastMessage: row.last_message })),
      ...orders.rows.map((row) => ({ type: 'order', id: row.id, title: row.title, subtitle: row.subtitle, avatarUrl: null, unreadCount: row.unread_count, lastMessage: row.last_message })),
    ]
    conversations.sort((a, b) => (b.lastMessage?.createdAt || '').localeCompare(a.lastMessage?.createdAt || '') || a.title.localeCompare(b.title))
    res.json(conversations)
  } catch (error) { next(error) }
})

messengerRouter.get('/messages/direct/:peerId', async (req, res, next) => {
  try {
    const peerId = idSchema.parse(req.params.peerId)
    const userId = req.user!.id
    if (peerId === userId) return res.json([])
    const { rows } = await pool.query(
      `${messageSelect}
       WHERE messages.order_id IS NULL AND messages.recipient_id IS NOT NULL
         AND ((messages.user_id = $1 AND messages.recipient_id = $2) OR (messages.user_id = $2 AND messages.recipient_id = $1))
       ORDER BY messages.created_at DESC LIMIT 150`,
      [userId, peerId]
    )
    res.json(await withMessageMetadata(rows.reverse(), userId))
  } catch (error) { next(error) }
})

messengerRouter.post('/messages/read', async (req, res, next) => {
  try {
    const input = z.object({ orderId: idSchema.optional(), peerId: idSchema.optional() }).refine((value) => Boolean(value.orderId) !== Boolean(value.peerId)).parse(req.body)
    const userId = req.user!.id
    let scope = ''
    const values: string[] = [userId]
    if (input.orderId) {
      await assertOrderAccess(input.orderId, userId)
      values.push(input.orderId)
      scope = 'messages.order_id = $2'
    } else {
      values.push(input.peerId!)
      scope = 'messages.order_id IS NULL AND messages.recipient_id IS NOT NULL AND ((messages.user_id = $1 AND messages.recipient_id = $2) OR (messages.user_id = $2 AND messages.recipient_id = $1))'
    }
    await pool.query(
      `INSERT INTO message_reads (message_id, user_id)
       SELECT messages.id, $1 FROM messages WHERE ${scope} AND messages.user_id != $1
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      values
    )
    res.status(204).end()
  } catch (error) { next(error) }
})

messengerRouter.post('/messages/attachments', upload.single('file'), async (req, res, next) => {
  let storedFilePath = req.file?.path
  let orderImageId: string | null = null
  try {
    if (!req.file) throw new HttpError(400, 'Выберите файл')
    const orderId = req.body.orderId ? idSchema.parse(req.body.orderId) : undefined
    const recipientId = req.body.recipientId ? idSchema.parse(req.body.recipientId) : undefined
    const duration = req.body.duration ? Math.max(0, Number.parseInt(req.body.duration, 10) || 0) : null
    let attachmentPath = `message-files/${req.file.filename}`
    if (orderId && req.file.mimetype.startsWith('image/')) {
      await assertOrderAccess(orderId, req.user!.id)
      const orderUploadDir = path.join(dataRoot, 'uploads')
      await mkdir(orderUploadDir, { recursive: true })
      storedFilePath = path.join(orderUploadDir, req.file.filename)
      await rename(req.file.path, storedFilePath)
      attachmentPath = `uploads/${req.file.filename}`
      const image = await pool.query(
        `INSERT INTO order_images (order_id, original_name, stored_name, mime_type, size, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [orderId, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, req.user!.id]
      )
      orderImageId = image.rows[0].id
    }
    const { message, recipients } = await sendMessage({
      sender: req.user!,
      body: String(req.body.body || ''),
      orderId,
      recipientId,
      attachment: { path: attachmentPath, name: req.file.originalname, mime: req.file.mimetype, duration, size: req.file.size },
    })
    broadcastMessage(message, recipients)
    res.status(201).json(message)
  } catch (error) {
    if (orderImageId) await pool.query('DELETE FROM order_images WHERE id = $1', [orderImageId]).catch(() => undefined)
    if (storedFilePath) await unlink(storedFilePath).catch(() => undefined)
    next(error)
  }
})

messengerRouter.post('/messages/order-image', async (req, res, next) => {
  try {
    const input = z.object({ orderId: idSchema, imageId: idSchema, body: z.string().max(4000).default('') }).parse(req.body)
    await assertOrderAccess(input.orderId, req.user!.id)
    const { rows } = await pool.query('SELECT stored_name, original_name, mime_type, size FROM order_images WHERE id = $1 AND order_id = $2', [input.imageId, input.orderId])
    if (!rows[0]) throw new HttpError(404, 'Изображение не найдено')
    const { message, recipients } = await sendMessage({
      sender: req.user!,
      body: input.body,
      orderId: input.orderId,
      attachment: { path: `uploads/${rows[0].stored_name}`, name: rows[0].original_name, mime: rows[0].mime_type, size: Number(rows[0].size) },
    })
    broadcastMessage(message, recipients)
    res.status(201).json(message)
  } catch (error) { next(error) }
})

messengerRouter.post('/messages/:id/transcribe', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const { message } = await getMessageAccess(id, req.user!.id)
    if (!message.attachment_path || !message.attachment_mime?.startsWith('audio/')) throw new HttpError(400, 'Это не голосовое сообщение')
    const filePath = path.resolve(dataRoot, message.attachment_path)
    if (!filePath.startsWith(`${dataRoot}${path.sep}`)) throw new HttpError(404, 'Аудиофайл не найден')
    let transcript = await transcribeLocally(filePath)
    if (transcript === null) {
      if (!process.env.OPENAI_API_KEY) throw new HttpError(503, 'Расшифровка не настроена: установите Whisper или задайте OPENAI_API_KEY')
      const audio = await readFile(filePath)
      const form = new FormData()
      form.append('file', new Blob([audio], { type: message.attachment_mime }), message.attachment_name || 'voice.webm')
      form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1')
      form.append('language', 'ru')
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form,
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new HttpError(502, result.error?.message || 'Сервис расшифровки недоступен')
      transcript = String(result.text || '').trim()
    }
    await pool.query('UPDATE messages SET transcript = $2 WHERE id = $1', [id, transcript])
    res.json({ transcript })
  } catch (error) { next(error) }
})

messengerRouter.get('/messages/:id/attachment', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const { message } = await getMessageAccess(id, req.user!.id)
    if (!message.attachment_path) throw new HttpError(404, 'Вложение не найдено')
    const filePath = path.resolve(dataRoot, message.attachment_path)
    if (!filePath.startsWith(`${dataRoot}${path.sep}`)) throw new HttpError(404, 'Вложение не найдено')
    res.type(message.attachment_mime)
    res.sendFile(filePath)
  } catch (error) { next(error) }
})

messengerRouter.get('/notifications', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT messages.id, CASE WHEN messages.body != '' THEN messages.body ELSE 'Вложение' END AS body, messages.created_at AS "createdAt", messages.order_id AS "orderId",
        messages.recipient_id AS "recipientId", COUNT(*) OVER()::int AS total_count,
        json_build_object('id', sender.id, 'name', sender.name, 'avatarUrl', sender.avatar_url) AS sender,
        CASE WHEN messages.order_id IS NOT NULL THEN orders.title ELSE sender.name END AS conversation_title
       FROM messages
       JOIN users sender ON sender.id = messages.user_id
       LEFT JOIN orders ON orders.id = messages.order_id
       WHERE messages.user_id != $1
         AND NOT EXISTS (SELECT 1 FROM message_reads r WHERE r.message_id = messages.id AND r.user_id = $1)
         AND (
           messages.recipient_id = $1 OR (
             messages.order_id IS NOT NULL AND EXISTS (
               SELECT 1 FROM order_members WHERE order_members.order_id = messages.order_id AND order_members.user_id = $1
             )
           )
         )
       ORDER BY messages.created_at DESC LIMIT 20`,
      [req.user!.id]
    )
    res.json({
      count: rows[0]?.total_count || 0,
      items: rows.map((row) => ({ id: row.id, body: row.body, createdAt: row.createdAt, orderId: row.orderId, recipientId: row.recipientId, sender: row.sender, conversationTitle: row.conversation_title })),
    })
  } catch (error) { next(error) }
})
