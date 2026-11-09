import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { pool } from './db'
import { getNumberSetting } from './settings'
import { logActivity } from './activity'

const names = ['Анна Менеджерова', 'Иван Сборщиков', 'Пётр Замерщиков', 'Мария Кузнецова', 'Олег Смирнов', 'Елена Волкова', 'Дмитрий Орлов', 'София Морозова', 'Алексей Павлов', 'Наталья Федорова', 'Роман Соколов', 'Юлия Лебедева']
const roles = [
  ['manager'], ['assembler'], ['measurer'], ['manager', 'assembler'], ['assembler', 'measurer'], ['manager', 'measurer'],
  ['manager'], ['assembler'], ['measurer'], ['manager', 'assembler'], ['assembler', 'measurer'], ['manager', 'measurer'],
]
const taskTypes = ['measurement', 'delivery', 'assembly', 'complaint']
const statuses = ['new', 'in_progress', 'done', 'in_progress', 'new', 'done']
const firstNames = ['Александр', 'Мария', 'Дмитрий', 'Ольга', 'Сергей', 'Екатерина', 'Николай', 'Татьяна', 'Владимир', 'Ирина', 'Артём', 'Светлана']
const lastNames = ['Иванов', 'Петров', 'Сидоров', 'Кузнецов', 'Васильев', 'Попов', 'Новиков', 'Михайлов', 'Фёдоров', 'Морозов', 'Волков', 'Алексеев']
const callSigns = ['Саша', 'Маша', 'Дима', 'Оля', 'Серёжа', 'Катя', 'Коля', 'Таня', 'Вова', 'Ира', 'Тёма', 'Света']
const messageTexts = [
  'Добрый день! Проверьте, пожалуйста, детали заказа.',
  'Клиент подтвердил дату замера.',
  'Материалы будут доставлены завтра.',
  'Нужно уточнить размеры перед сборкой.',
  'Фотографии и документы добавлены в заказ.',
  'Подтверждаю выполнение задачи.',
  'Выезжаю на замер через полчаса.',
  'Фасады уже привезли, можно начинать сборку.',
  'Отправил обновлённый чертёж в файлы.',
  'Перенесём доставку на пятницу?',
  'Клиент просит заменить ручки.',
  'Проверьте, пожалуйста, адрес ещё раз.',
  'Все подготовлено, жду согласования.',
  'Завтра смогу помочь с монтажом.',
  'Нужна ещё одна упаковка крепежа.',
  'Сообщите, когда будете на объекте.',
]

function dateAfter(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function wavFile() {
  const samples = 16000
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples * 2, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt16LE(16000, 24)
  buffer.writeUInt16LE(32000, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(samples * 2, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  return buffer
}

export async function seedDemoData() {
  const existing = await pool.query(`SELECT
    (SELECT COUNT(*) FROM clients) AS clients,
    (SELECT COUNT(*) FROM orders) AS orders,
    (SELECT COUNT(*) FROM price_lists) AS price_lists,
    (SELECT COUNT(*) FROM messages) AS messages,
    (SELECT COUNT(*) FROM users WHERE email LIKE 'demo%@example.com') AS demo_users`)
  const values = Object.values(existing.rows[0]).map(Number)
  if (values.some((value) => value > 0)) throw new Error('Сначала очистите данные, чтобы избежать дубликатов')

  const passwordHash = await bcrypt.hash('DemoUser123!', 12)
  const assemblyPercent = await getNumberSetting('assembly_percent', 10)
  const client = await pool.connect()
  let totalTasks = 0
  try {
    await client.query('BEGIN')
    const users: string[] = []
    for (let index = 0; index < names.length; index++) {
      const { rows } = await client.query(
        'INSERT INTO users (name, email, password_hash, role, job_role, job_roles) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [names[index], `demo${index + 1}@example.com`, passwordHash, 'user', roles[index][0], roles[index]]
      )
      users.push(rows[0].id)
    }

    const clients: string[] = []
    for (let index = 0; index < 50; index++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
      const callSign = callSigns[Math.floor(Math.random() * callSigns.length)]
      const areaCode = 900 + Math.floor(Math.random() * 100)
      const localNumber = String(1000000 + Math.floor(Math.random() * 9000000))
      const { rows } = await client.query(
        'INSERT INTO clients (name, call_sign, email, phone, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [`${firstName} ${lastName}`, callSign, `client${index + 1}@example.com`, `+7 (${areaCode}) ${localNumber.slice(0, 3)} ${localNumber.slice(3, 5)}-${localNumber.slice(5, 7)}`, ['Постоянный клиент', 'Новый контакт', 'Рекомендация партнёра', 'Заказ по объявлению'][index % 4], users[index % users.length]
      ])
      clients.push(rows[0].id)
    }

    const priceLists: { id: string; items: string[] }[] = []
    const categories = ['Кухонные услуги', 'Дополнительно']
    for (let list = 0; list < 5; list++) {
      const { rows } = await client.query('INSERT INTO price_lists (title, print_title, notes, created_by) VALUES ($1, $2, $3, $4) RETURNING id', [`Прайс ${list + 1}`, 'Прайс-лист на дополнительные услуги по сборке мебели', 'Дополнительные работы согласовываются на месте.', users[list % users.length]])
      const items: string[] = []
      for (let item = 0; item < 40; item++) {
        const inserted = await client.query('INSERT INTO price_list_items (list_id, category, name, price, position) VALUES ($1, $2, $3, $4, $5) RETURNING id', [rows[0].id, categories[item % 2], `${categories[item % 2]} — услуга ${item + 1}`, 500 + item * 250, item])
        items.push(inserted.rows[0].id)
      }
      priceLists.push({ id: rows[0].id, items })
    }

    const admin = await client.query("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1")
    const adminId = admin.rows[0].id
    const orders: { id: string; members: string[]; priceItems: string[] }[] = []
    for (let index = 0; index < 60; index++) {
      const amount = 50000 + index * 12500
      const advance = Math.round(amount * (index % 4 + 1) * 0.1)
      const assembly = Number((amount * assemblyPercent / 100).toFixed(2))
      const creator = users[index % users.length]
      const priceList = priceLists[index % priceLists.length]
      const { rows } = await client.query(
        `INSERT INTO orders (title, description, address, address_lat, address_lng, price_list_id, status, amount, advance_amount, assembly_amount, client_id, creator_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          `Заказ на мебель ${index + 1}`,
          'Тестовый заказ с полным набором данных',
          `Москва, Тверская улица, ${index + 1}`,
          55.76 + index * 0.001,
          37.61 + index * 0.001,
          priceList.id,
          statuses[index % statuses.length],
          amount,
          advance,
          assembly,
          clients[index % clients.length],
          creator,
        ]
      )
      const orderId = rows[0].id
      const members = [...new Set([adminId, creator, users[(index + 1) % users.length], users[(index + 2) % users.length]])]
      for (const [memberIndex, userId] of members.entries()) {
        await client.query('INSERT INTO order_members (order_id, user_id, can_edit) VALUES ($1, $2, $3)', [orderId, userId, memberIndex < 2])
      }
      const taskCount = 2 + Math.floor(Math.random() * 6)
      for (let task = 0; task < taskCount; task++) {
        totalTasks += 1
        const taskType = taskTypes[(index + task) % taskTypes.length]
        const insertedTask = await client.query('INSERT INTO tasks (order_id, title, task_type, due_date, completed, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [orderId, taskType, taskType, dateAfter((index + task) % 28), task % 3 === 0, creator])
        const assignees = [...members].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * members.length))
        for (const userId of assignees) await client.query('INSERT INTO task_members (task_id, user_id) VALUES ($1, $2)', [insertedTask.rows[0].id, userId])
      }
      for (const [itemIndex, priceItem] of priceList.items.entries()) {
        await client.query('INSERT INTO order_price_items (order_id, price_item_id, completed, updated_by) VALUES ($1, $2, $3, $4)', [orderId, priceItem, itemIndex % 3 === 0, creator])
      }
      await logActivity(orderId, creator, 'created', 'создал заказ', client)
      orders.push({ id: orderId, members, priceItems: priceList.items })
    }

    for (const [index, userId] of users.entries()) {
      if (roles[index].includes('assembler')) {
        await client.query('INSERT INTO unavailable_days (user_id, date, reason) VALUES ($1, $2, $3), ($1, $4, $5)', [userId, dateAfter(index % 7 + 2), 'Отгул', dateAfter(index % 7 + 5), 'Личные дела'])
      }
    }

    for (let index = 0; index < 200; index++) {
      const order = orders[index % orders.length]
      const sender = order.members[(index * 2 + 1) % order.members.length]
      const direct = index % 3 === 0
      const recipient = order.members[(index + 2) % order.members.length]
      const { rows } = await client.query(
        `INSERT INTO messages (order_id, recipient_id, user_id, body, created_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [direct ? null : order.id, direct ? recipient : null, sender, messageTexts[index % messageTexts.length], new Date(Date.now() - index * 3600000)]
      )
      if (index % 2 === 0) await client.query('INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2)', [rows[0].id, recipient])
      if (index % 3 === 0) await client.query('INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)', [rows[0].id, recipient, ['👍', '❤️', '🎉'][index % 3]])
    }

    await mkdir(path.resolve('data', 'uploads'), { recursive: true })
    await mkdir(path.resolve('data', 'message-files'), { recursive: true })
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    for (let index = 0; index < 5; index++) {
      const order = orders[index]
      const storedName = `seed-${order.id}.png`
      await writeFile(path.resolve('data', 'uploads', storedName), png)
      await client.query('INSERT INTO order_images (order_id, original_name, stored_name, mime_type, size, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6)', [order.id, 'test-image.png', storedName, 'image/png', png.length, order.members[0]])
    }
    const voice = wavFile()
    await writeFile(path.resolve('data', 'message-files', 'seed-voice.wav'), voice)
    const firstOrder = orders[0]
    await client.query(
      `INSERT INTO messages (order_id, user_id, body, attachment_path, attachment_name, attachment_mime, attachment_duration, attachment_size, transcript)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [firstOrder.id, firstOrder.members[0], '', 'message-files/seed-voice.wav', 'voice.wav', 'audio/wav', 1, voice.length, 'Это тестовое голосовое сообщение']
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return { users: 12, clients: 50, orders: 60, tasks: totalTasks, priceLists: 5, messages: 201, images: 5, voiceMessages: 1 }
}
