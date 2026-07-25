import { useState } from 'react'
import { Trash2, Home } from 'lucide-react'
import { ROOM_TYPES } from '../../lib/constants'
import { formatRelativeTime, cn } from '../../lib/utils'

export function ProjectCard({ project, onOpen, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const roomLabel = ROOM_TYPES.find((r) => r.value === project.roomType)?.label || project.roomType

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-shadow hover:shadow-sm">
      <button onClick={() => onOpen(project)} className="flex flex-col text-left">
        <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-paper">
          {project.thumbnailUrl ? (
            <img src={project.thumbnailUrl} alt={project.name} className="h-full w-full object-cover" />
          ) : (
            <Home className="h-8 w-8 text-line-strong" strokeWidth={1.5} />
          )}
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-medium text-ink">{project.name}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
            <span>{roomLabel}</span>
            <span>·</span>
            <span>{formatRelativeTime(project.updatedAt)}</span>
          </div>
        </div>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation()
          if (confirming) {
            onDelete(project.id)
          } else {
            setConfirming(true)
            setTimeout(() => setConfirming(false), 2500)
          }
        }}
        aria-label="Delete floorplan"
        className={cn(
          'absolute right-2 top-2 flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium shadow-sm transition-all',
          confirming
            ? 'bg-danger text-white opacity-100'
            : 'bg-surface/90 text-danger opacity-0 group-hover:opacity-100 hover:bg-danger-soft'
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {confirming && 'Confirm'}
      </button>
    </div>
  )
}
