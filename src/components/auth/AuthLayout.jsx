import { Compass } from 'lucide-react'
import { ThemeToggle } from '../ui/ThemeToggle'

export function AuthLayout({ title, description, children, footer }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-blueprint-grid px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Compass className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold text-ink">Floor Planner</span>
        </div>

        <div className="rounded-lg border border-line bg-surface p-6 shadow-panel">
          <div className="mb-5">
            <h1 className="text-lg font-semibold text-ink">{title}</h1>
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>

          {children}
        </div>

        {footer && <div className="mt-5 text-center text-sm text-ink-muted">{footer}</div>}
      </div>
    </div>
  )
}
