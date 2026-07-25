import { Move, Pencil, Eraser, Check, Scissors, Ruler } from 'lucide-react'
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

export function FloorplannerControls({ mode, onModeChange, onDone }) {
  const isMobile = useIsMobile()

  return (
    <div className={cn('absolute left-0 top-0 z-[60] w-full pointer-events-none', isMobile ? 'p-3' : 'p-5')}>
      <div className="flex items-center justify-between gap-2">
        <div className={cn('flex rounded-lg border border-line bg-surface/90 backdrop-blur-sm p-1 pointer-events-auto shadow-sm', isMobile ? 'gap-0.5' : 'gap-1')}>
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

        <Button onClick={onDone} variant="primary" size="sm" className="pointer-events-auto shadow-sm">
          <Check className="h-4 w-4" />
          Done
        </Button>
      </div>

      {mode === 'draw' && (
        <div className="mt-2 inline-flex pointer-events-none rounded-md bg-ink/80 px-2.5 py-1.5 text-xs text-white">
          Click to place points · snaps to corners, edges & 15° angles · type a number + Enter for an exact length · Esc to finish
        </div>
      )}

      {mode === 'cut' && (
        <div className="mt-2 inline-flex pointer-events-none rounded-md bg-ink/80 px-2.5 py-1.5 text-xs text-white">
          Hover a wall, click to cut · type a number + Enter to cut at an exact length
        </div>
      )}

      {mode === 'measure' && (
        <div className="mt-2 inline-flex pointer-events-none rounded-md bg-ink/80 px-2.5 py-1.5 text-xs text-white">
          Click a point, move the mouse to measure · click again to measure from there · Esc to stop
        </div>
      )}
    </div>
  )
}
