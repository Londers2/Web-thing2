export function Loading({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-zinc-500" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
      {label}
    </div>
  )
}

export function ErrorAlert({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return <div role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-600/10 ring-inset dark:bg-red-950/30 dark:text-red-400">{children}</div>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-700">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
