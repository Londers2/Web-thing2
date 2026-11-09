import type { User } from '../types'
import { UserAvatar } from './UserAvatar'

export function AssigneeAvatars({ users, max = 3, className = 'size-5' }: { users: User[]; max?: number; className?: string }) {
  if (!users.length) return null
  return (
    <span className="mt-1 flex items-center" aria-label={`Исполнители: ${users.map((user) => user.name).join(', ')}`}>
      <span className="flex -space-x-1.5">
        {users.slice(0, max).map((user) => <UserAvatar key={user.id} user={user} className={`${className} ring-2 ring-white dark:ring-zinc-900`} />)}
      </span>
      {users.length > max && <span className="ml-1 text-[10px] text-zinc-500">+{users.length - max}</span>}
    </span>
  )
}
