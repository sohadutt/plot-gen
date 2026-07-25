import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Download, Copy, ImageOff } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/Dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/Select'
import { Button } from '../ui/Button'
import { Separator } from '../ui/Separator'
import { captureTopDownSnapshot } from '../../lib/topDownSnapshot'
import { buildRoomExportData, buildFlatExportData } from '../../lib/exportRoomData'
import { cn } from '../../lib/utils'

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'export'
  )
}

export function ExportDialog({ open, onOpenChange, blueprint3d, floorplanName }) {
  const [scope, setScope] = useState('flat') // 'flat' | a room uuid
  const [rooms, setRooms] = useState([])
  const [image, setImage] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!open || !blueprint3d) return
    setRooms(blueprint3d.model.floorplan.getRooms())
    setScope('flat')
  }, [open, blueprint3d])

  const selectedRoom = useMemo(() => rooms.find((r) => r.getUuid() === scope) || null, [rooms, scope])

  useEffect(() => {
    if (!open || !blueprint3d) return

    if (scope === 'flat') {
      setImage(captureTopDownSnapshot(blueprint3d))
      setData(buildFlatExportData(blueprint3d, floorplanName))
    } else if (selectedRoom) {
      const center = selectedRoom.getCenter()
      setImage(
        captureTopDownSnapshot(blueprint3d, {
          center: { x: center.x, z: center.y },
          size: { x: selectedRoom.getWidth(), z: selectedRoom.getDepth() },
          margin: 1.6
        })
      )
      setData(buildRoomExportData(blueprint3d, selectedRoom))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, blueprint3d, scope, selectedRoom])

  if (!blueprint3d) return null

  const baseName = slugify(data?.name || floorplanName || 'floorplan')
  const jsonText = data ? JSON.stringify(data, null, 2) : ''

  const downloadImage = () => {
    if (!image) return
    const a = document.createElement('a')
    a.href = image
    a.download = `${baseName}.webp`
    a.click()
  }

  const downloadJson = () => {
    if (!jsonText) return
    const blob = new Blob([jsonText], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonText)
      toast.success('JSON copied to clipboard.')
    } catch {
      toast.error('Could not copy — your browser may be blocking clipboard access.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export reference image</DialogTitle>
          <DialogDescription>
            A top-down snapshot plus structured JSON — useful as a reference for image-generation APIs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Scope</label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Whole flat</SelectItem>
                {rooms.map((room) => (
                  <SelectItem key={room.getUuid()} value={room.getUuid()}>
                    {room.getName() || 'Unnamed room'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={cn('flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md border border-line bg-paper')}>
            {image ? (
              <img src={image} alt="Top-down preview" className="h-full w-full object-cover" />
            ) : (
              <ImageOff className="h-8 w-8 text-line-strong" />
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={downloadImage} disabled={!image}>
              <Download className="h-4 w-4" />
              Download image
            </Button>
            <Button variant="outline" className="flex-1" onClick={downloadJson} disabled={!jsonText}>
              <Download className="h-4 w-4" />
              Download JSON
            </Button>
          </div>

          <Separator />

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-ink-muted">JSON preview</label>
              <button
                onClick={copyJson}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
                disabled={!jsonText}
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
            <pre className="max-h-48 overflow-auto rounded-md border border-line bg-paper p-3 text-[11px] leading-relaxed text-ink-muted">
              {jsonText}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
