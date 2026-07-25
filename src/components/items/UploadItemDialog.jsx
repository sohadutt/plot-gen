import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Box, ImagePlus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/Select'
import { Switch } from '../ui/Switch'
import { Button } from '../ui/Button'
import { uploadModelFile, uploadImage, createItem } from '../../api/functions'
import { ITEM_CATEGORIES, getItemTypeForCategory, getDefaultBooleanForCategory } from '../../lib/constants'

const SELECTABLE_CATEGORIES = ITEM_CATEGORIES.filter((c) => c.value !== 'all' && c.value !== 'custom')
const WALL_MOUNTED_CATEGORIES = ['door', 'window']

export function UploadItemDialog({ open, onOpenChange, onUploaded }) {
  const modelInputRef = useRef(null)
  const imageInputRef = useRef(null)

  const [modelFile, setModelFile] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('table')
  const [booleanCut, setBooleanCut] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)

  const reset = () => {
    setModelFile(null)
    setImageFile(null)
    setImagePreview(null)
    setName('')
    setCategory('table')
    setBooleanCut(false)
    setProgress(0)
  }

  const handleCategoryChange = (value) => {
    setCategory(value)
    setBooleanCut(getDefaultBooleanForCategory(value))
  }

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleModelChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setModelFile(file)
    if (!name) setName(file.name.replace(/\.[^/.]+$/, ''))
  }

  const handleSubmit = async () => {
    if (!modelFile) {
      toast.error('Choose a .glb model file first.')
      return
    }
    if (!name.trim()) {
      toast.error('Give the item a name.')
      return
    }

    setSubmitting(true)
    try {
      const modelUpload = await uploadModelFile(modelFile, setProgress)
      const imageUpload = imageFile ? await uploadImage(imageFile) : null

      const record = await createItem({
        key: `custom-${Date.now()}`,
        name: name.trim(),
        description: '',
        category,
        type: getItemTypeForCategory(category),
        model: modelUpload.url,
        image: imageUpload?.url || null,
        boolean: booleanCut
      })

      toast.success(`${name.trim()} added to your catalog.`)
      onUploaded(record)
      onOpenChange(false)
      reset()
    } catch (error) {
      console.error('Failed to upload item:', error)
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
          <DialogTitle>Upload furniture model</DialogTitle>
          <DialogDescription>Add a .glb model to your personal catalog. It'll show up under "My Uploads".</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input ref={modelInputRef} type="file" accept=".glb,.gltf" onChange={handleModelChange} className="hidden" />
              <button
                type="button"
                onClick={() => modelInputRef.current?.click()}
                className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-line bg-paper text-ink-muted transition-colors hover:border-primary hover:text-primary"
              >
                <Box className="h-5 w-5" />
                <span className="px-2 text-center text-[11px] leading-tight">
                  {modelFile ? modelFile.name : '.glb model'}
                </span>
              </button>
            </div>

            <div>
              <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex h-24 w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-md border-2 border-dashed border-line bg-paper text-ink-muted transition-colors hover:border-primary hover:text-primary"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[11px]">Cover image (optional)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <Label className="mb-1 block">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Walnut Side Table" />
          </div>

          <div>
            <Label className="mb-1 block">Category</Label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SELECTABLE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {WALL_MOUNTED_CATEGORIES.includes(category) && (
            <div className="flex items-center justify-between rounded-md border border-line px-3 py-2.5">
              <div>
                <p className="text-sm text-ink">Cuts through the wall</p>
                <p className="text-xs text-ink-muted">Opens a hole for it (boolean operation) — turn off for wall-mounted decor.</p>
              </div>
              <Switch checked={booleanCut} onCheckedChange={setBooleanCut} />
            </div>
          )}

          {submitting && progress > 0 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Uploading…' : 'Add to catalog'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
