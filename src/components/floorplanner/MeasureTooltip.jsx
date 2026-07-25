import { Ruler } from 'lucide-react'
import { cn } from '../../lib/utils'

export function MeasureTooltip({ info }) {
  if (!info) return null

  return (
    <div className="pointer-events-none fixed z-[90]" style={{ left: info.screenX + 18, top: info.screenY + 18 }}>
      <div className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface/95 px-2.5 py-1.5 text-xs font-mono font-medium text-ink shadow-panel backdrop-blur-sm">
        <Ruler className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span>{info.formatted}</span>
        {typeof info.angleDegrees === 'number' && (
          <span className={cn('border-l pl-1.5 border-line')}>
            {info.angleDegrees}°{info.angleSnapped && <span className="ml-0.5 text-primary">•</span>}
          </span>
        )}
      </div>
    </div>
  )
}
