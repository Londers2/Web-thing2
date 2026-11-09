import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid'
import { Button } from './catalyst/button'

type PageItem = number | 'ellipsis'

function paginationItems(page: number, pages: number): PageItem[] {
  const candidates = [1, 2, 3, page - 1, page, page + 1, pages - 2, pages - 1, pages]
    .filter((value) => value >= 1 && value <= pages)
  const values = [...new Set(candidates)].sort((a, b) => a - b)
  const items: PageItem[] = []
  let previous = 0
  for (const value of values) {
    if (previous && value - previous > 1) items.push('ellipsis')
    items.push(value)
    previous = value
  }
  return items
}

function PageNumber({ item, current, onPage }: { item: PageItem; current: boolean; onPage: () => void }) {
  if (item === 'ellipsis') return <span className="px-1.5 text-zinc-400">…</span>
  return (
    <button
      type="button"
      onClick={onPage}
      aria-current={current ? 'page' : undefined}
      className={`min-w-8 rounded-md border px-2.5 py-1.5 text-sm ${current ? 'border-(--accent) text-(--accent)' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/5'}`}
    >
      {item}
    </button>
  )
}

export function Pagination({ page, pages, total, onPage, pageSize = 10 }: { page: number; pages: number; total: number; onPage: (page: number) => void; pageSize?: number }) {
  if (pages <= 1) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const items = paginationItems(page, pages)

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-950/10 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-zinc-900">
      <span className="text-zinc-500">Показано {start}–{end} из {total}</span>
      <div className="max-sm:hidden">
        <div className="flex items-center gap-1">
          <Button plain className="px-2" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Предыдущая страница"><ChevronLeftIcon /></Button>
          {items.map((item, index) => <PageNumber key={`${item}-${index}`} item={item} current={item === page} onPage={() => onPage(item as number)} />)}
          <Button plain className="px-2" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Следующая страница"><ChevronRightIcon /></Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:hidden">
        <Button plain disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeftIcon />Previous</Button>
        <Button plain disabled={page >= pages} onClick={() => onPage(page + 1)}>Next<ChevronRightIcon /></Button>
      </div>
    </div>
  )
}
