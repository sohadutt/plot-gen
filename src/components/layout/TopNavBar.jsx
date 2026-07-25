import { Settings, FilePlus, Loader2, LayoutList, ImageDown, Undo2, Redo2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Switch } from '../ui/Switch'
import { ThemeToggle } from '../ui/ThemeToggle'
import { AccountMenu } from './AccountMenu'
import { cn } from '../../lib/utils'
import { useIsMobile } from '../../hooks/useMediaQuery'

const TABS = [
  { id: 'design', label: 'Design' },
  { id: 'items', label: 'Add items' },
  { id: 'projects', label: 'Projects' }
]

export function TopNavBar({
  activeTab,
  onTabChange,
  viewMode,
  onViewModeChange,
  onSettingsClick,
  onRoomsClick,
  onExportClick,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  onNew,
  saving,
  projectName
}) {
  const isMobile = useIsMobile()
  const hideChrome = activeTab === 'design' && viewMode === '2d'

  return (
    <div className={cn('relative pointer-events-none', isMobile ? 'h-12' : 'h-14')}>
      {!hideChrome && (
        <div
          className={cn(
            'absolute top-0 flex items-center gap-1 pointer-events-auto',
            isMobile ? 'left-2 h-12' : 'left-4 h-14 gap-1.5'
          )}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'rounded-md font-medium transition-colors',
                isMobile ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
                activeTab === tab.id
                  ? 'bg-surface text-ink shadow-sm border border-line'
                  : 'text-ink-muted hover:text-ink hover:bg-ink/5'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'design' && (
        <div className="absolute left-1/2 top-1/2 z-[100] -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          <div
            className={cn(
              'flex items-center rounded-full border border-line bg-surface/80 backdrop-blur-sm shadow-sm',
              isMobile ? 'gap-2 px-3 py-1.5' : 'gap-2.5 px-4 py-2'
            )}
          >
            <span className={cn('font-medium', isMobile ? 'text-xs' : 'text-sm', viewMode === '2d' ? 'text-ink' : 'text-ink-muted')}>
              2D
            </span>
            <Switch checked={viewMode === '3d'} onCheckedChange={(checked) => onViewModeChange(checked ? '3d' : '2d')} />
            <span className={cn('font-medium', isMobile ? 'text-xs' : 'text-sm', viewMode === '3d' ? 'text-ink' : 'text-ink-muted')}>
              3D
            </span>
          </div>
        </div>
      )}

      {!hideChrome && (
        <div
          className={cn(
            'absolute top-0 flex items-center pointer-events-auto',
            isMobile ? 'right-2 h-12 gap-1' : 'right-4 h-14 gap-2'
          )}
        >
          {projectName && !isMobile && (
            <span className="mr-1 max-w-[160px] truncate text-xs text-ink-muted">{projectName}</span>
          )}
          {activeTab === 'design' && (
            <>
              <Button onClick={onUndo} variant="outline" size={isMobile ? 'icon-sm' : 'icon'} aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo}>
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button onClick={onRedo} variant="outline" size={isMobile ? 'icon-sm' : 'icon'} aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo}>
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button onClick={onRoomsClick} variant="outline" size={isMobile ? 'icon-sm' : 'icon'} aria-label="Rooms" title="Rooms">
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button onClick={onExportClick} variant="outline" size={isMobile ? 'icon-sm' : 'icon'} aria-label="Export image" title="Export image">
                <ImageDown className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button onClick={onNew} variant="outline" size={isMobile ? 'icon-sm' : 'sm'}>
            <FilePlus className="h-4 w-4" />
            {!isMobile && 'New'}
          </Button>
          <Button onClick={onSave} variant="primary" size={isMobile ? 'sm' : 'sm'} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
          <Button onClick={onSettingsClick} variant="outline" size={isMobile ? 'icon-sm' : 'icon'} aria-label="Settings">
            <Settings className="h-4 w-4" />
          </Button>
          <ThemeToggle size={isMobile ? 'icon-sm' : 'icon'} />
          <AccountMenu compact={isMobile} />
        </div>
      )}
    </div>
  )
}
