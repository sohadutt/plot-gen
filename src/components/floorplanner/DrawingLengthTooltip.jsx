import { Ruler } from 'lucide-react'
import { Configuration, configDimUnit } from '@blueprint3d/core/configuration'
import { cn } from '../../lib/utils'

const UNIT_SUFFIX = { inch: 'in', cm: 'cm', m: 'm', mm: 'mm' }

export function DrawingLengthTooltip({ info }) {
  if (!info) return null

  const unit = Configuration.getStringValue(configDimUnit)
  const suffix = UNIT_SUFFIX[unit] || unit

  return (
    <div
      className="pointer-events-none fixed z-[90]"
      style={{ left: info.screenX + 18, top: info.screenY + 18 }}
    >
      <div
        className={cn(
          'flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs font-mono font-medium shadow-panel',
          info.isTyping ? 'border-primary bg-primary text-primary-foreground' : 'border-line bg-surface/95 text-ink backdrop-blur-sm'
        )}
      >
        <Ruler className="h-3.5 w-3.5 shrink-0 opacity-70" />
        {info.isTyping ? (
          <span>
            {info.typedValue || '0'}
            {suffix}
            <span className="ml-0.5 animate-pulse">|</span>
          </span>
        ) : (
          <span>{info.formatted}</span>
        )}
        {typeof info.angleDegrees === 'number' && (
          <span
            className={cn(
              'border-l pl-1.5',
              info.isTyping ? 'border-primary-foreground/30' : 'border-line'
            )}
          >
            {info.angleDegrees}°{info.angleSnapped && !info.isTyping && (
              <span className="ml-0.5 text-primary">•</span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
