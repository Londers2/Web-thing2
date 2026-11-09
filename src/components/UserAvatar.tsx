import type { User } from '../types'

function hashUser(id: string) {
  let hash = 2166136261
  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

export function UserAvatar({ user, className = 'size-10', square = false }: { user: Pick<User, 'id' | 'name' | 'avatarUrl'>; className?: string; square?: boolean }) {
  const rounding = square ? 'rounded-lg' : 'rounded-full'
  if (user.avatarUrl) return <img src={user.avatarUrl} alt={user.name} className={`${className} ${rounding} inline-block shrink-0 bg-zinc-100 object-cover align-middle ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:ring-white/10`} />
  const hash = hashUser(user.id)
  const hue = hash % 360
  const cells = Array.from({ length: 15 }, (_, index) => ((hash >> (index % 16)) & 1) === 1)
  return (
    <svg viewBox="0 0 50 50" preserveAspectRatio="xMidYMid meet" role="img" aria-label={user.name} className={`${className} ${rounding} inline-block shrink-0 bg-zinc-100 align-middle ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:ring-white/10`}>
      <rect width="50" height="50" fill={`hsl(${hue} 45% 92%)`} />
      {cells.map((filled, index) => {
        if (!filled) return null
        const x = index % 3
        const y = Math.floor(index / 3)
        return <g key={index} fill={`hsl(${hue} 55% 45%)`}><rect x={x * 10 + 5} y={y * 10 + 5} width="10" height="10" />{x < 2 && <rect x={(4 - x) * 10 + 5} y={y * 10 + 5} width="10" height="10" />}</g>
      })}
    </svg>
  )
}
