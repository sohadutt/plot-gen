import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Skeleton } from './Skeleton'

export function Spinner({ className }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-ink-muted', className)} />
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-ink-muted">
      <Spinner className="h-5 w-5" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

/** A grid of card-shaped skeletons, for catalog/project grids while their first fetch is in flight. */
export function GridSkeleton({ count = 6, className }) {
  return (
    <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-line">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-1.5 p-3">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {Icon && <Icon className="h-9 w-9 text-line-strong mb-1" strokeWidth={1.5} />}
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      {description && <p className="text-xs text-ink-muted max-w-[220px]">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
