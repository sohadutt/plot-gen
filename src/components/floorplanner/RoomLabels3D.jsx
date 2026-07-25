import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { Dimensioning } from '@blueprint3d/core/dimensioning'
import { cn } from '../../lib/utils'

export function RoomLabels3D({ blueprint3d, active }) {
  const [labels, setLabels] = useState([])

  useEffect(() => {
    if (!active || !blueprint3d) {
      setLabels([])
      return
    }

    const three = blueprint3d.three
    const floorplan = blueprint3d.model.floorplan

    const recompute = () => {
      const next = floorplan.getRooms().map((room) => {
        const center = room.getCenter()
        const screen = three.projectVector(new THREE.Vector3(center.x, 4, center.y))
        return {
          uuid: room.getUuid(),
          room,
          name: room.getName(),
          area: Dimensioning.cmSquaredToAreaMeasure(room.getArea()),
          x: screen.x,
          y: screen.y,
          tooSmall: room.getWidth() < 80 || room.getDepth() < 80
        }
      })
      setLabels(next)
    }

    recompute()
    three.controls.cameraMovedCallbacks.add(recompute)
    floorplan.fireOnUpdatedRooms(recompute)
    floorplan.roomNamesChangedCallbacks.add(recompute)

    return () => {
      three.controls.cameraMovedCallbacks.remove(recompute)
      floorplan.removeOnUpdatedRooms(recompute)
      floorplan.roomNamesChangedCallbacks.remove(recompute)
    }
  }, [active, blueprint3d])

  if (!active) return null

  return (
    <>
      {labels
        .filter((l) => !l.tooSmall)
        .map((l) => (
          <button
            key={l.uuid}
            onClick={() => blueprint3d.three.focusOnRoom(l.room)}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 select-none rounded-md px-2 py-1 text-center transition-transform hover:scale-105"
            style={{ left: l.x, top: l.y }}
          >
            <div className={cn('text-sm font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]', l.name ? 'text-white' : 'text-white/70 italic')}>
              {l.name || 'Unnamed room'}
            </div>
            <div className="text-[11px] text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">{l.area}</div>
          </button>
        ))}
    </>
  )
}
