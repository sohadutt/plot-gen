import { useNavigate } from 'react-router'
import { LayoutDashboard, LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Avatar, AvatarFallback } from '../ui/Avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '../ui/DropdownMenu'
import { cn } from '../../lib/utils'

export function AccountMenu({ compact }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const initial = user.name?.trim()?.[0]?.toUpperCase() || '?'

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="Account menu" className="rounded-full transition-opacity hover:opacity-90">
          <Avatar className={compact ? 'h-8 w-8' : 'h-9 w-9'}>
            <AvatarFallback className={cn(compact && 'text-xs')}>{initial}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/dashboard')}>
          <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem destructive onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
