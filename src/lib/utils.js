import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge conditional classnames + resolve Tailwind conflicts. */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** \"3 hours ago\", \"2 days ago\", etc. Accepts either an epoch-ms number
 * or an ISO date string. */
export function formatRelativeTime(timestamp) {
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp
  const diffMs = Date.now() - ms
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return 'just now'
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`
  if (diffMs < day * 30) return `${Math.floor(diffMs / day)}d ago`
  return new Date(ms).toLocaleDateString()
}
