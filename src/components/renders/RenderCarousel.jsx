import { useState, useEffect, useCallback, useRef } from 'react'
import { Sparkles, RefreshCw, Trash2, X, ImageOff, Upload, ImageUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/Button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/Select'
import { Spinner } from '../ui/Feedback'
import { cn } from '../../lib/utils'
import { fetchRenders, createRender, regenerateRender, deleteRender, uploadImage } from '../../api/functions'

const ANGLE_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'front', label: 'Front view' },
  { value: 'top_down', label: 'Top-down' },
  { value: 'corner', label: 'Corner view' },
  { value: 'custom', label: 'Custom' }
]

const POLL_INTERVAL_MS = 4000
const IN_FLIGHT_STATUSES = new Set(['pending', 'processing'])
const COLLAPSED_THUMBNAIL_COUNT = 4

/** Renders one frame at the camera's current position/rotation (no
 * repositioning, unlike captureTopDownSnapshot) — captures whatever angle
 * the user has already navigated the 3D view to. */
function captureCurrentViewSnapshot(blueprint3d, { targetWidth = 1200, targetHeight = 900, format = 'image/webp', quality = 0.85 } = {}) {
  if (!blueprint3d) return ''
  const { camera, renderer, scene } = blueprint3d.three
  const canvas = renderer.domElement
  const savedWidth = canvas.width
  const savedHeight = canvas.height
  const savedAspect = camera.aspect

  try {
    renderer.setSize(targetWidth, targetHeight, false)
    camera.aspect = targetWidth / targetHeight
    camera.updateProjectionMatrix()
    renderer.clear()
    renderer.render(scene.getScene(), camera)
    return canvas.toDataURL(format, quality)
  } finally {
    renderer.setSize(savedWidth, savedHeight, false)
    camera.aspect = savedAspect
    camera.updateProjectionMatrix()
    renderer.clear()
    renderer.render(scene.getScene(), camera)
  }
}

/** Plan-space bounding box of a single room, in the {x, z} shape
 * captureTopDownSnapshot expects for its `center`/`size` options. */
function getRoomBounds(room) {
  let xMin = Infinity, xMax = -Infinity, zMin = Infinity, zMax = -Infinity
  room.corners.forEach((corner) => {
    if (corner.x < xMin) xMin = corner.x
    if (corner.x > xMax) xMax = corner.x
    if (corner.y < zMin) zMin = corner.y
    if (corner.y > zMax) zMax = corner.y
  })
  return {
    center: { x: (xMin + xMax) / 2, z: (zMin + zMax) / 2 },
    size: { x: Math.max(xMax - xMin, 50), z: Math.max(zMax - zMin, 50) }
  }
}

async function dataUrlToUploadedUrl(dataUrl) {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const file = new File([blob], 'render-source.webp', { type: blob.type || 'image/webp' })
  const { url } = await uploadImage(file)
  return url
}

export function RenderCarousel({ blueprint3dRef, project, captureTopDownSnapshot }) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [renders, setRenders] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [rooms, setRooms] = useState([])
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [angle, setAngle] = useState('default')
  const [prompt, setPrompt] = useState('')
  const [preview, setPreview] = useState(null)
  const [sourceFile, setSourceFile] = useState(null)
  const [replacingId, setReplacingId] = useState(null)
  const pollRef = useRef(null)
  const sourceFileInputRef = useRef(null)

  const projectId = project?.id
  const expanded = hovered || pinned

  const loadRenders = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await fetchRenders({ projectId })
      setRenders(data)
    } catch (error) {
      console.error('Failed to load renders:', error)
    }
  }, [projectId])

  // Loads as soon as there's a project — the collapsed strip shows recent
  // thumbnails without needing the panel opened first.
  useEffect(() => {
    if (!projectId) return
    const timeout = setTimeout(() => {
      setLoading(true)
      loadRenders().finally(() => setLoading(false))
    }, 0)
    return () => clearTimeout(timeout)
  }, [projectId, loadRenders])

  // Keeps polling regardless of expanded state, so the collapsed thumbnail
  // updates in place once a pending/processing render finishes.
  useEffect(() => {
    clearTimeout(pollRef.current)
    const hasInFlight = renders.some((r) => IN_FLIGHT_STATUSES.has(r.status))
    if (!hasInFlight) return
    pollRef.current = setTimeout(loadRenders, POLL_INTERVAL_MS)
    return () => clearTimeout(pollRef.current)
  }, [renders, loadRenders])

  useEffect(() => {
    if (!expanded) return
    const floorplan = blueprint3dRef.current?.model?.floorplan
    if (!floorplan) return
    const roomList = floorplan.getRooms().map((room) => ({
      uuid: room.getUuid(),
      name: floorplan.getRoomName(room.getUuid()) || 'Unnamed room',
      room
    }))
    setRooms(roomList)
  }, [expanded, blueprint3dRef])

  const handleGenerate = async () => {
    const blueprint3d = blueprint3dRef.current
    if (!blueprint3d || !projectId) return

    setGenerating(true)
    const toastId = toast.loading('Requesting AI render…')
    try {
      const selectedRoom = rooms.find((r) => r.uuid === selectedRoomId)

      let sourceImageUrl
      if (sourceFile) {
        const uploaded = await uploadImage(sourceFile)
        sourceImageUrl = uploaded.url
      } else {
        const dataUrl =
          angle === 'top_down'
            ? captureTopDownSnapshot(blueprint3d, selectedRoom ? getRoomBounds(selectedRoom.room) : {})
            : captureCurrentViewSnapshot(blueprint3d)
        if (!dataUrl) throw new Error('Could not capture the current view.')
        sourceImageUrl = await dataUrlToUploadedUrl(dataUrl)
      }

      const sceneData = JSON.parse(blueprint3d.model.exportSerialized())

      const render = await createRender({
        projectId,
        roomId: selectedRoom?.uuid,
        roomLabel: selectedRoom?.name,
        angle,
        sourceImageUrl,
        sceneData,
        prompt: prompt.trim()
      })

      setRenders((prev) => [render, ...prev])
      setSourceFile(null)
      toast.success('Render requested — it will appear here shortly.', { id: toastId })
    } catch (error) {
      console.error('Failed to request render:', error)
      toast.error('Could not request the render. Please try again.', { id: toastId })
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = async (render) => {
    try {
      const updated = await regenerateRender(render.id)
      setRenders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      toast.success('Regenerating…')
    } catch {
      toast.error('Could not regenerate. Please try again.')
    }
  }

  /** Swaps in a newly-uploaded photo as this render's source image and
   * kicks off regeneration from it — replaces the image in place rather
   * than creating a new carousel entry. */
  const handleReplaceImage = async (render, file) => {
    if (!file) return
    setReplacingId(render.id)
    const toastId = toast.loading('Uploading photo…')
    try {
      const uploaded = await uploadImage(file)
      const updated = await regenerateRender(render.id, { sourceImageUrl: uploaded.url })
      setRenders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      toast.success('Image replaced — regenerating…', { id: toastId })
    } catch (error) {
      console.error('Failed to replace image:', error)
      toast.error('Could not replace the image. Please try again.', { id: toastId })
    } finally {
      setReplacingId(null)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteRender(id)
      setRenders((prev) => prev.filter((r) => r.id !== id))
    } catch {
      toast.error('Could not delete that render.')
    }
  }

  if (!projectId) return null

  return (
    <>
      <div
        className={cn(
          'pointer-events-auto fixed bottom-20 right-4 z-30 overflow-hidden rounded-xl border border-line bg-surface/95 shadow-panel backdrop-blur-sm transition-all duration-300 ease-out',
          expanded ? 'flex w-[30vw] min-w-[360px] max-w-[560px] flex-col' : 'w-fit'
        )}
        style={expanded ? { maxHeight: '70vh' } : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Collapsed strip — always visible, click to pin open on touch devices */}
        <button
          onClick={() => setPinned((p) => !p)}
          className="flex w-full shrink-0 items-center gap-2 px-3 py-2 text-left text-sm font-medium text-ink hover:bg-paper"
        >
          <Sparkles className="h-6 w-4 shrink-0 text-primary" />
          {!expanded && renders.length > 0 && (
            <div className="flex -space-x-2">
              {renders.slice(0, COLLAPSED_THUMBNAIL_COUNT).map((r) => (
                <div
                  key={r.id}
                  className="h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-surface bg-paper"
                  title={r.roomLabel || 'AI render'}
                >
                  {r.status === 'completed' && r.resultImageUrl ? (
                    <img src={r.resultImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Spinner className="h-3 w-3" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <span className={cn('whitespace-nowrap', expanded ? '' : 'text-xs text-ink-muted')}>
            {expanded ? 'AI room renders' : renders.length > 0 ? `${renders.length} render${renders.length === 1 ? '' : 's'}` : 'AI renders'}
          </span>
        </button>

        {expanded && (
          <div className="flex-1 overflow-y-auto border-t border-line px-3 py-3">
            <div className="mb-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-ink-muted">Room</label>
                  <Select value={selectedRoomId || 'whole'} onValueChange={(v) => setSelectedRoomId(v === 'whole' ? '' : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whole">Whole floorplan</SelectItem>
                      {rooms.map((r) => (
                        <SelectItem key={r.uuid} value={r.uuid}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-ink-muted">Angle</label>
                  <Select value={angle} onValueChange={setAngle}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANGLE_OPTIONS.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">Prompt (optional)</label>
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. warm evening lighting, scandinavian style…"
                  className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <input
                  ref={sourceFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setSourceFile(e.target.files?.[0] || null)}
                />
                {sourceFile ? (
                  <div className="flex items-center gap-2 rounded-md border border-line bg-paper px-2 py-1.5 text-xs text-ink">
                    <ImageUp className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{sourceFile.name}</span>
                    <button onClick={() => setSourceFile(null)} className="shrink-0 text-ink-muted hover:text-ink">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => sourceFileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-line px-2 py-1.5 text-xs text-ink-muted hover:border-primary hover:text-primary"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload a photo instead
                  </button>
                )}
              </div>

              <Button variant="primary" onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? 'Generating…' : 'Generate'}
              </Button>
            </div>

            {!sourceFile && angle !== 'top_down' && (
              <p className="mb-3 text-xs text-ink-muted">
                Tip: orbit the 3D view to the angle you want before generating — that's exactly what gets captured.
              </p>
            )}

            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : renders.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-muted">No renders yet for this floorplan.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {renders.map((render) => (
                  <RenderCard
                    key={render.id}
                    render={render}
                    replacing={replacingId === render.id}
                    onRegenerate={() => handleRegenerate(render)}
                    onReplaceImage={(file) => handleReplaceImage(render, file)}
                    onDelete={() => handleDelete(render.id)}
                    onPreview={() => render.resultImageUrl && setPreview(render)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPreview(null)}
        >
          <button className="absolute right-6 top-6 text-white/80 hover:text-white" onClick={() => setPreview(null)}>
            <X className="h-6 w-6" />
          </button>
          <img
            src={preview.resultImageUrl}
            alt={preview.roomLabel || 'AI render'}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

function RenderCard({ render, replacing, onRegenerate, onReplaceImage, onDelete, onPreview }) {
  const label = render.roomLabel || (render.roomId ? 'Room' : 'Whole floorplan')
  const replaceInputRef = useRef(null)

  return (
    <div className="overflow-hidden rounded-md border border-line bg-paper">
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          onReplaceImage?.(file)
          e.target.value = '' // allow picking the same file again later
        }}
      />
      <button onClick={onPreview} className="block aspect-video w-full bg-paper" disabled={render.status !== 'completed'}>
        {replacing ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-muted">
            <Spinner className="h-4 w-4" />
            <span className="text-[10px]">Replacing…</span>
          </div>
        ) : render.status === 'completed' && render.resultImageUrl ? (
          <img src={render.resultImageUrl} alt={label} className="h-full w-full object-cover" />
        ) : render.status === 'failed' ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-muted">
            <ImageOff className="h-5 w-5" />
            <span className="text-[10px]">Failed</span>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-muted">
            <Spinner className="h-4 w-4" />
            <span className="text-[10px] capitalize">{render.status}</span>
          </div>
        )}
      </button>
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-ink" title={label}>{label}</p>
          <p className="truncate text-[10px] capitalize text-ink-muted">{render.angle.replace('_', ' ')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={() => replaceInputRef.current?.click()}
            title="Replace image (upload a new photo)"
            disabled={replacing}
            className="rounded p-1 text-ink-muted hover:bg-line hover:text-ink"
          >
            <ImageUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRegenerate}
            title="Regenerate (replaces this image)"
            disabled={replacing}
            className={cn('rounded p-1 text-ink-muted hover:bg-line hover:text-ink', render.status === 'processing' && 'animate-spin')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} title="Delete" className="rounded p-1 text-ink-muted hover:bg-line hover:text-red-500">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {render.status === 'failed' && render.errorMessage && (
        <p className="px-2 pb-1.5 text-[10px] text-red-500" title={render.errorMessage}>
          {render.errorMessage.length > 60 ? render.errorMessage.slice(0, 60) + '…' : render.errorMessage}
        </p>
      )}
    </div>
  )
}
