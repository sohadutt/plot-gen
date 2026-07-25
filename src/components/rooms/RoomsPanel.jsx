import { useEffect, useState, useCallback } from 'react'
import { X, Scan, Paintbrush2, Home } from 'lucide-react'
import { Dimensioning } from '@blueprint3d/core/dimensioning'
import { Configuration, configDimUnit } from '@blueprint3d/core/configuration'
import { cmToDisplay, displayToCm, getDecimalPlaces } from '../../lib/constants'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/Feedback'
import { cn } from '../../lib/utils'

function RoomRow({ room, isHovered, onFocus, onTexture, onCheckpoint }) {
  const [name, setName] = useState(room.getName())
  const [width, setWidth] = useState(0)
  const [depth, setDepth] = useState(0)
  const unit = Configuration.getStringValue(configDimUnit)
  const resizable = room.isSimpleRectangle()

  useEffect(() => {
    const decimals = getDecimalPlaces(unit)
    setWidth(Number(cmToDisplay(room.getWidth(), unit).toFixed(decimals)))
    setDepth(Number(cmToDisplay(room.getDepth(), unit).toFixed(decimals)))
    setName(room.getName())
    // room is a fresh object each time the floorplan recalculates, so re-derive on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room])

  const commitName = () => {
    if (name.trim() !== room.getName()) {
      onCheckpoint()
      room.setName(name.trim())
    }
  }

  const commitResize = (nextWidth, nextDepth) => {
    if (!resizable) return
    const widthCm = displayToCm(nextWidth, unit)
    const depthCm = displayToCm(nextDepth, unit)
    if (widthCm > 30 && depthCm > 30) {
      onCheckpoint()
      room.resize(widthCm, depthCm)
    }
  }

  return (
    <div className={cn('rounded-md border p-3 transition-colors', isHovered ? 'border-primary bg-accent' : 'border-line bg-surface')}>
      <div className="mb-2 flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder="Unnamed room"
          className="h-8 flex-1 text-sm"
        />
        <Button variant="outline" size="icon-sm" title="Focus camera here (F)" onClick={onFocus}>
          <Scan className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon-sm" title="Change floor texture" onClick={onTexture}>
          <Paintbrush2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <span>{Dimensioning.cmSquaredToAreaMeasure(room.getArea())}</span>
        {resizable ? (
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              onBlur={() => commitResize(width, depth)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="h-6 w-16 px-1.5 text-xs font-mono"
            />
            <span>×</span>
            <Input
              type="number"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              onBlur={() => commitResize(width, depth)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="h-6 w-16 px-1.5 text-xs font-mono"
            />
          </div>
        ) : (
          <span>
            {Dimensioning.cmToMeasure(room.getWidth())} × {Dimensioning.cmToMeasure(room.getDepth())}
          </span>
        )}
      </div>
    </div>
  )
}

export function RoomsPanel({ isOpen, onClose, blueprint3d, hoveredRoomUuid }) {
  const [rooms, setRooms] = useState([])

  const refresh = useCallback(() => {
    if (!blueprint3d) return
    setRooms(blueprint3d.model.floorplan.getRooms())
  }, [blueprint3d])

  useEffect(() => {
    if (!isOpen || !blueprint3d) return
    refresh()

    const floorplan = blueprint3d.model.floorplan
    floorplan.fireOnUpdatedRooms(refresh)
    floorplan.roomNamesChangedCallbacks.add(refresh)
  }, [isOpen, blueprint3d, refresh])

  const handleFocus = (room) => {
    blueprint3d?.three.focusOnRoom(room)
  }

  const handleTexture = (room) => {
    // Reuses the existing floor-click flow: same room object, same texture selector.
    blueprint3d?.three.floorClicked.fire(room)
  }

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />}

      <div
        className={cn(
          'fixed bottom-0 right-0 top-0 z-50 w-full border-l border-line bg-surface md:w-[360px]',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 className="text-base font-semibold text-ink">Rooms</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {rooms.length === 0 ? (
              <EmptyState icon={Home} title="No rooms yet" description="Draw an enclosed set of walls to form a room." />
            ) : (
              <div className="space-y-2">
                {rooms.map((room) => (
                  <RoomRow
                    key={room.getUuid()}
                    room={room}
                    isHovered={hoveredRoomUuid === room.getUuid()}
                    onFocus={() => handleFocus(room)}
                    onTexture={() => handleTexture(room)}
                    onCheckpoint={() => blueprint3d?.model.checkpoint()}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-line p-3 text-center text-xs text-ink-muted">
            Tip: hover a room in 3D and press <kbd className="rounded border border-line bg-paper px-1 py-0.5 font-mono">F</kbd> to focus the camera on it.
          </div>
        </div>
      </div>
    </>
  )
}
