import { Floorplan } from '../model/floorplan'
import { Wall } from '../model/wall'
import { Corner } from '../model/corner'
import { Utils } from '../core/utils'
import { Configuration, configDimUnit } from '../core/configuration'
import { Dimensioning, dimInch } from '../core/dimensioning'
import { EventEmitter } from '../core/events'
import { FloorplannerView, floorplannerModes } from './floorplanner_view'
import type { Model } from '../model/model'

type FloorplannerMode = (typeof floorplannerModes)[keyof typeof floorplannerModes]
type SimplePoint = { x: number; y: number }

/** how much will we move a corner to make a wall axis aligned (cm) — kept as a legacy fallback */
const snapTolerance = 25

/** on-screen radius (px) within which the cursor snaps to an existing corner */
const cornerSnapPixels = 18

/** on-screen radius (px) within which the cursor snaps onto an existing wall (edge or crossing) */
const wallSnapPixels = 14

/** angle increment (degrees) that drawing/measuring sticks to when no geometry snap applies */
const angleSnapIncrement = 15

/** how close (degrees) the cursor's raw angle needs to be to a sticky increment to snap to it */
const angleSnapTolerance = 5

/** minimum length (cm) either side of a cut must keep, so we never create a degenerate wall */
const minCutSegment = 10

/** default scale — cm represented by one screen pixel at 100% zoom */
const defaultCmPerPixel = 30.48 / 15.0

/** how far you can zoom in/out, as a multiple of the default scale */
const minCmPerPixel = defaultCmPerPixel / 6 // most zoomed in
const maxCmPerPixel = defaultCmPerPixel * 24 // most zoomed out

/** how much each wheel "click" changes the zoom level */
const zoomSensitivity = 0.0018

/** Small finger drift still counts as a tap for draw/cut/measure gestures. */
const touchTapSlopPixels = 8

/** Info describing the wall segment currently being drawn, for the on-screen length readout. */
export interface DrawingLengthInfo {
  /** Length of the in-progress segment, in cm. */
  lengthCm: number
  /** Same length, formatted the same way wall labels are (respects the current dimension unit). */
  formatted: string
  /** Current angle of the segment, in degrees (0 = east, 90 = south, matching screen/plan coords). */
  angleDegrees: number
  /** Whether the angle is currently locked to a sticky increment (vs a free-form angle). */
  angleSnapped: boolean
  /** Viewport-relative position to anchor a floating tooltip near the cursor. */
  screenX: number
  screenY: number
  /** Raw digits the user has typed so far to key in an exact length (empty if not typing). */
  typedValue: string
  /** Whether the user is actively typing a length override. */
  isTyping: boolean
}

/** Info describing a pending wall cut, for the on-screen split-length readout. */
export interface CutLengthInfo {
  /** Length of the segment between the wall's start corner and the cut point, in cm. */
  lengthA: number
  /** Length of the segment between the cut point and the wall's end corner, in cm. */
  lengthB: number
  formattedA: string
  formattedB: string
  screenX: number
  screenY: number
  typedValue: string
  isTyping: boolean
  /** Which side ("A"/start or "B"/end) a typed value is currently measured from. */
  nearSide: 'start' | 'end'
}

/** Info describing an in-progress, non-destructive measurement. */
export interface MeasureLengthInfo {
  lengthCm: number
  formatted: string
  angleDegrees: number
  angleSnapped: boolean
  screenX: number
  screenY: number
}

/**
 * The Floorplanner implements an interactive tool for creation of floorplans.
 */
export class Floorplanner {
  /** */
  public mode: FloorplannerMode = floorplannerModes.MOVE

  /** */
  public activeWall: Wall | null = null

  /** */
  public activeCorner: Corner | null = null

  /** */
  public originX = 0

  /** */
  public originY = 0

  /** drawing state */
  public targetX = 0

  /** drawing state */
  public targetY = 0

  /** drawing state */
  public lastNode: Corner | null = null

  /** The pending cut point on `activeWall` while in CUT mode, or null. */
  public cutPoint: SimplePoint | null = null

  /** The first point of an in-progress, non-destructive measurement, or null. */
  public measureLastNode: SimplePoint | null = null

  /** Whether the current draw/measure target is locked to a sticky angle increment. */
  public angleSnapped = false

  /** Fires with live length/position info while drawing a wall segment, or null when not drawing. */
  public drawingLengthCallbacks = new EventEmitter<DrawingLengthInfo | null>()

  /** Fires with live split-length info while hovering/typing a cut point, or null. */
  public cutLengthCallbacks = new EventEmitter<CutLengthInfo | null>()

  /** Fires when the user tries to cut a wall that has a door/window on it. */
  public cutBlockedCallbacks = new EventEmitter<Wall>()

  /** Fires with live distance info while measuring, or null when not measuring. */
  public measureLengthCallbacks = new EventEmitter<MeasureLengthInfo | null>()

  /** Fires with the new zoom percentage whenever the zoom level changes. */
  public zoomChangedCallbacks = new EventEmitter<number>()

  /** Digits the user has typed so far to key in an exact length (wall draw or cut). */
  private typedLength = ''

  /** Whether the user is currently typing an exact length (as opposed to just moving the mouse). */
  private isTypingLength = false

  /** Which end of the active wall a typed cut length is measured from. */
  private cutNearSide: 'start' | 'end' = 'start'

  /** */
  // @ts-ignore - wallWidth is declared but not used, keeping for future use
  private wallWidth: number

  /** */
  private modeResetCallbacks: Array<(mode: FloorplannerMode) => void> = []

  /** */
  private canvasElement: HTMLCanvasElement

  /** */
  private view: FloorplannerView

  /** */
  private mouseDown = false

  /** */
  private mouseMoved = false

  /** in ThreeJS coords */
  private mouseX = 0

  /** in ThreeJS coords */
  private mouseY = 0

  /** in ThreeJS coords */
  private rawMouseX = 0

  /** in ThreeJS coords */
  private rawMouseY = 0

  /** mouse position at last click */
  private lastX = 0

  /** mouse position at last click */
  private lastY = 0

  private touchMode: 'single' | 'pinch' | null = null
  private touchStartX = 0
  private touchStartY = 0
  private touchStartDistance = 0
  private touchStartCmPerPixel = defaultCmPerPixel
  private touchPinchWorldX = 0
  private touchPinchWorldY = 0

  /** */
  private cmPerPixel: number

  /** */
  private pixelsPerCm: number

  /** the Floorplan this instance edits — derived from the Model passed to the constructor */
  private floorplan: Floorplan

  /** Stored so destroy() can remove exactly these listeners later. */
  private keyupHandler!: (e: KeyboardEvent) => void
  private keydownHandler!: (e: KeyboardEvent) => void

  /** Add a callback for mode reset */
  public addModeResetCallback(callback: (mode: FloorplannerMode) => void): void {
    this.modeResetCallbacks.push(callback)
  }

  /** Provides jQuery-style Callbacks API for backward compatibility */
  public get modeResetCallbacksAPI(): {
    add: (callback: (mode: FloorplannerMode) => void) => void
  } {
    return {
      add: (callback: (mode: FloorplannerMode) => void) => this.addModeResetCallback(callback)
    }
  }

  /** Lets FloorplannerView reach the placed items (Model.scene) to draw
   * their 2D top-down icons — items live on the Model, not the Floorplan. */
  public getModel(): Model {
    return this.model
  }

  /** */
  constructor(
    canvas: string,
    private model: Model
  ) {
    this.floorplan = model.floorplan
    this.canvasElement = document.getElementById(canvas) as HTMLCanvasElement

    this.view = new FloorplannerView(this.floorplan, this, canvas)

    this.cmPerPixel = defaultCmPerPixel
    this.pixelsPerCm = 1.0 / this.cmPerPixel

    this.wallWidth = 10.0 * this.pixelsPerCm

    // Initialization:

    this.setMode(floorplannerModes.MOVE)

    this.canvasElement.addEventListener('mousedown', () => {
      this.mousedown()
    })
    this.canvasElement.addEventListener('mousemove', (event: MouseEvent) => {
      this.mousemove(event)
    })
    this.canvasElement.addEventListener('mouseup', () => {
      this.mouseup()
    })
    this.canvasElement.addEventListener('mouseleave', () => {
      this.mouseleave()
    })
    this.canvasElement.addEventListener(
      'wheel',
      (event: WheelEvent) => {
        this.mousewheel(event)
      },
      { passive: false }
    )
    this.canvasElement.addEventListener(
      'touchstart',
      (event: TouchEvent) => {
        this.touchstart(event)
      },
      { passive: false }
    )
    this.canvasElement.addEventListener(
      'touchmove',
      (event: TouchEvent) => {
        this.touchmove(event)
      },
      { passive: false }
    )
    this.canvasElement.addEventListener(
      'touchend',
      (event: TouchEvent) => {
        this.touchend(event)
      },
      { passive: false }
    )
    this.canvasElement.addEventListener(
      'touchcancel',
      (event: TouchEvent) => {
        this.touchend(event)
      },
      { passive: false }
    )

    // Stored on `this` (rather than inline) so destroy() can remove exactly these —
    // these are document-level listeners, so unlike the canvas-element ones above they
    // outlive this instance's DOM (and keep firing against a gone canvas) if not removed.
    this.keyupHandler = (e: KeyboardEvent) => {
      if (e.keyCode == 27) {
        this.escapeKey()
      }
    }
    this.keydownHandler = (e: KeyboardEvent) => {
      this.handleLengthTypingKey(e)
    }
    document.addEventListener('keyup', this.keyupHandler)
    document.addEventListener('keydown', this.keydownHandler)

    this.floorplan.roomLoadedCallbacks.add(() => {
      this.reset()
    })
  }

  /** Removes the document-level listeners this instance registered — call when the
   * owning React component unmounts, or a stale instance keeps reacting to keystrokes
   * and resize events (and logging "canvas not found") long after its canvas is gone. */
  public destroy(): void {
    document.removeEventListener('keyup', this.keyupHandler)
    document.removeEventListener('keydown', this.keydownHandler)
    this.view.destroy()
  }

  /** */
  private escapeKey(): void {
    this.setMode(floorplannerModes.MOVE)
  }

  /** Finds the nearest existing corner to a point, if any is within snapping range. */
  private snapToNearbyCorner(x: number, y: number, exclude: Corner | null): SimplePoint | null {
    const tolerance = cornerSnapPixels * this.cmPerPixel
    let best: SimplePoint | null = null
    let bestDist = Infinity
    for (const corner of this.floorplan.getCorners()) {
      if (corner === exclude) continue
      const d = Utils.distance(x, y, corner.x, corner.y)
      if (d < tolerance && d < bestDist) {
        best = { x: corner.x, y: corner.y }
        bestDist = d
      }
    }
    return best
  }

  /** Finds the nearest point lying on an existing wall's edge, if any is within snapping range.
   * Walls attached to `excludeCorner` are ignored (so a wall doesn't snap to itself while its
   * own endpoint is being dragged or extended). */
  private snapToNearbyWallEdge(x: number, y: number, excludeCorner: Corner | null): SimplePoint | null {
    const tolerance = wallSnapPixels * this.cmPerPixel
    let best: SimplePoint | null = null
    let bestDist = Infinity
    for (const wall of this.floorplan.getWalls()) {
      if (excludeCorner && (wall.getStart() === excludeCorner || wall.getEnd() === excludeCorner)) continue
      const closest = Utils.closestPointOnLine(
        x,
        y,
        wall.getStartX(),
        wall.getStartY(),
        wall.getEndX(),
        wall.getEndY()
      )
      const d = Utils.distance(x, y, closest.x, closest.y)
      if (d < tolerance && d < bestDist) {
        best = closest
        bestDist = d
      }
    }
    return best
  }

  /** Finds where the segment (fromX,fromY)-(toX,toY) crosses another wall, if within snapping range. */
  private snapToWallIntersection(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    excludeCorner: Corner | null
  ): SimplePoint | null {
    const tolerance = wallSnapPixels * this.cmPerPixel * 1.5
    let best: SimplePoint | null = null
    let bestDist = Infinity
    for (const wall of this.floorplan.getWalls()) {
      if (excludeCorner && (wall.getStart() === excludeCorner || wall.getEnd() === excludeCorner)) continue
      const intersection = Utils.lineSegmentIntersection(
        fromX,
        fromY,
        toX,
        toY,
        wall.getStartX(),
        wall.getStartY(),
        wall.getEndX(),
        wall.getEndY()
      )
      if (intersection) {
        const d = Utils.distance(toX, toY, intersection.x, intersection.y)
        if (d < tolerance && d < bestDist) {
          best = intersection
          bestDist = d
        }
      }
    }
    return best
  }

  /** Snaps a direction to the nearest "sticky" angle increment (e.g. every 15°) if the
   * raw cursor angle is close enough, otherwise returns the point unchanged. Sets
   * `this.angleSnapped` so callers/the view know whether the lock is active. */
  private computeAngleSnap(from: SimplePoint, mouseX: number, mouseY: number): SimplePoint {
    const dx = mouseX - from.x
    const dy = mouseY - from.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < 0.0001) {
      this.angleSnapped = false
      return { x: mouseX, y: mouseY }
    }

    const rawDegrees = (Math.atan2(dy, dx) * (180 / Math.PI) + 360) % 360
    const nearestNice = Math.round(rawDegrees / angleSnapIncrement) * angleSnapIncrement
    const diff = Math.min(Math.abs(rawDegrees - nearestNice), 360 - Math.abs(rawDegrees - nearestNice))

    if (diff <= angleSnapTolerance) {
      this.angleSnapped = true
      const rad = (nearestNice * Math.PI) / 180
      return {
        x: from.x + Math.cos(rad) * distance,
        y: from.y + Math.sin(rad) * distance
      }
    }

    this.angleSnapped = false
    return { x: mouseX, y: mouseY }
  }

  /** Finds the best snap point for the cursor while drawing: existing corners first,
   * then crossings with other walls, then a point lying on an existing wall's edge,
   * and finally a sticky angle increment relative to the last placed corner. Corner and
   * edge snapping apply even before the first point of a chain is placed. */
  private computeDrawSnap(mouseX: number, mouseY: number): SimplePoint {
    const lastNode = this.lastNode

    const cornerSnap = this.snapToNearbyCorner(mouseX, mouseY, lastNode)
    if (cornerSnap) {
      this.angleSnapped = false
      return cornerSnap
    }

    if (lastNode) {
      const intersectionSnap = this.snapToWallIntersection(lastNode.x, lastNode.y, mouseX, mouseY, lastNode)
      if (intersectionSnap) {
        this.angleSnapped = false
        return intersectionSnap
      }
    }

    const edgeSnap = this.snapToNearbyWallEdge(mouseX, mouseY, lastNode)
    if (edgeSnap) {
      this.angleSnapped = false
      return edgeSnap
    }

    if (lastNode) {
      return this.computeAngleSnap(lastNode, mouseX, mouseY)
    }

    this.angleSnapped = false
    return { x: mouseX, y: mouseY }
  }

  /** Snap used while measuring: corners and wall edges always, crossings with the
   * in-progress measuring line once a first point has been placed, and finally a
   * sticky angle increment relative to that first point. */
  private computeMeasureSnap(mouseX: number, mouseY: number): SimplePoint {
    let snapped: SimplePoint | null = this.snapToNearbyCorner(mouseX, mouseY, null)

    if (!snapped && this.measureLastNode) {
      snapped = this.snapToWallIntersection(this.measureLastNode.x, this.measureLastNode.y, mouseX, mouseY, null)
    }
    if (!snapped) {
      snapped = this.snapToNearbyWallEdge(mouseX, mouseY, null)
    }
    if (snapped) {
      this.angleSnapped = false
      return snapped
    }

    if (this.measureLastNode) {
      return this.computeAngleSnap(this.measureLastNode, mouseX, mouseY)
    }

    this.angleSnapped = false
    return { x: mouseX, y: mouseY }
  }

  /** */
  private updateTarget(): void {
    if (this.mode == floorplannerModes.DRAW) {
      const snapped = this.computeDrawSnap(this.mouseX, this.mouseY)
      this.targetX = snapped.x
      this.targetY = snapped.y
    } else if (this.mode == floorplannerModes.MEASURE) {
      const snapped = this.computeMeasureSnap(this.mouseX, this.mouseY)
      this.targetX = snapped.x
      this.targetY = snapped.y
    } else if (this.mode == floorplannerModes.CUT) {
      this.updateCutPreview()
    } else {
      this.targetX = this.mouseX
      this.targetY = this.mouseY
    }

    this.view.draw()
    this.fireDrawingLength()
    this.fireMeasureLength()
  }

  /** Recomputes `cutPoint` from the currently hovered wall (or a typed override) and fires
   * `cutLengthCallbacks` with the resulting split lengths. */
  private updateCutPreview(): void {
    const wall = this.activeWall

    if (!wall) {
      this.cutPoint = null
      this.cutLengthCallbacks.fire(null)
      return
    }

    const startX = wall.getStartX()
    const startY = wall.getStartY()
    const endX = wall.getEndX()
    const endY = wall.getEndY()
    const total = Utils.distance(startX, startY, endX, endY)
    const maxDist = Math.max(total - minCutSegment, minCutSegment)

    const closest = Utils.closestPointOnLine(this.mouseX, this.mouseY, startX, startY, endX, endY)
    let distFromStart = Utils.distance(startX, startY, closest.x, closest.y)
    distFromStart = Math.min(Math.max(distFromStart, minCutSegment), maxDist)

    if (!this.isTypingLength) {
      this.cutNearSide = distFromStart <= total / 2 ? 'start' : 'end'
    } else if (this.typedLength !== '') {
      const typedCm = this.typedValueToCm(parseFloat(this.typedLength) || 0)
      distFromStart = this.cutNearSide === 'start' ? typedCm : total - typedCm
      distFromStart = Math.min(Math.max(distFromStart, minCutSegment), maxDist)
    }

    const dirX = (endX - startX) / total
    const dirY = (endY - startY) / total
    this.cutPoint = { x: startX + dirX * distFromStart, y: startY + dirY * distFromStart }

    const lengthA = distFromStart
    const lengthB = total - distFromStart

    this.cutLengthCallbacks.fire({
      lengthA,
      lengthB,
      formattedA: Dimensioning.cmToMeasure(lengthA),
      formattedB: Dimensioning.cmToMeasure(lengthB),
      screenX: this.rawMouseX,
      screenY: this.rawMouseY,
      typedValue: this.typedLength,
      isTyping: this.isTypingLength,
      nearSide: this.cutNearSide
    })
  }

  /** Fires the current in-progress wall length (and screen position) for the floating tooltip. */
  private fireDrawingLength(): void {
    if (this.mode != floorplannerModes.DRAW || !this.lastNode) {
      this.drawingLengthCallbacks.fire(null)
      return
    }

    const lengthCm = Utils.distance(this.lastNode.x, this.lastNode.y, this.targetX, this.targetY)
    const angleDegrees = this.angleBetween(this.lastNode, this.targetX, this.targetY)

    this.drawingLengthCallbacks.fire({
      lengthCm,
      formatted: Dimensioning.cmToMeasure(lengthCm),
      angleDegrees,
      angleSnapped: this.angleSnapped,
      screenX: this.rawMouseX,
      screenY: this.rawMouseY,
      typedValue: this.typedLength,
      isTyping: this.isTypingLength
    })
  }

  /** Fires the current in-progress measurement (and screen position) for the floating tooltip. */
  private fireMeasureLength(): void {
    if (this.mode != floorplannerModes.MEASURE || !this.measureLastNode) {
      this.measureLengthCallbacks.fire(null)
      return
    }

    const lengthCm = Utils.distance(
      this.measureLastNode.x,
      this.measureLastNode.y,
      this.targetX,
      this.targetY
    )
    const angleDegrees = this.angleBetween(this.measureLastNode, this.targetX, this.targetY)

    this.measureLengthCallbacks.fire({
      lengthCm,
      formatted: Dimensioning.cmToMeasure(lengthCm),
      angleDegrees,
      angleSnapped: this.angleSnapped,
      screenX: this.rawMouseX,
      screenY: this.rawMouseY
    })
  }

  /** Angle (0-359°, 0 = east, 90 = south) from `from` to a point, rounded to the nearest degree. */
  private angleBetween(from: SimplePoint, toX: number, toY: number): number {
    const raw = (Math.atan2(toY - from.y, toX - from.x) * (180 / Math.PI) + 360) % 360
    return Math.round(raw)
  }

  /** Converts a plain number typed by the user (interpreted in the current dimension unit)
   * to centimeters. Unlike Dimensioning.cmToMeasure's feet'inches" display, typed input is
   * a plain decimal in the active unit (e.g. "96" while in inches means 96 inches). */
  private typedValueToCm(value: number): number {
    const unit = Configuration.getStringValue(configDimUnit)
    switch (unit) {
      case dimInch:
        return value * 2.54
      case 'mm':
        return value / 10
      case 'm':
        return value * 100
      case 'cm':
      default:
        return value
    }
  }

  /** Refreshes whichever live preview is relevant to the current mode after a typed digit changes. */
  private refreshTypedPreview(): void {
    if (this.mode == floorplannerModes.DRAW) {
      this.fireDrawingLength()
    } else if (this.mode == floorplannerModes.CUT) {
      this.updateCutPreview()
    }
  }

  /** Handles digit/backspace/enter keys used to type an exact length while drawing or cutting. */
  private handleLengthTypingKey(e: KeyboardEvent): void {
    const drawActive = this.mode == floorplannerModes.DRAW && this.lastNode != null
    const cutActive = this.mode == floorplannerModes.CUT && this.activeWall != null
    if (!drawActive && !cutActive) return

    const target = e.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return
    }

    if (/^[0-9]$/.test(e.key)) {
      this.typedLength += e.key
      this.isTypingLength = true
      e.preventDefault()
      this.refreshTypedPreview()
    } else if (e.key === '.' && !this.typedLength.includes('.')) {
      this.typedLength += this.typedLength === '' ? '0.' : '.'
      this.isTypingLength = true
      e.preventDefault()
      this.refreshTypedPreview()
    } else if (e.key === 'Backspace' && this.isTypingLength) {
      this.typedLength = this.typedLength.slice(0, -1)
      if (this.typedLength === '') this.isTypingLength = false
      e.preventDefault()
      this.refreshTypedPreview()
    } else if (e.key === 'Enter' && this.isTypingLength && this.typedLength !== '') {
      e.preventDefault()
      if (drawActive) this.commitTypedLength()
      else if (cutActive) this.commitTypedCut()
    }
  }

  /** Places the next corner at the typed exact length, in the current drawing direction. */
  private commitTypedLength(): void {
    const lastNode = this.lastNode
    const typed = parseFloat(this.typedLength)
    this.typedLength = ''
    this.isTypingLength = false

    if (!lastNode || !isFinite(typed) || typed <= 0) {
      this.fireDrawingLength()
      return
    }

    const lengthCm = this.typedValueToCm(typed)

    const dx = this.targetX - lastNode.x
    const dy = this.targetY - lastNode.y
    const currentDist = Math.sqrt(dx * dx + dy * dy)
    const [dirX, dirY] = currentDist > 0.0001 ? [dx / currentDist, dy / currentDist] : [1, 0]

    const newX = lastNode.x + dirX * lengthCm
    const newY = lastNode.y + dirY * lengthCm

    this.model.checkpoint()
    const corner = this.floorplan.newCorner(newX, newY)
    this.floorplan.newWall(lastNode, corner)

    if (corner.mergeWithIntersected()) {
      this.setMode(floorplannerModes.MOVE)
      return
    }

    this.lastNode = corner
    this.updateTarget()
  }

  /** Commits a typed exact cut length — `updateCutPreview` already placed `cutPoint` at the
   * right spot the moment the digit was typed, so this just performs the cut there. */
  private commitTypedCut(): void {
    const wall = this.activeWall
    const point = this.cutPoint
    this.typedLength = ''
    this.isTypingLength = false

    if (!wall || !point) return
    this.performCut(wall, point)
  }

  /** Splits `wall` into two walls meeting at `point`, preserving texture/thickness/height.
   * Refuses (and fires `cutBlockedCallbacks`) if the wall has a door/window attached, since
   * those would otherwise be silently detached when the original wall is removed. */
  private performCut(wall: Wall, point: SimplePoint): void {
    if (wall.items.length > 0 || wall.onItems.length > 0) {
      this.cutBlockedCallbacks.fire(wall)
      return
    }

    const start = wall.getStart()
    const end = wall.getEnd()
    const frontTexture = wall.frontTexture
    const backTexture = wall.backTexture
    const thickness = wall.thickness
    const height = wall.height

    this.model.checkpoint()

    // Remove the original wall first so intermediate states never have two
    // overlapping walls occupying the same line while the room is recomputed.
    wall.remove()

    const newCorner = this.floorplan.newCorner(point.x, point.y)

    const wallA = this.floorplan.newWall(start, newCorner)
    wallA.frontTexture = frontTexture
    wallA.backTexture = backTexture
    wallA.thickness = thickness
    wallA.height = height

    const wallB = this.floorplan.newWall(newCorner, end)
    wallB.frontTexture = frontTexture
    wallB.backTexture = backTexture
    wallB.thickness = thickness
    wallB.height = height

    this.floorplan.update()

    this.activeWall = null
    this.cutPoint = null
    this.cutLengthCallbacks.fire(null)
    this.view.draw()
  }

  /** */
  private mousedown(): void {
    this.mouseDown = true
    this.mouseMoved = false
    this.lastX = this.rawMouseX
    this.lastY = this.rawMouseY

    // delete
    if (this.mode == floorplannerModes.DELETE) {
      if (this.activeCorner) {
        this.model.checkpoint()
        this.activeCorner.removeAll()
      } else if (this.activeWall) {
        this.model.checkpoint()
        this.activeWall.remove()
      } else {
        this.setMode(floorplannerModes.MOVE)
      }
    }

    // about to drag a corner or wall — one checkpoint per gesture, not per frame
    if (this.mode == floorplannerModes.MOVE && (this.activeCorner || this.activeWall)) {
      this.model.checkpoint()
    }
  }

  /** */
  private mousemove(event: MouseEvent): void {
    this.pointermove(event.clientX, event.clientY, true)
  }

  /** Shared pointer movement for mouse and touch input. */
  private pointermove(clientX: number, clientY: number, markMoved: boolean): void {
    if (markMoved) this.mouseMoved = true

    this.rawMouseX = clientX
    this.rawMouseY = clientY

    const rect = this.canvasElement.getBoundingClientRect()
    this.mouseX = (clientX - rect.left) * this.cmPerPixel + this.originX * this.cmPerPixel
    this.mouseY = (clientY - rect.top) * this.cmPerPixel + this.originY * this.cmPerPixel

    // update object hover (corner/wall) — must run before target/cut-preview below, since
    // CUT mode's preview depends on activeWall being current for this frame
    if (this.mode != floorplannerModes.DRAW && !this.mouseDown) {
      const hoverCorner: Corner | null = this.floorplan.overlappedCorner(this.mouseX, this.mouseY)
      const hoverWall: Wall | null = this.floorplan.overlappedWall(this.mouseX, this.mouseY)
      let draw = false
      if (hoverCorner != this.activeCorner) {
        this.activeCorner = hoverCorner
        draw = true
      }
      // corner takes precendence
      if (this.activeCorner == null) {
        if (hoverWall != this.activeWall) {
          this.activeWall = hoverWall
          draw = true
        }
      } else {
        this.activeWall = null
      }
      if (draw) {
        this.view.draw()
      }
    }

    // update target (snapped position of actual mouse), or the cut preview
    if (
      this.mode == floorplannerModes.DRAW ||
      this.mode == floorplannerModes.MEASURE ||
      this.mode == floorplannerModes.CUT ||
      (this.mode == floorplannerModes.MOVE && this.mouseDown)
    ) {
      this.updateTarget()
    }

    // panning
    if (this.mouseDown && !this.activeCorner && !this.activeWall) {
      this.originX += this.lastX - this.rawMouseX
      this.originY += this.lastY - this.rawMouseY
      this.lastX = this.rawMouseX
      this.lastY = this.rawMouseY
      this.view.draw()
    }

    // dragging
    if (this.mode == floorplannerModes.MOVE && this.mouseDown) {
      if (this.activeCorner) {
        this.activeCorner.move(this.mouseX, this.mouseY)
        const snap =
          this.snapToNearbyCorner(this.activeCorner.x, this.activeCorner.y, this.activeCorner) ??
          this.snapToNearbyWallEdge(this.activeCorner.x, this.activeCorner.y, this.activeCorner)
        if (snap) {
          this.activeCorner.move(snap.x, snap.y)
        } else {
          this.activeCorner.snapToAxis(snapTolerance)
        }
      } else if (this.activeWall) {
        this.activeWall.relativeMove(
          (this.rawMouseX - this.lastX) * this.cmPerPixel,
          (this.rawMouseY - this.lastY) * this.cmPerPixel
        )
        this.activeWall.snapToAxis(snapTolerance)
        this.lastX = this.rawMouseX
        this.lastY = this.rawMouseY
      }
      this.view.draw()
    }
  }

  private touchstart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      const touch = event.touches[0]
      event.preventDefault()
      this.touchMode = 'single'
      this.touchStartX = touch.clientX
      this.touchStartY = touch.clientY
      this.pointermove(touch.clientX, touch.clientY, false)
      this.mousedown()
    } else if (event.touches.length === 2) {
      event.preventDefault()
      this.startPinch(event)
    }
  }

  private touchmove(event: TouchEvent): void {
    if (event.touches.length === 2) {
      event.preventDefault()
      if (this.touchMode !== 'pinch') this.startPinch(event)
      this.updatePinch(event)
      return
    }

    if (event.touches.length !== 1 || this.touchMode !== 'single') return

    const touch = event.touches[0]
    event.preventDefault()
    const dx = touch.clientX - this.touchStartX
    const dy = touch.clientY - this.touchStartY
    const moved = Math.sqrt(dx * dx + dy * dy) > touchTapSlopPixels
    if (!moved) {
      const wasMouseDown = this.mouseDown
      this.mouseDown = false
      this.pointermove(touch.clientX, touch.clientY, false)
      this.mouseDown = wasMouseDown
      return
    }

    this.pointermove(touch.clientX, touch.clientY, moved)
  }

  private touchend(event: TouchEvent): void {
    event.preventDefault()

    if (this.touchMode === 'single') {
      this.mouseup()
    } else {
      this.mouseDown = false
    }

    this.touchMode = null
    if (event.touches.length === 1) {
      const touch = event.touches[0]
      this.touchMode = 'single'
      this.touchStartX = touch.clientX
      this.touchStartY = touch.clientY
      this.pointermove(touch.clientX, touch.clientY, false)
      this.mousedown()
    }
  }

  private startPinch(event: TouchEvent): void {
    const distance = this.getTouchDistance(event)
    const center = this.getTouchCenter(event)
    const rect = this.canvasElement.getBoundingClientRect()
    const screenX = center.x - rect.left
    const screenY = center.y - rect.top

    this.mouseDown = false
    this.touchMode = 'pinch'
    this.touchStartDistance = distance
    this.touchStartCmPerPixel = this.cmPerPixel
    this.touchPinchWorldX = (screenX + this.originX) * this.cmPerPixel
    this.touchPinchWorldY = (screenY + this.originY) * this.cmPerPixel
  }

  private updatePinch(event: TouchEvent): void {
    if (this.touchStartDistance <= 0) return

    const distance = this.getTouchDistance(event)
    const center = this.getTouchCenter(event)
    const rect = this.canvasElement.getBoundingClientRect()
    const screenX = center.x - rect.left
    const screenY = center.y - rect.top
    const newCmPerPixel = this.touchStartCmPerPixel * (this.touchStartDistance / distance)

    this.setZoomLevel(newCmPerPixel)
    this.originX = this.touchPinchWorldX / this.cmPerPixel - screenX
    this.originY = this.touchPinchWorldY / this.cmPerPixel - screenY
    this.view.draw()
  }

  private getTouchDistance(event: TouchEvent): number {
    const dx = event.touches[0].clientX - event.touches[1].clientX
    const dy = event.touches[0].clientY - event.touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  private getTouchCenter(event: TouchEvent): SimplePoint {
    return {
      x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
      y: (event.touches[0].clientY + event.touches[1].clientY) / 2
    }
  }

  /** */
  private mouseup(): void {
    this.mouseDown = false

    // drawing
    if (this.mode == floorplannerModes.DRAW && !this.mouseMoved) {
      this.model.checkpoint()
      const corner = this.floorplan.newCorner(this.targetX, this.targetY)
      if (this.lastNode != null) {
        this.floorplan.newWall(this.lastNode, corner)
      }
      if (corner.mergeWithIntersected() && this.lastNode != null) {
        this.setMode(floorplannerModes.MOVE)
      }
      this.lastNode = corner
    }

    // cutting
    if (this.mode == floorplannerModes.CUT && !this.mouseMoved && this.activeWall && this.cutPoint) {
      this.performCut(this.activeWall, this.cutPoint)
    }

    // measuring — each click drops/advances the reference point
    if (this.mode == floorplannerModes.MEASURE && !this.mouseMoved) {
      this.measureLastNode = { x: this.targetX, y: this.targetY }
      this.updateTarget()
    }
  }

  /** */
  private mouseleave(): void {
    this.mouseDown = false
    //scope.setMode(scope.modes.MOVE);
  }

  /** Normalizes wheel deltas to roughly-pixel units — browsers report deltaY in different
   * units (DOM_DELTA_LINE on some Windows/Firefox setups, DOM_DELTA_PIXEL on Mac/Chrome/most
   * trackpads) and mixing them up makes zoom feel wildly different across devices. */
  private normalizeWheelDelta(event: WheelEvent): { deltaX: number; deltaY: number } {
    const LINE_HEIGHT = 18
    const PAGE_SIZE = 800
    const factor = event.deltaMode === 1 ? LINE_HEIGHT : event.deltaMode === 2 ? PAGE_SIZE : 1
    return { deltaX: event.deltaX * factor, deltaY: event.deltaY * factor }
  }

  private setZoomLevel(cmPerPixel: number): boolean {
    const newCmPerPixel = Math.min(Math.max(cmPerPixel, minCmPerPixel), maxCmPerPixel)
    if (newCmPerPixel === this.cmPerPixel) return false

    this.cmPerPixel = newCmPerPixel
    this.pixelsPerCm = 1.0 / newCmPerPixel
    this.wallWidth = 10.0 * this.pixelsPerCm
    this.zoomChangedCallbacks.fire(this.getZoomPercent())
    return true
  }

  /**
   * Zoom + pan for both mouse wheels and trackpads:
   *  - Pinch-to-zoom (browsers tag this as a wheel event with ctrlKey=true) always zooms.
   *  - A clearly horizontal two-finger swipe pans instead of zooming — treating it as zoom
   *    would fight the platform convention and feel broken.
   *  - Everything else (a mouse wheel notch, or a mostly-vertical trackpad scroll) zooms,
   *    centered on the cursor so the point under it stays put.
   */
  private mousewheel(event: WheelEvent): void {
    event.preventDefault()

    const { deltaX, deltaY } = this.normalizeWheelDelta(event)

    if (!event.ctrlKey && Math.abs(deltaX) > Math.abs(deltaY)) {
      this.originX += deltaX
      this.originY += deltaY
      this.view.draw()
      return
    }

    const rect = this.canvasElement.getBoundingClientRect()
    const screenX = event.clientX - rect.left
    const screenY = event.clientY - rect.top

    // deltaY > 0 (scroll down / pinch closed) zooms out; deltaY < 0 zooms in
    const rawScale = Math.exp(-deltaY * zoomSensitivity)
    const oldCmPerPixel = this.cmPerPixel
    const newCmPerPixel = oldCmPerPixel / rawScale
    if (!this.setZoomLevel(newCmPerPixel)) return

    // keep the world point currently under the cursor fixed in place
    const actualScale = oldCmPerPixel / this.cmPerPixel
    this.originX = (screenX + this.originX) * actualScale - screenX
    this.originY = (screenY + this.originY) * actualScale - screenY

    this.view.draw()
  }

  /** Current zoom level as a percentage of the default scale (100 = default). */
  public getZoomPercent(): number {
    return Math.round((defaultCmPerPixel / this.cmPerPixel) * 100)
  }

  /** Zooms in/out by a fixed step, centered on the canvas — used by +/- zoom buttons. */
  public zoomBy(factor: number): void {
    const rect = this.canvasElement.getBoundingClientRect()
    const screenX = rect.width / 2
    const screenY = rect.height / 2
    const oldCmPerPixel = this.cmPerPixel
    if (!this.setZoomLevel(this.cmPerPixel / factor)) return

    const actualScale = oldCmPerPixel / this.cmPerPixel
    this.originX = (screenX + this.originX) * actualScale - screenX
    this.originY = (screenY + this.originY) * actualScale - screenY
    this.view.draw()
  }

  /** Resets to the default zoom level, keeping the plan centered. */
  public resetZoom(): void {
    this.setZoomLevel(defaultCmPerPixel)
    this.resetOrigin()
    this.view.draw()
  }

  /** Fits all floorplan corners inside the current canvas. */
  public fitToView(padding = 56): void {
    const corners = this.floorplan.getCorners()
    if (corners.length === 0) {
      this.resetZoom()
      return
    }

    let xMin = Infinity
    let xMax = -Infinity
    let yMin = Infinity
    let yMax = -Infinity
    corners.forEach((corner) => {
      if (corner.x < xMin) xMin = corner.x
      if (corner.x > xMax) xMax = corner.x
      if (corner.y < yMin) yMin = corner.y
      if (corner.y > yMax) yMax = corner.y
    })

    const canvasWidth = Math.max(this.canvasElement.clientWidth, 1)
    const canvasHeight = Math.max(this.canvasElement.clientHeight, 1)
    const usableWidth = Math.max(canvasWidth - padding * 2, canvasWidth * 0.4, 1)
    const usableHeight = Math.max(canvasHeight - padding * 2, canvasHeight * 0.4, 1)
    const widthCm = Math.max(xMax - xMin, 100)
    const heightCm = Math.max(yMax - yMin, 100)
    const requiredCmPerPixel = Math.max(widthCm / usableWidth, heightCm / usableHeight)

    this.setZoomLevel(requiredCmPerPixel)
    this.originX = (xMin + xMax) / 2 / this.cmPerPixel - canvasWidth / 2
    this.originY = (yMin + yMax) / 2 / this.cmPerPixel - canvasHeight / 2
    this.view.draw()
  }

  /** Resets the view - centers and resizes the floorplan */
  public reset(): void {
    this.resizeView()
    this.setMode(floorplannerModes.MOVE)
    this.fitToView()
  }

  /** Resizes the view to fit the container */
  public resizeView(): void {
    this.view.handleWindowResize()
  }

  /** Sets the interaction mode */
  public setMode(mode: FloorplannerMode): void {
    this.lastNode = null
    this.cutPoint = null
    this.measureLastNode = null
    this.typedLength = ''
    this.isTypingLength = false
    this.mode = mode
    this.modeResetCallbacks.forEach((callback) => callback(mode))
    this.updateTarget()
  }

  /** Sets the origin so that floorplan is centered */
  public resetOrigin(): void {
    const centerX = this.canvasElement.clientWidth / 2.0
    const centerY = this.canvasElement.clientHeight / 2.0
    const centerFloorplan = this.floorplan.getCenter()
    this.originX = centerFloorplan.x * this.pixelsPerCm - centerX
    this.originY = centerFloorplan.z * this.pixelsPerCm - centerY
  }

  /** Convert from THREEjs coords to canvas coords. */
  public convertX(x: number): number {
    return (x - this.originX * this.cmPerPixel) * this.pixelsPerCm
  }

  /** Convert from THREEjs coords to canvas coords. */
  public convertY(y: number): number {
    return (y - this.originY * this.cmPerPixel) * this.pixelsPerCm
  }
}
