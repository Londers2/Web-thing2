import type { NextFunction, Request, Response } from 'express'
import { pool } from './db'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
  active: boolean
  avatarUrl?: string | null
  jobRole?: 'manager' | 'assembler' | 'measurer'
  jobRoles?: ('manager' | 'assembler' | 'measurer')[]
  accentColor?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.session.userId) throw new HttpError(401, 'Требуется вход в систему')
    const { rows } = await pool.query<AuthUser>(
      'SELECT id, name, email, role, active, avatar_url AS "avatarUrl", job_role AS "jobRole", job_roles AS "jobRoles", accent_color AS "accentColor" FROM users WHERE id = $1',
      [req.session.userId]
    )
    if (!rows[0]?.active) {
      req.session.destroy(() => undefined)
      throw new HttpError(401, 'Учётная запись недоступна')
    }
    req.user = rows[0]
    res.locals.user = rows[0]
    next()
  } catch (error) {
    next(error)
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Недостаточно прав'))
  next()
}

export function publicUser(user: AuthUser) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active, avatarUrl: user.avatarUrl || null, jobRole: user.jobRole || 'manager', jobRoles: user.jobRoles || [user.jobRole || 'manager'], accentColor: user.accentColor || 'blue' }
}
