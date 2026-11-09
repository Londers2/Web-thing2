import { Router } from 'express'
import { z } from 'zod'

export const geoRouter = Router()

geoRouter.get('/search', async (req, res, next) => {
  try {
    const { q } = z.object({ q: z.string().trim().min(2).max(500) }).parse(req.query)
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'json')
    url.searchParams.set('q', q)
    url.searchParams.set('limit', '6')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('accept-language', 'ru')
    const response = await fetch(url, { headers: { 'User-Agent': 'OrderWorkspace/1.0', Accept: 'application/json' } })
    if (!response.ok) throw new Error('geocoder unavailable')
    const items = await response.json() as { display_name: string; lat: string; lon: string }[]
    res.json(items.map((item) => ({ address: item.display_name, lat: Number(item.lat), lng: Number(item.lon) })))
  } catch {
    res.status(502).json({ error: 'Сервис подсказок адресов временно недоступен' })
  }
})
