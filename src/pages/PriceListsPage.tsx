import { useEffect, useState } from 'react'
import { PencilSquareIcon, PlusIcon, PrinterIcon, TrashIcon } from '@heroicons/react/16/solid'
import { api, jsonBody } from '../api'
import type { PriceItem, PriceList } from '../types'
import { Button } from '../components/catalyst/button'
import { Heading, Subheading } from '../components/catalyst/heading'
import { Input } from '../components/catalyst/input'
import { Select } from '../components/catalyst/select'
import { Textarea } from '../components/catalyst/textarea'
import { ErrorAlert, Loading } from '../components/Loading'
import { Field, Label } from '../components/catalyst/fieldset'
import { PriceListDocument } from '../components/PriceListDocument'

const blankItem = (kind: PriceItem['kind'] = 'service'): PriceItem => ({ id: crypto.randomUUID(), kind, category: 'Услуги', name: kind === 'divider' ? 'Новый раздел' : '', price: 0, position: 0 })
const snapshot = (title: string, printTitle: string, notes: string, items: PriceItem[], fontSize: number) => JSON.stringify({ title, printTitle, notes, items, fontSize })

export function PriceListsPage() {
  const [lists, setLists] = useState<PriceList[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [printTitle, setPrintTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PriceItem[]>([])
  const [categories, setCategories] = useState<string[]>(['Услуги'])
  const [newCategory, setNewCategory] = useState('')
  const [fontSize, setFontSize] = useState(12)
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dirty = savedSnapshot !== snapshot(title, printTitle, notes, items, fontSize)

  useEffect(() => { api<PriceList[]>('/price-lists').then((data) => { setLists(data); if (data[0]) select(data[0]); else create() }).catch((reason) => setError(reason.message)).finally(() => setLoading(false)) }, [])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function select(list: PriceList) {
    setSelectedId(list.id)
    setTitle(list.title)
    setPrintTitle(list.printTitle || list.title)
    setNotes(list.notes || '')
    setItems(list.items)
    setCategories([...new Set(['Услуги', ...list.items.filter((item) => item.kind !== 'divider').map((item) => item.category).filter(Boolean)])])
    setFontSize(12)
    setSavedSnapshot(snapshot(list.title, list.printTitle || list.title, list.notes || '', list.items, 12))
  }

  function create() {
    setSelectedId(null)
    setTitle('Новый прайс-лист')
    setPrintTitle('Прайс-лист на дополнительные услуги')
    setNotes('')
    setItems([blankItem()])
    setCategories(['Услуги'])
    setFontSize(12)
    setSavedSnapshot(snapshot('Новый прайс-лист', 'Прайс-лист на дополнительные услуги', '', [blankItem()], 12))
  }

  function guard() {
    return !dirty || window.confirm('Есть несохранённые изменения. Продолжить без сохранения?')
  }

  function guardedSelect(list: PriceList) { if (guard()) select(list) }
  function guardedCreate() { if (guard()) create() }
  function updateItem(id: string, patch: Partial<PriceItem>) { setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)) }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const saved = await api<PriceList>(selectedId ? `/price-lists/${selectedId}` : '/price-lists', { method: selectedId ? 'PATCH' : 'POST', body: jsonBody({ title, printTitle, notes, items: items.filter((item) => item.kind !== 'divider' && item.category).map((item, position) => ({ ...item, position })) }) })
      setLists((current) => [saved, ...current.filter((list) => list.id !== saved.id)])
      select(saved)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить прайс-лист') }
    finally { setBusy(false) }
  }

  async function remove() {
    if (!selectedId || !guard() || !window.confirm('Удалить этот прайс-лист?')) return
    await api(`/price-lists/${selectedId}`, { method: 'DELETE' })
    const remaining = lists.filter((list) => list.id !== selectedId)
    setLists(remaining)
    if (remaining[0]) select(remaining[0])
    else create()
  }

  function addCategory() {
    const category = newCategory.trim()
    if (!category) return
    setCategories((current) => [...new Set([...current, category])])
    setNewCategory('')
  }

  function renameCategory(oldName: string) {
    const nextName = window.prompt('Название категории', oldName)?.trim()
    if (!nextName || nextName === oldName) return
    setCategories((current) => current.map((category) => category === oldName ? nextName : category))
    setItems((current) => current.map((item) => item.category === oldName ? { ...item, category: nextName } : item))
  }

  function deleteCategory(name: string) {
    if (!window.confirm(`Удалить категорию «${name}»? Услуги останутся без категории и будут скрыты.`)) return
    setCategories((current) => current.filter((category) => category !== name))
    setItems((current) => current.map((item) => item.category === name ? { ...item, category: '' } : item))
  }

  if (loading) return <Loading />

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><Heading>Прайс-листы</Heading>{dirty && <p className="mt-1 text-xs text-amber-600">Есть несохранённые изменения</p>}</div><Button onClick={guardedCreate}><PlusIcon />Новый прайс-лист</Button></div>
      <ErrorAlert>{error}</ErrorAlert>
      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside><Subheading>Мои списки</Subheading><div className="mt-4 space-y-1">{lists.length === 0 ? <p className="text-sm text-zinc-500">Создайте первый список услуг.</p> : lists.map((list) => <button key={list.id} type="button" onClick={() => guardedSelect(list)} className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm ${selectedId === list.id ? 'bg-zinc-100 font-medium dark:bg-white/10' : 'hover:bg-zinc-50 dark:hover:bg-white/5'}`}>{list.title}</button>)}</div><div className="mt-8"><Subheading>Категории</Subheading><div className="mt-4 space-y-2">{categories.map((category) => <div key={category} className="flex items-center gap-1 rounded-lg bg-zinc-50 px-2 py-1.5 text-sm dark:bg-white/[2.5%]"><span className="min-w-0 flex-1 truncate">{category}</span><Button plain aria-label={`Изменить ${category}`} onClick={() => renameCategory(category)}><PencilSquareIcon /></Button><Button plain aria-label={`Удалить ${category}`} onClick={() => deleteCategory(category)}><TrashIcon /></Button></div>)}</div><div className="mt-3 flex gap-2"><Input aria-label="Новая категория" placeholder="Новая категория" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }} /><Button plain aria-label="Добавить категорию" onClick={addCategory}><PlusIcon /></Button></div></div></aside>
        <section className="min-w-0">
          <Field><Label>Внутреннее название</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название для внутреннего использования" /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field><Label>Заголовок на печати</Label><Textarea rows={2} value={printTitle} onChange={(e) => setPrintTitle(e.target.value)} placeholder="Заголовок на печати" /></Field><Field><Label>Примечания и условия</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Примечания и условия" /></Field></div>
          <div className="mt-6 space-y-3">{items.filter((item) => item.kind !== 'divider' && item.category).map((item, index) => <div key={item.id} className="grid gap-2 rounded-lg bg-zinc-50 p-3 sm:grid-cols-[180px_1fr_140px_36px] dark:bg-white/[2.5%]"><Select aria-label="Категория" value={item.category} onChange={(e) => updateItem(item.id, { category: e.target.value })}><option value="">Выберите категорию</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</Select><Input aria-label="Услуга" required value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value })} placeholder="Наименование услуги" /><Input aria-label="Цена" type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(item.id, { price: Number(e.target.value), position: index })} /><Button plain aria-label="Удалить услугу" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}><TrashIcon /></Button></div>)}</div>
          <div className="mt-3 flex flex-wrap gap-2"><Button plain onClick={() => setItems((current) => [...current, blankItem()])}><PlusIcon />Добавить услугу</Button></div>
          <div className="mt-5 flex flex-wrap items-end gap-3"><Button color="dark/zinc" className="px-6 shadow-md ring-1 ring-(--accent)" disabled={busy || !title || items.some((item) => !item.name)} onClick={() => void save()}>{busy ? 'Сохранение…' : 'Сохранить'}</Button><Button outline onClick={() => window.print()}><PrinterIcon />Печать</Button><Select aria-label="Размер текста" className="w-40" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}><option value={10}>Текст 10 px</option><option value={12}>Текст 12 px</option><option value={14}>Текст 14 px</option><option value={16}>Текст 16 px</option><option value={18}>Текст 18 px</option></Select>{selectedId && <Button plain onClick={() => void remove()}><TrashIcon />Удалить</Button>}</div>
          <Subheading className="mt-10 mb-4">Предпросмотр печати</Subheading>
          <div className="overflow-x-auto rounded-lg shadow-sm ring-1 ring-zinc-950/10"><PriceListDocument title={printTitle} notes={notes} items={items} fontSize={fontSize} /></div>
        </section>
      </div>
    </>
  )
}
