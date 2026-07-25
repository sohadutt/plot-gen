import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export const Input = forwardRef(function Input({ className, type, ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm text-foreground',
        'placeholder:text-muted-foreground transition-colors outline-none',
        'selection:bg-primary selection:text-primary-foreground',
        'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-primary',
        'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed',
        'aria-invalid:ring-destructive/30 aria-invalid:border-destructive',
        className
      )}
      {...props}
    />
  )
})
