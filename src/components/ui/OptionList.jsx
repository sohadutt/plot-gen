import { RadioGroup, RadioGroupItem } from './RadioGroup'
import { Label } from './Label'
import { cn } from '../../lib/utils'

/**
 * A vertical list of selectable cards — used in place of a plain radio
 * group for choices with a title + short description (room type, units,
 * etc). Built on shadcn/ui's RadioGroup for real radio semantics/keyboard
 * nav, styled as cards rather than a bare list of dots.
 */
export function OptionList({ options, value, onChange, className }) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className={cn('space-y-2', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <Label
            key={option.value}
            htmlFor={`option-${option.value}`}
            className={cn(
              'flex w-full cursor-pointer items-start gap-3 rounded-md border px-3.5 py-2.5 text-left font-normal transition-colors',
              active ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-secondary'
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">{option.label}</div>
              {option.description && <div className="mt-0.5 text-xs text-muted-foreground">{option.description}</div>}
            </div>
            <RadioGroupItem value={option.value} id={`option-${option.value}`} className="mt-0.5 shrink-0" />
          </Label>
        )
      })}
    </RadioGroup>
  )
}
