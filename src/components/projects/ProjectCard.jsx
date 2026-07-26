import { useState, useRef, useEffect } from 'react'
import { Trash2, Home, Share2, Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { ROOM_TYPES } from '../../lib/constants'
import { formatRelativeTime, cn } from '../../lib/utils'
import { Switch } from '../ui/Switch'

export function ProjectCard({ project, onOpen, onDelete, onTogglePublic }) {
  const [confirming, setConfirming] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const shareRef = useRef(null)
  const roomLabel = ROOM_TYPES.find((r) => r.value === project.roomType)?.label || project.roomType

  const shareUrl = project.shareToken ? `${window.location.origin}/view/${project.shareToken}` : ''

  useEffect(() => {
    if (!shareOpen) return
    const handleClickOutside = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) setShareOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [shareOpen])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copied.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the link.')
    }
  }

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
            {project.isPublic && (
              <>
                <span>·</span>
                <span className="text-primary">Public</span>
              </>
            )}
          </div>
        </div>
      </button>

      <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100" style={shareOpen || confirming ? { opacity: 1 } : undefined}>
        <div ref={shareRef} className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShareOpen((v) => !v)
            }}
            aria-label="Share floorplan"
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md shadow-sm transition-colors',
              project.isPublic ? 'bg-primary text-white' : 'bg-surface/90 text-ink-muted hover:bg-paper'
            )}
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>

          {shareOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-8 z-20 w-64 rounded-lg border border-line bg-surface p-3 text-left shadow-panel"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-ink">Public link</span>
                <Switch checked={!!project.isPublic} onCheckedChange={(checked) => onTogglePublic(project, checked)} />
              </div>

              {project.isPublic ? (
                <>
                  <p className="mb-2 text-xs text-ink-muted">Anyone with this link can view (not edit) this floorplan.</p>
                  <div className="flex items-center gap-1">
                    <input
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.target.select()}
                      className="h-8 flex-1 truncate rounded-md border border-line bg-paper px-2 text-xs text-ink"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-muted hover:bg-paper hover:text-ink"
                      aria-label="Copy link"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-ink-muted">Turn this on to get a link anyone can use to view this floorplan.</p>
              )}
            </div>
          )}
        </div>

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
            'flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium shadow-sm transition-colors',
            confirming ? 'bg-danger text-white' : 'bg-surface/90 text-danger hover:bg-danger-soft'
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {confirming && 'Confirm'}
        </button>
      </div>
    </div>
  )
}
