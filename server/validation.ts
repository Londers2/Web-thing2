import { z } from 'zod'

export const emailSchema = z.string().trim().email('Введите корректный email').max(255).transform((v) => v.toLowerCase())
export const passwordSchema = z.string().min(10, 'Пароль должен содержать не менее 10 символов').max(200)
export const idSchema = z.string().uuid()
export const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null)

export const orderInputSchema = z.object({
  title: z.string().trim().min(1, 'Введите название').max(200),
  description: optionalText(10000),
  address: optionalText(500),
  addressLat: z.number().min(-90).max(90).nullable().default(null),
  addressLng: z.number().min(-180).max(180).nullable().default(null),
  status: z.enum(['new', 'in_progress', 'done', 'cancelled']).default('new'),
  amount: z.coerce.number().finite().min(0).max(999999999999).default(0),
  advanceAmount: z.coerce.number().finite().min(0).max(999999999999).default(0),
  assemblyAmount: z.coerce.number().finite().min(0).max(999999999999).nullable().default(null),
  clientId: idSchema,
  memberIds: z.array(idSchema).max(500).default([]),
  editorIds: z.array(idSchema).max(500).default([]),
})

export const clientInputSchema = z.object({
  name: z.string().trim().min(1, 'Введите имя клиента').max(160),
  callSign: optionalText(120),
  email: z.union([z.literal(''), emailSchema]).optional().nullable().transform((v) => v || null),
  phone: z.union([z.literal(''), z.string().regex(/^\+7 \(\d{3}\) \d{3} \d{2}-\d{2}$/, 'Введите телефон полностью')]).optional().nullable().transform((v) => v || null),
  notes: optionalText(10000),
})
