import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Switch } from '../ui/Switch'
import { Button } from '../ui/Button'
import { updateItem } from '../../api/functions'

export function EditItemDialog({ open, onOpenChange, item, onUpdated }) {
  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!item) return
    const timeout = setTimeout(() => {
      setName(item.name)
      setIsPublic(!!item.isPublic)
    }, 0)
    return () => clearTimeout(timeout)
  }, [item])

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Give the item a name.')
      return
    }

    setSubmitting(true)
    try {
      const updated = await updateItem(item.id, { name: name.trim(), isPublic })
      toast.success('Item updated.')
      onUpdated(updated)
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to update item:', error)
      toast.error('Could not update the item. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
          <DialogDescription>Update the name or visibility of this catalog item.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1 block">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Walnut Side Table" />
          </div>

          <div className="flex items-center justify-between rounded-md border border-line px-3 py-2.5">
            <div>
              <p className="text-sm text-ink">Public</p>
              <p className="text-xs text-ink-muted">
                {isPublic ? 'Anyone can browse and use this in their own floorplans.' : 'Only visible to you, under "My Uploads".'}
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
