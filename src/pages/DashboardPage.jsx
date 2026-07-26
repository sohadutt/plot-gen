import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ArrowRight, Clock3, Compass, FolderOpen, Home, LayoutGrid, Plus, Share2, UserRound } from 'lucide-react'
import { fetchFloorplans, deleteFloorplan, updateFloorplan } from '../api/functions'
import { ROOM_TYPES } from '../lib/constants'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { GridSkeleton, EmptyState } from '../components/ui/Feedback'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/Avatar'
import { AccountMenu } from '../components/layout/AccountMenu'
import { ProjectCard } from '../components/projects/ProjectCard'
import { NewFloorplanDialog } from '../components/dialogs/NewFloorplanDialog'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [floorplans, setFloorplans] = useState([])
  const [loading, setLoading] = useState(true)
  const [newDialogOpen, setNewDialogOpen] = useState(false)

  useEffect(() => {
    let active = true
    fetchFloorplans({ sort: 'newest' })
      .then((data) => {
        if (active) setFloorplans(data)
      })
      .catch((error) => {
        console.error('Failed to load floorplans:', error)
        if (active) toast.error('Could not load your floorplans.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const handleOpen = (project) => {
    navigate('/planner', { state: { openFloorplanId: project.id } })
  }

  const handleDelete = async (id) => {
    const previous = floorplans
    setFloorplans((prev) => prev.filter((p) => p.id !== id))
    try {
      await deleteFloorplan(id)
      toast.success('Floorplan deleted.')
    } catch (error) {
      console.error('Failed to delete floorplan:', error)
      toast.error('Could not delete floorplan.')
      setFloorplans(previous)
    }
  }

  const handleTogglePublic = async (project, isPublic) => {
    const previous = floorplans
    setFloorplans((prev) => prev.map((p) => (p.id === project.id ? { ...p, isPublic } : p)))
    try {
      const updated = await updateFloorplan(project.id, {
        name: project.name,
        roomType: project.roomType,
        isPublic
      })
      setFloorplans((prev) => prev.map((p) => (p.id === project.id ? { ...p, ...updated } : p)))
      toast.success(isPublic ? 'Floorplan is now public.' : 'Floorplan is now private.')
    } catch (error) {
      console.error('Failed to update sharing:', error)
      toast.error('Could not update sharing.')
      setFloorplans(previous)
    }
  }

  const handleRename = async (project, name) => {
    const previous = floorplans
    setFloorplans((prev) => prev.map((p) => (p.id === project.id ? { ...p, name } : p)))
    try {
      const updated = await updateFloorplan(project.id, { name })
      setFloorplans((prev) => prev.map((p) => (p.id === project.id ? { ...p, ...updated } : p)))
      toast.success('Project renamed.')
      return updated
    } catch (error) {
      console.error('Failed to rename project:', error)
      toast.error('Could not rename project.')
      setFloorplans(previous)
      throw error
    }
  }

  const handleConfirmNew = (roomType) => {
    navigate('/planner', { state: { newRoomType: roomType } })
  }

  const firstName = user?.name?.split(' ')[0]
  const sharedCount = floorplans.filter((f) => f.isPublic).length
  const latestProject = floorplans[0]
  const initials = user?.name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?'
  const byRoomType = ROOM_TYPES.map((rt) => ({
    ...rt,
    count: floorplans.filter((f) => f.roomType === rt.value).length
  })).filter((rt) => rt.count > 0)

  return (
    <div className="h-screen w-full overflow-y-auto bg-blueprint-grid">
      <header className="border-b border-line bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Compass className="h-4.5 w-4.5" />
            </div>
            <span className="text-base font-semibold text-ink">Floor Planner</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="hidden sm:inline-flex">
              <UserRound className="h-4 w-4" />
              Profile
            </Button>
            <ThemeToggle variant="ghost" />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-5 sm:py-8">
        <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-lg border border-line bg-surface p-4 shadow-sm sm:p-5">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Home</p>
                <h1 className="text-2xl font-semibold text-ink">{firstName ? `Welcome back, ${firstName}` : 'Welcome back'}</h1>
                <p className="mt-2 max-w-xl text-sm text-ink-muted">Open a recent project, start a room type, or manage saved floorplans from one place.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button variant="outline" onClick={() => navigate('/planner', { state: { initialTab: 'projects' } })} className="w-full sm:w-auto">
                  <FolderOpen className="h-4 w-4" />
                  Browse all
                </Button>
                <Button variant="primary" onClick={() => setNewDialogOpen(true)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4" />
                  New floorplan
                </Button>
              </div>
            </div>

            {!loading && latestProject && (
              <button
                onClick={() => handleOpen(latestProject)}
                className="mt-6 flex w-full items-center justify-between rounded-md border border-line bg-paper px-4 py-3 text-left transition-colors hover:bg-secondary"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-ink-muted">Continue editing</span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-ink">{latestProject.name}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted" />
              </button>
            )}
          </div>

          <aside className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
                <p className="truncate text-xs text-ink-muted">{user?.email}</p>
              </div>
            </div>
            <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/profile')}>
              <UserRound className="h-4 w-4" />
              Edit profile
            </Button>
          </aside>
        </section>

        {!loading && (
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2 text-ink-muted">
                <LayoutGrid className="h-4 w-4" />
                <span className="text-xs font-medium">Projects</span>
              </div>
              <p className="mt-1.5 text-2xl font-semibold text-ink">{floorplans.length}</p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2 text-ink-muted">
                <Clock3 className="h-4 w-4" />
                <span className="text-xs font-medium">Recent</span>
              </div>
              <p className="mt-1.5 truncate text-sm font-semibold text-ink">{latestProject?.name || '-'}</p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2 text-ink-muted">
                <Share2 className="h-4 w-4" />
                <span className="text-xs font-medium">Shared</span>
              </div>
              <p className="mt-1.5 text-2xl font-semibold text-ink">{sharedCount}</p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2 text-ink-muted">
                <Home className="h-4 w-4" />
                <span className="text-xs font-medium">Top type</span>
              </div>
              <p className="mt-1.5 truncate text-sm font-semibold text-ink">{byRoomType[0]?.label || '-'}</p>
            </div>
          </div>
        )}

        <section className="mb-7 sm:mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Quick start</h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            {ROOM_TYPES.slice(0, 4).map((roomType) => (
              <button
                key={roomType.value}
                onClick={() => handleConfirmNew(roomType.value)}
                className="flex min-h-14 items-center justify-between rounded-lg border border-line bg-surface p-3 text-left shadow-sm transition-colors hover:bg-secondary sm:p-4"
              >
                <span className="text-sm font-medium text-ink">{roomType.label}</span>
                <Plus className="h-4 w-4 text-ink-muted" />
              </button>
            ))}
          </div>
        </section>

        <h2 className="mb-4 text-sm font-semibold text-ink-muted uppercase tracking-wide">Recent floorplans</h2>

        {loading ? (
          <GridSkeleton count={8} />
        ) : floorplans.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No floorplans yet"
            description="Start your first design and it'll show up here."
            action={
              <Button variant="primary" onClick={() => setNewDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                New floorplan
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {floorplans.slice(0, 8).map((project) => (
              <ProjectCard key={project.id} project={project} onOpen={handleOpen} onDelete={handleDelete} onTogglePublic={handleTogglePublic} onRename={handleRename} />
            ))}
          </div>
        )}
      </main>

      <NewFloorplanDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} onConfirm={handleConfirmNew} />
    </div>
  )
}
