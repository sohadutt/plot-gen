import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Compass, Plus, FolderOpen, Home, LayoutGrid } from 'lucide-react'
import { fetchFloorplans, deleteFloorplan } from '../api/functions'
import { ROOM_TYPES } from '../lib/constants'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { GridSkeleton, EmptyState } from '../components/ui/Feedback'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { AccountMenu } from '../components/layout/AccountMenu'
import { ProjectCard } from '../components/projects/ProjectCard'
import { NewFloorplanDialog } from '../components/dialogs/NewFloorplanDialog'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [floorplans, setFloorplans] = useState([])
  const [loading, setLoading] = useState(true)
  const [newDialogOpen, setNewDialogOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchFloorplans({ sort: 'newest' })
      setFloorplans(data)
    } catch (error) {
      console.error('Failed to load floorplans:', error)
      toast.error('Could not load your floorplans.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

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

  const handleConfirmNew = (roomType) => {
    navigate('/planner', { state: { newRoomType: roomType } })
  }

  const firstName = user?.name?.split(' ')[0]
  const byRoomType = ROOM_TYPES.map((rt) => ({
    ...rt,
    count: floorplans.filter((f) => f.roomType === rt.value).length
  })).filter((rt) => rt.count > 0)

  return (
    <div className="min-h-screen w-full bg-blueprint-grid">
      <header className="border-b border-line bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Compass className="h-4.5 w-4.5" />
            </div>
            <span className="text-base font-semibold text-ink">Floor Planner</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle variant="ghost" />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{firstName ? `Welcome back, ${firstName}` : 'Welcome back'}</h1>
            <p className="mt-1 text-sm text-ink-muted">Pick up a project, or start something new.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/planner', { state: { initialTab: 'projects' } })}>
              <FolderOpen className="h-4 w-4" />
              Browse all
            </Button>
            <Button variant="primary" onClick={() => setNewDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              New floorplan
            </Button>
          </div>
        </div>

        {!loading && floorplans.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-ink-muted">
                <LayoutGrid className="h-4 w-4" />
                <span className="text-xs font-medium">Total floorplans</span>
              </div>
              <p className="mt-1.5 text-2xl font-semibold text-ink">{floorplans.length}</p>
            </div>
            {byRoomType.slice(0, 3).map((rt) => (
              <div key={rt.value} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex items-center gap-2 text-ink-muted">
                  <Home className="h-4 w-4" />
                  <span className="text-xs font-medium">{rt.label}</span>
                </div>
                <p className="mt-1.5 text-2xl font-semibold text-ink">{rt.count}</p>
              </div>
            ))}
          </div>
        )}

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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {floorplans.slice(0, 8).map((project) => (
              <ProjectCard key={project.id} project={project} onOpen={handleOpen} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      <NewFloorplanDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} onConfirm={handleConfirmNew} />
    </div>
  )
}
