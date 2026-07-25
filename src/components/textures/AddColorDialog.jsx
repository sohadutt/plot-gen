import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Button } from '../ui/Button'
import { createTexture } from '../../api/functions'

const PRESET_COLORS = [
  '#f8fafc', '#e2e8f0', '#94a3b8', '#334155', '#0f172a',
  '#fef3c7', '#fde68a', '#d4a373', '#7c5c3e', '#78350f',
  '#fecaca', '#fca5a5', '#ef4444', '#7f1d1d',
  '#bbf7d0', '#4ade80', '#166534',
  '#bfdbfe', '#60a5fa', '#1e40af',
  '#e9d5ff', '#c084fc', '#6b21a8'
]

export function AddColorDialog({ open, onOpenChange, type, onUploaded }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#e2e8f0')
  const [glossy, setGlossy] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setName('')
    setColor('#e2e8f0')
    setGlossy(0)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const texture = await createTexture({
        name: name.trim() || color,
        type,
        isColor: true,
        color,
        glossy: Number(glossy)
      })
      toast.success('Color added.')
      onUploaded(texture)
      onOpenChange(false)
      reset()
    } catch (error) {
      console.error('Failed to create color:', error)
      toast.error('Could not add color. Please try again.')
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
          <DialogTitle>Add {type} color</DialogTitle>
          <DialogDescription>A flat solid color instead of an image — pick a shade and how glossy it should look.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-14 w-14 shrink-0 cursor-pointer rounded-md border border-line bg-transparent p-1"
              aria-label="Pick a color"
            />
            <div className="flex-1">
              <Label className="mb-1 block">Name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={color} />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Presets</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  title={preset}
                  style={{ backgroundColor: preset }}
                  className={`aspect-square rounded-md border-2 transition-transform hover:scale-110 ${
                    color.toLowerCase() === preset ? 'border-primary' : 'border-line'
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Glossiness</Label>
              <span className="text-xs text-ink-muted">{Math.round(glossy * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={glossy}
              onChange={(e) => setGlossy(e.target.value)}
              className="w-full accent-primary"
            />
            <p className="mt-1 text-xs text-ink-muted">Matte on the left, shiny/reflective on the right.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Adding…' : 'Add color'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
