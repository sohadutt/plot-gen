import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog'
import { OptionList } from '../ui/OptionList'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { ROOM_TYPES } from '../../lib/constants'

export function SaveFloorplanDialog({ open, onOpenChange, onSave, defaultName, defaultRoomType, saving }) {
  const [name, setName] = useState(defaultName)
  const [roomType, setRoomType] = useState(defaultRoomType)

  useEffect(() => {
    if (open) {
      setName(defaultName)
      setRoomType(defaultRoomType)
    }
  }, [open, defaultName, defaultRoomType])

  const handleSave = () => {
    if (!name.trim()) return
    onSave(name.trim(), roomType)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Save floorplan</DialogTitle>
          <DialogDescription>Give this project a name so you can find it later.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My floorplan" autoFocus />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-ink-muted">Room type</label>
            <OptionList options={ROOM_TYPES} value={roomType} onChange={setRoomType} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
