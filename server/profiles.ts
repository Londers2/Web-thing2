import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import multer from 'multer'
import { pool } from './db'
import { HttpError } from './auth'
import { idSchema } from './validation'

export const profilesRouter = Router()
const avatarDir = path.resolve('./data/avatars')
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => mkdir(avatarDir, { recursive: true }).then(() => callback(null, avatarDir), (error) => callback(error, avatarDir)),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase().slice(0, 10)}`),
  }),
  fileFilter: (_req, file, callback) => callback(null, /^image\/(jpeg|png|gif|webp|avif)$/.test(file.mimetype)),
})

profilesRouter.post('/profile/avatar', upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'Выберите изображение')
    const previous = await pool.query('SELECT avatar_path FROM users WHERE id = $1', [req.user!.id])
    const avatarUrl = `/api/users/${req.user!.id}/avatar?v=${Date.now()}`
    await pool.query('UPDATE users SET avatar_path = $2, avatar_mime = $3, avatar_url = $4 WHERE id = $1', [req.user!.id, req.file.filename, req.file.mimetype, avatarUrl])
    if (previous.rows[0]?.avatar_path) await unlink(path.join(avatarDir, path.basename(previous.rows[0].avatar_path))).catch(() => undefined)
    const { rows } = await pool.query('SELECT id, name, email, role, active, avatar_url AS "avatarUrl", job_role AS "jobRole", job_roles AS "jobRoles", accent_color AS "accentColor" FROM users WHERE id = $1', [req.user!.id])
    res.json({ user: rows[0] })
  } catch (error) {
    if (req.file) await unlink(req.file.path).catch(() => undefined)
    next(error)
  }
})

profilesRouter.delete('/profile/avatar', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT avatar_path FROM users WHERE id = $1', [req.user!.id])
    await pool.query('UPDATE users SET avatar_path = NULL, avatar_mime = NULL, avatar_url = NULL WHERE id = $1', [req.user!.id])
    if (rows[0]?.avatar_path) await unlink(path.join(avatarDir, path.basename(rows[0].avatar_path))).catch(() => undefined)
    res.json({ user: { ...req.user!, avatarUrl: null } })
  } catch (error) { next(error) }
})

profilesRouter.get('/users/:id/avatar', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const { rows } = await pool.query('SELECT avatar_path, avatar_mime FROM users WHERE id = $1', [id])
    if (!rows[0]?.avatar_path) throw new HttpError(404, 'Аватар не найден')
    res.type(rows[0].avatar_mime)
    res.sendFile(path.join(avatarDir, path.basename(rows[0].avatar_path)))
  } catch (error) { next(error) }
})
