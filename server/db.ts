import { readFile } from 'node:fs/promises'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import pg from 'pg'

pg.types.setTypeParser(1082, (value: string) => value)

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
})

export async function migrate() {
  const schema = await readFile(path.join(process.cwd(), 'server', 'schema.sql'), 'utf8')
  await pool.query(schema)
}

export async function ensureInitialAdmin() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(741852963)')
    const { rows } = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users')
    if (Number(rows[0].count) === 0) {
      const password = process.env.ADMIN_PASSWORD
      if (!password || password.length < 10) {
        throw new Error('Для первого запуска задайте ADMIN_PASSWORD длиной не менее 10 символов в .env')
      }
      const email = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase()
      const name = process.env.ADMIN_NAME?.trim() || 'Администратор'
      const passwordHash = await bcrypt.hash(password, 12)
      await client.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        [name, email, passwordHash, 'admin']
      )
      console.log(`Создан первоначальный администратор: ${email}`)
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
