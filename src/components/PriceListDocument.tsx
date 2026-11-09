import type { PriceItem } from '../types'

export function PriceListDocument({ title, notes, items, completedOnly = false, fontSize = 12 }: { title: string; notes?: string | null; items: PriceItem[]; completedOnly?: boolean; fontSize?: number }) {
  const total = items.reduce((sum, item) => sum + (item.kind !== 'divider' && (!completedOnly || item.completed) ? item.price : 0), 0)
  let position = 0
  const rows: React.ReactNode[] = []
  let category = ''
  for (const item of items) {
    if (item.kind === 'divider') continue
    if (item.category !== category) {
      category = item.category
      rows.push(<tr key={`category-${category}-${position}`}><td colSpan={4} className="price-category">{category}</td></tr>)
    }
    position += 1
    rows.push(<tr key={item.id}><td className="price-number">{position}</td><td>{item.name}</td><td className="price-value">{item.price.toLocaleString('ru-RU')} р.</td><td className="price-check">{item.completed ? '✓' : ''}</td></tr>)
  }
  return (
    <div className="price-print" style={{ fontSize }}>
      <h2>{title}</h2>
      <table><thead><tr><th className="price-number">№</th><th>Наименование услуги</th><th className="price-value">Цена</th><th className="price-check" /></tr></thead><tbody>{rows}<tr><td colSpan={2} className="price-total">Итого:</td><td className="price-value">{total.toLocaleString('ru-RU')} р.</td><td /></tr></tbody></table>
      {notes && <p className="price-notes">{notes}</p>}
    </div>
  )
}
