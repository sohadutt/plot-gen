import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog'
import { OptionList } from '../ui/OptionList'
import { Button } from '../ui/Button'
import { ROOM_TYPES, DEFAULT_ROOM_TYPE } from '../../lib/constants'

export function NewFloorplanDialog({ open, onOpenChange, onConfirm }) {
  const [roomType, setRoomType] = useState(DEFAULT_ROOM_TYPE)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New floorplan</DialogTitle>
          <DialogDescription>Starting a new floorplan clears the current canvas. Unsaved changes will be lost.</DialogDescription>
        </DialogHeader>

        <div>
          <label className="mb-2 block text-xs font-medium text-ink-muted">Room type</label>
          <OptionList options={ROOM_TYPES} value={roomType} onChange={setRoomType} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onConfirm(roomType)
              onOpenChange(false)
            }}
          >
            Start blank
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
