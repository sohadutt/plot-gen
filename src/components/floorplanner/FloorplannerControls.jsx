import { Move, Pencil, Eraser, Check, Scissors, Ruler, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import { useIsMobile } from '../../hooks/useMediaQuery'

const MODES = [
  { id: 'move', label: 'Move', icon: Move },
  { id: 'draw', label: 'Draw walls', icon: Pencil },
  { id: 'cut', label: 'Cut wall', icon: Scissors },
  { id: 'measure', label: 'Measure', icon: Ruler },
  { id: 'delete', label: 'Erase', icon: Eraser }
]

export function FloorplannerControls({ mode, onModeChange, onDone, onZoomIn, onZoomOut, onFitView }) {
  const isMobile = useIsMobile()

  return (
    <div className={cn('absolute left-0 top-0 z-[60] w-full pointer-events-none', isMobile ? 'p-3' : 'p-5')}>
      <div className={cn('flex gap-2', isMobile ? 'flex-col items-start' : 'items-center justify-between')}>
        <div
          className={cn(
            'flex rounded-lg border border-line bg-surface/90 backdrop-blur-sm p-1 pointer-events-auto shadow-sm',
            isMobile ? 'max-w-full gap-0.5 overflow-x-auto scrollbar-none' : 'gap-1'
          )}
        >
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onModeChange(id)}
              aria-pressed={mode === id}
              title={label}
              className={cn(
                'flex items-center gap-1.5 rounded-md font-medium transition-colors',
                isMobile ? 'h-9 w-9 justify-center' : 'h-8 px-3 text-xs',
                mode === id ? 'bg-primary text-primary-foreground' : 'text-ink-muted hover:bg-ink/5 hover:text-ink'
              )}
            >
              <Icon className="h-4 w-4" />
              {!isMobile && label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex overflow-hidden rounded-lg border border-line bg-surface/90 p-1 shadow-sm backdrop-blur-sm">
            <Button onClick={onZoomOut} variant="ghost" size="icon-sm" aria-label="Zoom out" title="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button onClick={onFitView} variant="ghost" size="icon-sm" aria-label="Fit to screen" title="Fit to screen">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button onClick={onZoomIn} variant="ghost" size="icon-sm" aria-label="Zoom in" title="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={onDone} variant="primary" size="sm" className="shadow-sm">
            <Check className="h-4 w-4" />
            Done
          </Button>
        </div>
      </div>

      {mode === 'draw' && (
        <div className={cn('mt-2 inline-flex pointer-events-none rounded-md bg-ink/80 px-2.5 py-1.5 text-xs text-white', isMobile && 'hidden')}>
          Click to place points - snaps to corners, edges & 15° angles - type a number + Enter for an exact length - Esc to finish
        </div>
      )}

      {mode === 'cut' && (
        <div className={cn('mt-2 inline-flex pointer-events-none rounded-md bg-ink/80 px-2.5 py-1.5 text-xs text-white', isMobile && 'hidden')}>
          Hover a wall, click to cut - type a number + Enter to cut at an exact length
        </div>
      )}

      {mode === 'measure' && (
        <div className={cn('mt-2 inline-flex pointer-events-none rounded-md bg-ink/80 px-2.5 py-1.5 text-xs text-white', isMobile && 'hidden')}>
          Click a point, move the mouse to measure - click again to measure from there - Esc to stop
        </div>
      )}
    </div>
  )
}
