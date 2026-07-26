import { useCallback, useEffect, useState } from 'react'
import { Search, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { fetchFloorplans, fetchFloorplanById, deleteFloorplan, updateFloorplan } from '../../api/functions'
import { ROOM_TYPES } from '../../lib/constants'
import { Input } from '../ui/Input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/Select'
import { GridSkeleton, EmptyState } from '../ui/Feedback'
import { cn } from '../../lib/utils'
import { ProjectCard } from './ProjectCard'

const ROOM_FILTERS = [{ value: 'all', label: 'All' }, ...ROOM_TYPES]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name (A–Z)' }
]

export function ProjectsView({ onOpenFloorplan }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roomType, setRoomType] = useState('all')
  const [sort, setSort] = useState('newest')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchFloorplans({
        roomType: roomType === 'all' ? undefined : roomType,
        search: search || undefined,
        sort
      })
      setProjects(data)
    } catch (error) {
      console.error('Failed to load floorplans:', error)
      toast.error('Could not load your saved floorplans.')
    } finally {
      setLoading(false)
    }
  }, [roomType, search, sort])

  useEffect(() => {
    const timeout = setTimeout(load, search ? 250 : 0)
    return () => clearTimeout(timeout)
  }, [load, search])

  const handleOpen = async (project) => {
    const toastId = toast.loading(`Opening “${project.name}”…`)
    try {
      const full = await fetchFloorplanById(project.id)
      onOpenFloorplan(JSON.stringify(full.layoutData), full.roomType, full.id, full.name)
      toast.success(`Loaded “${project.name}”`, { id: toastId })
    } catch (error) {
      console.error('Failed to open floorplan:', error)
      toast.error('Could not open that floorplan.', { id: toastId })
    }
  }

  const handleDelete = async (id) => {
    const previous = projects
    setProjects((prev) => prev.filter((p) => p.id !== id))
    try {
      await deleteFloorplan(id)
      toast.success('Floorplan deleted.')
    } catch (error) {
      console.error('Failed to delete floorplan:', error)
      toast.error('Could not delete floorplan.')
      setProjects(previous)
    }
  }

  const handleTogglePublic = async (project, isPublic) => {
    const previous = projects
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, isPublic } : p)))
    try {
      const updated = await updateFloorplan(project.id, {
        name: project.name,
        roomType: project.roomType,
        isPublic
      })
      setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, ...updated } : p)))
      toast.success(isPublic ? 'Floorplan is now public.' : 'Floorplan is now private.')
    } catch (error) {
      console.error('Failed to update sharing:', error)
      toast.error('Could not update sharing.')
      setProjects(previous)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-blueprint-grid pt-20">
      <div className="mx-auto w-full max-w-5xl px-5 pb-10">
        <h1 className="mb-4 text-xl font-semibold text-ink">My floorplans</h1>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search floorplans…" className="bg-surface pl-9" />
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {ROOM_FILTERS.map((r) => (
            <button
              key={r.value}
              onClick={() => setRoomType(r.value)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                roomType === r.value ? 'bg-primary text-primary-foreground' : 'bg-surface text-ink-muted border border-line hover:text-ink'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {loading ? (
          <GridSkeleton count={8} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No floorplans yet"
            description="Design something in the Design tab, then hit Save to see it here."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onOpen={handleOpen} onDelete={handleDelete} onTogglePublic={handleTogglePublic} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
