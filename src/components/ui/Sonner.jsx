import { Toaster as SonnerToaster } from 'sonner'
import { useTheme } from '../../contexts/ThemeContext'

export function Toaster(props) {
  const { resolvedTheme } = useTheme()

  return (
    <SonnerToaster
      theme={resolvedTheme}
      className="toaster group"
      style={{
        '--normal-bg': 'var(--popover)',
        '--normal-text': 'var(--popover-foreground)',
        '--normal-border': 'var(--border)'
      }}
      {...props}
    />
  )
}
