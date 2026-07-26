import { useState, useRef, useEffect } from 'react'
import { Trash2, Home, Share2, Check, Copy, Pencil, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ROOM_TYPES } from '../../lib/constants'
import { formatRelativeTime, cn } from '../../lib/utils'
import { Switch } from '../ui/Switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

export function ProjectCard({ project, onOpen, onDelete, onTogglePublic, onRename }) {
  const [confirming, setConfirming] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [draftName, setDraftName] = useState(project.name)
  const [renaming, setRenaming] = useState(false)
  const shareRef = useRef(null)
  const roomLabel = ROOM_TYPES.find((r) => r.value === project.roomType)?.label || project.roomType

  const shareUrl = project.shareToken ? `${window.location.origin}/view/${project.shareToken}` : ''
  const waitingForShareUrl = project.isPublic && !shareUrl

  useEffect(() => {
    if (!shareOpen) return
    const handleClickOutside = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) setShareOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [shareOpen])

  const handleCopyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copied.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  const handleRename = async (event) => {
    event.preventDefault()
    const nextName = draftName.trim()
    if (!nextName || nextName === project.name) {
      setRenameOpen(false)
      return
    }

    setRenaming(true)
    try {
      await onRename?.(project, nextName)
      setRenameOpen(false)
    } finally {
      setRenaming(false)
    }
  }

  return (
    <div
      className={cn(
        'group relative z-0 flex flex-col overflow-visible rounded-lg border border-line bg-surface transition-shadow hover:z-10 hover:shadow-sm',
        (shareOpen || confirming) && 'z-20'
      )}
    >
      <button onClick={() => onOpen(project)} className="flex flex-col text-left">
        <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-t-lg bg-paper">
          {project.thumbnailUrl ? (
            <img src={project.thumbnailUrl} alt={project.name} className="h-full w-full object-cover" />
          ) : (
            <Home className="h-8 w-8 text-line-strong" strokeWidth={1.5} />
          )}
        </div>
        <div className="p-3 sm:p-3">
          <p className="truncate text-sm font-medium text-ink">{project.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-muted">
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

      <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100" style={shareOpen || confirming || renameOpen ? { opacity: 1 } : undefined}>
        {onRename && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDraftName(project.name)
              setRenameOpen(true)
            }}
            aria-label="Rename project"
            title="Rename project"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-surface/90 text-ink-muted shadow-sm transition-colors hover:bg-paper hover:text-ink md:h-7 md:w-7"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}

        <div ref={shareRef} className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShareOpen((v) => !v)
            }}
            aria-label="Share floorplan"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md shadow-sm transition-colors md:h-7 md:w-7',
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
                <Switch checked={!!project.isPublic} onCheckedChange={(checked) => onTogglePublic?.(project, checked)} />
              </div>

              {project.isPublic ? (
                <>
                  <p className="mb-2 text-xs text-ink-muted">Anyone with this link can view (not edit) this floorplan.</p>
                  {waitingForShareUrl ? (
                    <div className="rounded-md border border-line bg-paper px-2 py-2 text-xs text-ink-muted">
                      Creating public link...
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        readOnly
                        value={shareUrl}
                        onFocus={(e) => e.target.select()}
                        className="h-8 min-w-0 flex-1 truncate rounded-md border border-line bg-paper px-2 text-xs text-ink"
                      />
                      <button
                        onClick={handleCopyLink}
                        disabled={!shareUrl}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-muted hover:bg-paper hover:text-ink disabled:pointer-events-none disabled:opacity-50"
                        aria-label="Copy link"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  )}
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
            'flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium shadow-sm transition-colors md:h-7',
            confirming ? 'bg-danger text-white' : 'bg-surface/90 text-danger hover:bg-danger-soft'
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {confirming && 'Confirm'}
        </button>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>Update the project name shown in your workspace.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRename}>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-muted">Name</span>
              <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} autoFocus />
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={renaming || !draftName.trim()}>
                {renaming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rename'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
