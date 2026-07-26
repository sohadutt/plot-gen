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

  if (isMobile) {
    return (
      <div className="relative h-14 pointer-events-none">
        {!hideChrome && (
          <div className="absolute left-2 right-2 top-2 flex items-center gap-2 pointer-events-auto">
            {activeTab === 'design' && (
              <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface/90 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
                <span className={cn('text-xs font-medium', viewMode === '2d' ? 'text-ink' : 'text-ink-muted')}>2D</span>
                <Switch checked={viewMode === '3d'} onCheckedChange={(checked) => onViewModeChange(checked ? '3d' : '2d')} />
                <span className={cn('text-xs font-medium', viewMode === '3d' ? 'text-ink' : 'text-ink-muted')}>3D</span>
              </div>
            )}

            <div className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-line bg-surface/90 p-1 shadow-sm backdrop-blur-sm scrollbar-none">
              {activeTab === 'design' && (
                <>
                  <Button onClick={onUndo} variant="ghost" size="icon-sm" aria-label="Undo" title="Undo" disabled={!canUndo}>
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button onClick={onRedo} variant="ghost" size="icon-sm" aria-label="Redo" title="Redo" disabled={!canRedo}>
                    <Redo2 className="h-4 w-4" />
                  </Button>
                  <Button onClick={onRoomsClick} variant="ghost" size="icon-sm" aria-label="Rooms" title="Rooms">
                    <LayoutList className="h-4 w-4" />
                  </Button>
                  <Button onClick={onExportClick} variant="ghost" size="icon-sm" aria-label="Export image" title="Export image">
                    <ImageDown className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button onClick={onNew} variant="ghost" size="icon-sm" aria-label="New floorplan" title="New floorplan">
                <FilePlus className="h-4 w-4" />
              </Button>
              <Button onClick={onSave} variant="primary" size="sm" disabled={saving} className="h-8 px-3">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
              <Button onClick={onSettingsClick} variant="ghost" size="icon-sm" aria-label="Settings" title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
              <ThemeToggle size="icon-sm" variant="ghost" />
              <AccountMenu compact />
            </div>
          </div>
        )}

        {!hideChrome && (
          <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-[90] flex -translate-x-1/2 gap-1 rounded-full border border-line bg-surface/95 p-1 shadow-pop backdrop-blur-sm pointer-events-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'min-w-20 rounded-full px-3 py-2 text-xs font-medium transition-colors',
                  activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-ink-muted hover:bg-paper hover:text-ink'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {hideChrome && (
          <div className="absolute left-1/2 top-2 z-[100] -translate-x-1/2 pointer-events-auto">
            <div className="flex items-center gap-2 rounded-full border border-line bg-surface/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
              <span className="text-xs font-medium text-ink">2D</span>
              <Switch checked={viewMode === '3d'} onCheckedChange={(checked) => onViewModeChange(checked ? '3d' : '2d')} />
              <span className="text-xs font-medium text-ink-muted">3D</span>
            </div>
          </div>
        )}
      </div>
    )
  }

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
