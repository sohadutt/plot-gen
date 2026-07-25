import * as THREE from 'three'
import { Utils } from '../core/utils'
import { EventEmitter } from '../core/events'
import type { Corner } from './corner'
import type { Floorplan, FloorTexture } from './floorplan'
import { HalfEdge } from './half_edge'

/*
TODO
var Vec2 = require('vec2')
var segseg = require('segseg')
var Polygon = require('polygon')
*/

/** Default texture to be used if nothing is provided. */
const defaultRoomTexture = {
  url: 'https://cdn-images.lumenfeng.com/models-cover/hardwood.png',
  scale: 400
}

/**
 * A Room is the combination of a Floorplan with a floor plane.
 */
export class Room {
  /** */
  public interiorCorners: { x: number; y: number }[] = []

  /** */
  private edgePointer: HalfEdge | null = null

  /** floor plane for intersection testing */
  public floorPlane!: THREE.Mesh

  /** */
  // @ts-ignore - customTexture is declared but not used, keeping for future use
  private customTexture = false

  /** */
  private floorChangeCallbacks = new EventEmitter<void>()

  /**
   *  ordered CCW
   */
  constructor(private floorplan: Floorplan, public corners: Corner[]) {
    this.updateWalls()
    this.updateInteriorCorners()
    this.generatePlane()
  }

  public getUuid(): string {
    const cornerUuids = Utils.map(this.corners, function (c) {
      return c.id
    })
    cornerUuids.sort()
    return cornerUuids.join()
  }

  public fireOnFloorChange(callback: () => void): void {
    this.floorChangeCallbacks.add(callback)
  }

  /** Room name (e.g. "Living Room"), stored on the floorplan keyed by this room's stable UUID
   * so it survives the room object itself being rebuilt on every `Floorplan.update()`. */
  public getName(): string {
    return this.floorplan.getRoomName(this.getUuid()) || ''
  }

  public setName(name: string): void {
    this.floorplan.setRoomName(this.getUuid(), name)
    this.floorChangeCallbacks.fire()
  }

  /** Area-weighted centroid of the room's interior polygon (plan x/y — maps to world x/z). */
  public getCenter(): { x: number; y: number } {
    const pts = this.interiorCorners
    if (pts.length === 0) return { x: 0, y: 0 }

    let area = 0
    let cx = 0
    let cy = 0
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i]
      const p1 = pts[(i + 1) % pts.length]
      const cross = p0.x * p1.y - p1.x * p0.y
      area += cross
      cx += (p0.x + p1.x) * cross
      cy += (p0.y + p1.y) * cross
    }
    area *= 0.5

    if (Math.abs(area) < 1e-6) {
      const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
      return { x: sum.x / pts.length, y: sum.y / pts.length }
    }

    return { x: cx / (6 * area), y: cy / (6 * area) }
  }

  /** Axis-aligned bounding box of the room, in plan x/y (cm). */
  public getBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    this.corners.forEach((c) => {
      if (c.x < minX) minX = c.x
      if (c.x > maxX) maxX = c.x
      if (c.y < minY) minY = c.y
      if (c.y > maxY) maxY = c.y
    })
    return { minX, maxX, minY, maxY }
  }

  public getWidth(): number {
    const b = this.getBounds()
    return b.maxX - b.minX
  }

  public getDepth(): number {
    const b = this.getBounds()
    return b.maxY - b.minY
  }

  /** Floor area in cm², via the shoelace formula. */
  public getArea(): number {
    const pts = this.interiorCorners
    let sum = 0
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i]
      const p1 = pts[(i + 1) % pts.length]
      sum += p0.x * p1.y - p1.x * p0.y
    }
    return Math.abs(sum) / 2
  }

  /** Whether this room is a simple 4-corner, axis-aligned rectangle — the only shape
   * `resize()` currently supports. */
  public isSimpleRectangle(): boolean {
    if (this.corners.length !== 4) return false
    const tolerance = 0.5 // cm
    for (let i = 0; i < this.corners.length; i++) {
      const a = this.corners[i]
      const b = this.corners[(i + 1) % this.corners.length]
      const axisAligned = Math.abs(a.x - b.x) < tolerance || Math.abs(a.y - b.y) < tolerance
      if (!axisAligned) return false
    }
    return true
  }

  /** Point-in-polygon test against this room's interior, for scoping items/exports to a room. */
  public containsPoint(x: number, y: number): boolean {
    return Utils.pointInPolygon(x, y, this.interiorCorners)
  }

  /**
   * Resizes a simple rectangular room to an exact width/depth by moving its corners,
   * anchored at the corner closest to the plan origin (min x, min y). Only valid when
   * `isSimpleRectangle()` — throws otherwise. Since corners are shared with adjacent
   * walls/rooms, this naturally moves any wall the room shares with a neighbor too,
   * the same way dragging a corner in Move mode does.
   */
  public resize(width: number, depth: number): void {
    if (!this.isSimpleRectangle()) {
      throw new Error('Room.resize() only supports simple rectangular rooms')
    }

    const bounds = this.getBounds()
    const anchorX = bounds.minX
    const anchorY = bounds.minY

    this.corners.forEach((corner) => {
      const atMaxX = Math.abs(corner.x - bounds.maxX) < Math.abs(corner.x - bounds.minX)
      const atMaxY = Math.abs(corner.y - bounds.maxY) < Math.abs(corner.y - bounds.minY)
      corner.move(atMaxX ? anchorX + width : anchorX, atMaxY ? anchorY + depth : anchorY)
    })
  }

  public getTexture(): FloorTexture {
    const uuid = this.getUuid()
    const tex = this.floorplan.getFloorTexture(uuid)
    return tex || defaultRoomTexture
  }

  /**
   * textureStretch always true, just an argument for consistency with walls
   */
  // @ts-ignore - setTexture is declared but not used, keeping for future use
  public setTexture(
    textureUrl: string,
    textureStretch: boolean,
    textureScale: number,
    extra?: { isColor?: boolean; color?: string; glossy?: number }
  ): void {
    const uuid = this.getUuid()
    this.floorplan.setFloorTexture(uuid, textureUrl, textureScale, extra)
    this.floorChangeCallbacks.fire()
  }

  private generatePlane(): void {
    const points: THREE.Vector2[] = []
    this.interiorCorners.forEach((corner) => {
      points.push(new THREE.Vector2(corner.x, corner.y))
    })
    const shape = new THREE.Shape(points)
    const geometry = new THREE.ShapeGeometry(shape)
    this.floorPlane = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide
      })
    )
    this.floorPlane.visible = false
    this.floorPlane.rotation.set(Math.PI / 2, 0, 0)
    ;(<any>this.floorPlane).room = this // js monkey patch
  }

  // @ts-ignore - cycleIndex is declared but not used, keeping for future use
  private cycleIndex(index: number): number {
    if (index < 0) {
      return (index += this.corners.length)
    } else {
      return index % this.corners.length
    }
  }

  private updateInteriorCorners(): void {
    if (!this.edgePointer) {
      return
    }
    let edge = this.edgePointer
    while (true) {
      this.interiorCorners.push(edge.interiorStart())
      edge.generatePlane()
      if (edge.next === this.edgePointer) {
        break
      } else if (edge.next) {
        edge = edge.next
      } else {
        break
      }
    }
  }

  /**
   * Populates each wall's half edge relating to this room
   * this creates a fancy doubly connected edge list (DCEL)
   */
  private updateWalls(): void {
    let prevEdge: HalfEdge | null = null
    let firstEdge: HalfEdge | null = null

    for (let i = 0; i < this.corners.length; i++) {
      const firstCorner = this.corners[i]
      const secondCorner = this.corners[(i + 1) % this.corners.length]

      // find if wall is heading in that direction
      const wallTo = firstCorner.wallTo(secondCorner)
      const wallFrom = firstCorner.wallFrom(secondCorner)

      let edge: HalfEdge | null = null

      if (wallTo) {
        edge = new HalfEdge(this, wallTo, true)
      } else if (wallFrom) {
        edge = new HalfEdge(this, wallFrom, false)
      } else {
        // something horrible has happened
        console.log('corners arent connected by a wall, uh oh')
        continue
      }

      if (i == 0) {
        firstEdge = edge
      } else {
        edge.prev = prevEdge
        if (prevEdge) {
          prevEdge.next = edge
        }
        if (i + 1 == this.corners.length && firstEdge) {
          firstEdge.prev = edge
          edge.next = firstEdge
        }
      }
      prevEdge = edge
    }

    // hold on to an edge reference
    this.edgePointer = firstEdge
  }
}
