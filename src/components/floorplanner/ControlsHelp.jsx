import { useState } from 'react'
import { HelpCircle, X, RotateCw, ZoomIn, Move, MousePointer2, Pencil, Eraser, Ruler, Scissors, Scan } from 'lucide-react'
import { cn } from '../../lib/utils'

const HELP_2D = [
  { icon: Move, title: 'Move', body: 'Drag walls or corners to reshape the room — they snap to nearby corners and edges too.' },
  { icon: Pencil, title: 'Draw', body: 'Click to place wall points — they snap to corners, edges, crossings, and 15° angles.' },
  { icon: Scissors, title: 'Cut', body: 'Hover a wall and click to split it in two. Type a number and press Enter to cut at an exact length.' },
  { icon: Ruler, title: 'Measure', body: 'Click two points to see the distance between them — nothing is changed.' },
  { icon: Eraser, title: 'Erase', body: 'Click a wall or corner to remove it.' },
  { icon: ZoomIn, title: 'Zoom & pan', body: 'Scroll to zoom, middle-drag to pan.' }
]

const HELP_3D = [
  { icon: RotateCw, title: 'Left-click + drag', body: 'Rotate the camera around the room.' },
  { icon: ZoomIn, title: 'Scroll', body: 'Zoom in and out.' },
  { icon: Move, title: 'Right-click + drag', body: 'Pan the camera.' },
  { icon: MousePointer2, title: 'Hover', body: 'Highlights the item or room under your cursor.' },
  { icon: Scan, title: 'Press F', body: 'Frames whatever you\'re hovering (or last selected) in view. Clicking a room does this too.' },
  { icon: MousePointer2, title: 'Click an item', body: 'Select it to move, resize, or delete.' }
]

export function ControlsHelp({ viewMode = '3d' }) {
  const [open, setOpen] = useState(false)
  const items = viewMode === '2d' ? HELP_2D : HELP_3D

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Show controls"
        className="fixed bottom-5 right-5 z-[80] flex h-11 w-11 items-center justify-center rounded-full bg-surface border border-line shadow-panel text-ink-muted hover:text-ink transition-colors"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/40 backdrop-blur-[2px] animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-[90vw] max-w-sm rounded-lg bg-surface shadow-pop animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold text-ink">
                {viewMode === '2d' ? '2D floorplanner controls' : '3D viewer controls'}
              </h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-muted hover:bg-ink/5 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {items.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary')}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{title}</p>
                    <p className="text-xs text-ink-muted">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
