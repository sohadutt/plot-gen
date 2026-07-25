import { Sun, Moon } from 'lucide-react'
import { Button } from './Button'
import { useTheme } from '../../contexts/ThemeContext'

export function ThemeToggle({ size = 'icon', variant = 'outline', className }) {
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={className}
    >
      {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
