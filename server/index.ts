import 'dotenv/config'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import http from 'node:http'
import express, { type NextFunction, type Request, type Response } from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import multer from 'multer'
import { ZodError } from 'zod'
import { ensureInitialAdmin, migrate, pool } from './db'
import { HttpError } from './auth'
import { apiRouter } from './routes'
import { setupSocket } from './socket'
import { ensureWhisperInstalled } from './whisper'

const app = express()
const server = http.createServer(app)
const port = Number(process.env.PORT || 3001)
const host = process.env.HOST || '0.0.0.0'
const PgSession = connectPgSimple(session)

export const sessionMiddleware = session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
})

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://rsms.me'],
      fontSrc: ["'self'", 'https://rsms.me'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      frameSrc: ["'self'", 'https://yandex.ru', 'https://yandex.com'],
    },
  },
}))
app.use(express.json({ limit: '1mb' }))
app.use(sessionMiddleware)
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }))
app.use('/api', apiRouter)

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(process.cwd(), 'dist')))
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')))
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: error.issues[0]?.message || 'Проверьте введённые данные' })
  }
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message })
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Не удалось загрузить файлы' })
  }
  if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
    return res.status(409).json({ error: 'Пользователь с таким email уже существует' })
  }
  console.error(error)
  res.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

async function start() {
  if (!process.env.DATABASE_URL) throw new Error('Задайте DATABASE_URL в файле .env')
  await migrate()
  await ensureInitialAdmin()
  await ensureWhisperInstalled()
  setupSocket(server, sessionMiddleware)
  server.listen(port, host, () => console.log(`Сервер запущен: http://localhost:${port} (сетевой интерфейс ${host})`))
}

start().catch((error) => {
  console.error(error)
  process.exit(1)
})
