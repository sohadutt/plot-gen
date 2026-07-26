import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router'
import { Box, Grid3x3, ChevronUp, ChevronDown, X, ImageIcon, Sparkles, Info } from 'lucide-react'
import { Blueprint3d } from '../blueprint3d/blueprint3d'
import { floorplannerModes } from '../blueprint3d/floorplanner/floorplanner_view'
import { Dimensioning } from '../blueprint3d/core/dimensioning'
import { fetchPublicFloorplan, fetchPublicRenders } from '../api/functions'
import { EmptyState, Spinner } from '../components/ui/Feedback'
import { cn } from '../lib/utils'

const AUTO_ROTATE_SPEED = 1.0
const VERTICAL_STEP_CM = 20
const HOLD_REPEAT_MS = 80

export default function PublicViewerPage() {
  const { shareToken } = useParams()

  const viewerRef = useRef(null)
  const blueprint3dRef = useRef(null)
  const holdIntervalRef = useRef(null)

  const [status, setStatus] = useState('loading') // loading | ready | not-found
  const [floorplan, setFloorplan] = useState(null)
  const [viewMode, setViewMode] = useState('3d')
  const [renders, setRenders] = useState([])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [preview, setPreview] = useState(null)
  
  // New state for room info
  const [rooms, setRooms] = useState([])
  const [infoOpen, setInfoOpen] = useState(false)

  useEffect(() => {
    if (!viewerRef.current || blueprint3dRef.current) return

    let cancelled = false

    fetchPublicRenders(shareToken)
      .then((data) => !cancelled && setRenders(data))
      .catch(() => {})

    fetchPublicFloorplan(shareToken)
      .then((full) => {
        if (cancelled) return
        setFloorplan(full)

        const blueprint3d = new Blueprint3d({
          floorplannerElement: 'public-floorplanner-canvas',
          threeElement: '#public-viewer-3d',
          textureDir: '/models/textures/',
          widget: false,
          enableWheelZoom: true,
          spin: true // managed manually below, tied to hover, with no permanent lock
        })
        blueprint3dRef.current = blueprint3d
        blueprint3d.three.getController().enabled = false // read-only — no item selection/editing

        blueprint3d.model.loadSerialized(JSON.stringify(full.layoutData))

        // Force a layout update to ensure room polygons are calculated, then extract them
        blueprint3d.model.floorplan.update()
        const extractedRooms = blueprint3d.model.floorplan.getRooms().map((r) => ({
          uuid: r.getUuid(),
          name: r.getName(),
          area: r.getArea()
        }))
        setRooms(extractedRooms)

        blueprint3d.three.controls.autoRotate = true
        blueprint3d.three.controls.autoRotateSpeed = AUTO_ROTATE_SPEED

        setStatus('ready')
      })
      .catch((error) => {
        console.error('Failed to load public floorplan:', error)
        if (!cancelled) setStatus('not-found')
      })

    return () => {
      cancelled = true
      clearInterval(holdIntervalRef.current)
      blueprint3dRef.current?.destroy()
      blueprint3dRef.current = null
    }
  }, [shareToken])

  useEffect(() => {
    const handleResize = () => {
      if (!blueprint3dRef.current) return
      if (viewMode === '3d') blueprint3dRef.current.three.updateWindowSize()
      else blueprint3dRef.current.floorplanner?.resizeView()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [viewMode])

  const handleViewChange = useCallback((mode) => {
    if (!blueprint3dRef.current || mode === viewMode) return
    blueprint3dRef.current.three.setViewMode(mode)
    setViewMode(mode)

    setTimeout(() => {
      if (!blueprint3dRef.current) return
      if (mode === '2d') {
        blueprint3dRef.current.floorplanner?.setMode(floorplannerModes.MOVE)
        blueprint3dRef.current.floorplanner?.reset()
        blueprint3dRef.current.floorplanner?.resetOrigin()
      } else {
        blueprint3dRef.current.model.floorplan.update()
        blueprint3dRef.current.three.updateWindowSize()
      }
    }, 50)
  }, [viewMode])

  const handleMouseEnter = useCallback(() => {
    if (blueprint3dRef.current) blueprint3dRef.current.three.controls.autoRotate = false
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (blueprint3dRef.current) blueprint3dRef.current.three.controls.autoRotate = true
  }, [])

  const moveVertical = useCallback((direction) => {
    blueprint3dRef.current?.three.controls.panVertical(direction * VERTICAL_STEP_CM)
  }, [])

  const startHold = useCallback(
    (direction) => {
      moveVertical(direction)
      clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = setInterval(() => moveVertical(direction), HOLD_REPEAT_MS)
    },
    [moveVertical]
  )

  const stopHold = useCallback(() => clearInterval(holdIntervalRef.current), [])

  if (status === 'not-found') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-paper">
        <EmptyState
          icon={Box}
          title="This floorplan isn't available"
          description="It may have been made private, deleted, or the link is incorrect."
          action={
            <Link to="/" className="text-sm font-medium text-primary hover:underline">
              Go home
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-paper">
      {status === 'loading' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-paper">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      {/* Minimal top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
        
        {/* Title and Room Info Dropdown */}
        <div className="pointer-events-auto flex flex-col gap-2">
          <button
            onClick={() => setInfoOpen(!infoOpen)}
            className="flex items-center gap-2 rounded-lg border border-line bg-surface/90 px-3 py-1.5 text-sm font-medium text-ink shadow-panel backdrop-blur-sm transition-colors hover:bg-paper"
          >
            <span>{floorplan?.name || 'Floorplan'}</span>
            <Info className={cn('h-4 w-4 transition-transform', infoOpen ? 'text-primary' : 'text-ink-muted')} />
          </button>

          {infoOpen && rooms.length > 0 && (
            <div className="flex w-64 flex-col overflow-hidden rounded-lg border border-line bg-surface/95 shadow-panel backdrop-blur-sm">
              <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Rooms ({rooms.length})
              </div>
              <div className="flex max-h-[40vh] flex-col overflow-y-auto p-1">
                {rooms.map((room) => (
                  <div key={room.uuid} className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-paper">
                    <span className="truncate pr-3 font-medium text-ink">
                      {room.name || 'Unnamed Room'}
                    </span>
                    <span className="shrink-0 text-ink-muted">
                      {Dimensioning.cmSquaredToAreaMeasure(room.area)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* View Toggles */}
        <div className="pointer-events-auto flex overflow-hidden rounded-lg border border-line bg-surface/90 shadow-panel backdrop-blur-sm">
          <button
            onClick={() => handleViewChange('3d')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium', viewMode === '3d' ? 'bg-primary text-white' : 'text-ink-muted hover:bg-paper')}
          >
            <Box className="h-3.5 w-3.5" /> 3D
          </button>
          <button
            onClick={() => handleViewChange('2d')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium', viewMode === '2d' ? 'bg-primary text-white' : 'text-ink-muted hover:bg-paper')}
          >
            <Grid3x3 className="h-3.5 w-3.5" /> 2D
          </button>
        </div>
      </div>

      {/* 3D viewport */}
      <div
        id="public-viewer-3d"
        ref={viewerRef}
        className="absolute inset-0"
        style={{ display: viewMode === '3d' ? 'block' : 'none' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />

      {/* 2D viewport */}
      <div className="absolute inset-0 bg-blueprint-grid" style={{ display: viewMode === '2d' ? 'block' : 'none' }}>
        <canvas id="public-floorplanner-canvas" />
      </div>

      {/* Move up/down — only meaningful for the free 3D camera */}
      {viewMode === '3d' && status === 'ready' && (
        <div className="pointer-events-auto absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-line bg-surface/90 shadow-panel backdrop-blur-sm">
          <button
            onPointerDown={() => startHold(1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            title="Move up"
            className="px-3 py-2 text-ink-muted hover:bg-paper hover:text-ink"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onPointerDown={() => startHold(-1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            title="Move down"
            className="px-3 py-2 text-ink-muted hover:bg-paper hover:text-ink"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* AI render gallery */}
      {renders.length > 0 && (
        <div
          className={cn(
            'pointer-events-auto fixed bottom-4 right-4 z-10 overflow-hidden rounded-xl border border-line bg-surface/95 shadow-panel backdrop-blur-sm transition-all duration-300 ease-out',
            galleryOpen ? 'flex w-[30vw] min-w-[320px] max-w-[480px] flex-col' : 'w-fit'
          )}
          style={galleryOpen ? { maxHeight: '60vh' } : undefined}
          onMouseEnter={() => setGalleryOpen(true)}
          onMouseLeave={() => setGalleryOpen(false)}
        >
          <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-ink">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            {!galleryOpen && (
              <div className="flex -space-x-2">
                {renders.slice(0, 4).map((r) => (
                  <div key={r.id} className="h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-surface bg-paper">
                    <img src={r.resultImageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
            <span className="whitespace-nowrap text-xs text-ink-muted">{galleryOpen ? 'AI renders' : `${renders.length} image${renders.length === 1 ? '' : 's'}`}</span>
          </div>

          {galleryOpen && (
            <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto border-t border-line p-3">
              {renders.map((r) => (
                <button key={r.id} onClick={() => setPreview(r)} className="overflow-hidden rounded-md border border-line">
                  <img src={r.resultImageUrl} alt={r.roomLabel || 'AI render'} className="aspect-video w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-6" onClick={() => setPreview(null)}>
          <button className="absolute right-6 top-6 text-white/80 hover:text-white" onClick={() => setPreview(null)}>
            <X className="h-6 w-6" />
          </button>
          {preview.resultImageUrl ? (
            <img
              src={preview.resultImageUrl}
              alt={preview.roomLabel || 'AI render'}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <ImageIcon className="h-10 w-10 text-white/60" />
          )}
        </div>
      )}
    </div>
  )
}