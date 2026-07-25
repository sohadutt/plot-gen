import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { UploadCloud } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Switch } from '../ui/Switch'
import { uploadTextureImage, createTexture } from '../../api/functions'

export function UploadTextureDialog({ open, onOpenChange, type, onUploaded }) {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [name, setName] = useState('')
  const [stretch, setStretch] = useState(true)
  const [scale, setScale] = useState(400)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setFile(null)
    setPreview(null)
    setName('')
    setStretch(true)
    setScale(400)
  }

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    if (!name) setName(selected.name.replace(/\.[^/.]+$/, ''))
  }

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Choose an image file first.')
      return
    }
    setSubmitting(true)
    try {
      const uploaded = await uploadTextureImage(file)
      const texture = await createTexture({
        name: name || file.name,
        type,
        url: uploaded.url,
        thumbnail: uploaded.url,
        stretch,
        scale: Number(scale) || 1
      })
      toast.success('Texture uploaded.')
      onUploaded(texture)
      onOpenChange(false)
      reset()
    } catch (error) {
      console.error('Failed to upload texture:', error)
      toast.error('Upload failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload {type} texture</DialogTitle>
          <DialogDescription>Add a custom image to use as a {type} material.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-32 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-md border-2 border-dashed border-line bg-paper text-ink-muted transition-colors hover:border-primary hover:text-primary"
          >
            {preview ? (
              <img src={preview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <>
                <UploadCloud className="h-6 w-6" />
                <span className="text-xs">Click to choose an image</span>
              </>
            )}
          </button>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Oak Plank" />
          </div>

          <div className="flex items-center justify-between rounded-md border border-line px-3 py-2.5">
            <div>
              <p className="text-sm text-ink">Repeat pattern</p>
              <p className="text-xs text-ink-muted">Tile the image instead of stretching it</p>
            </div>
            <Switch checked={stretch} onCheckedChange={setStretch} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Tile scale (px)</label>
            <Input type="number" value={scale} onChange={(e) => setScale(e.target.value)} min={1} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
