import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * shadcn/ui Button. Variant names are kept as `primary`/`secondary`/`outline`/
 * `ghost`/`danger` (this project's existing convention) rather than shadcn's
 * defaults (`default`/`destructive`) — `default` and `destructive` are also
 * accepted as aliases, so either naming works.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        secondary: 'bg-card text-foreground border border-border hover:bg-secondary',
        outline: 'bg-transparent text-foreground border border-border hover:bg-secondary',
        ghost: 'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        sm: 'h-8 px-3 text-xs gap-1.5 [&_svg]:size-3.5',
        md: 'h-9 px-4 gap-2 [&_svg]:size-4',
        default: 'h-9 px-4 gap-2 [&_svg]:size-4',
        lg: 'h-10 px-5 text-sm gap-2 [&_svg]:size-4',
        icon: 'h-9 w-9 p-0 [&_svg]:size-4',
        'icon-sm': 'h-8 w-8 p-0 [&_svg]:size-3.5'
      }
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md'
    }
  }
)

export const Button = forwardRef(function Button(
  { className, variant, size, asChild = false, ...props },
  ref
) {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
