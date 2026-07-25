import { Floorplan } from '../model/floorplan'
import { Wall } from '../model/wall'
import { Corner } from '../model/corner'
import { Room } from '../model/room'
import { HalfEdge } from '../model/half_edge'
import { Dimensioning } from '../core/dimensioning'
import { Utils } from '../core/utils'
import type { Floorplanner } from './floorplanner'
import type { Item } from '../items/item'

/** */
export const floorplannerModes = {
  MOVE: 0,
  DRAW: 1,
  DELETE: 2,
  CUT: 3,
  MEASURE: 4
}

// grid parameters
const gridSpacing = 20 // pixels
const gridWidth = 1
const gridColor = '#f1f1f1'

// room config
const roomColor = '#f9f9f9'

// item config (2D top-down footprints, drawn only when viewerData is authored)
const itemStrokeWidth = 1.5

// wall config
const wallWidth = 5
const wallWidthHover = 7
const wallColor = '#dddddd'
const wallColorHover = '#008cba'
const edgeColor = '#888888'
const edgeColorHover = '#008cba'
const edgeWidth = 1

const deleteColor = '#ff0000'

// cut tool config
const cutColor = '#f59e0b'
const cutMarkerRadius = 6

// measure tool config
const measureColor = '#7c3aed'

const angleGuideColor = '#94a3b8'

// corner config
const cornerRadius = 0
const cornerRadiusHover = 7
const cornerColor = '#cccccc'
const cornerColorHover = '#008cba'

/**
 * The View to be used by a Floorplanner to render in/interact with.
 */
export class FloorplannerView {
  /** The canvas element. */
  private canvasElement: HTMLCanvasElement

  /** The 2D context. */
  private context: CanvasRenderingContext2D

  /** Resize handler reference for cleanup */
  private resizeHandler: () => void

  /** */
  constructor(
    private floorplan: Floorplan,
    private viewmodel: Floorplanner,
    private canvas: string
  ) {
    this.canvasElement = document.getElementById(canvas) as HTMLCanvasElement
    this.context = this.canvasElement.getContext('2d') as CanvasRenderingContext2D

    // Bind resize handler for later cleanup
    this.resizeHandler = () => {
      this.handleWindowResize()
    }
    window.addEventListener('resize', this.resizeHandler)
    this.handleWindowResize()
  }

  /** Cleanup method to remove event listeners */
  public destroy() {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler)
    }
  }

  /** */
  public handleWindowResize() {
    const canvasElement = document.getElementById(this.canvas) as HTMLCanvasElement
    // Check if canvas element exists before accessing parentElement
    if (!canvasElement) {
      console.warn('Canvas element not found:', this.canvas)
      return
    }
    const parent = canvasElement.parentElement
    if (parent) {
      const parentHeight = parent.clientHeight
      const parentWidth = parent.clientWidth
      canvasElement.style.height = parentHeight + 'px'
      canvasElement.style.width = parentWidth + 'px'
      this.canvasElement.height = parentHeight
      this.canvasElement.width = parentWidth
    }
    this.draw()
  }

  /** */
  public draw() {
    this.context.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height)

    this.drawGrid()

    this.floorplan.getRooms().forEach((room) => {
      this.drawRoom(room)
    })

    this.floorplan.getRooms().forEach((room) => {
      this.drawRoomLabel(room)
    })

    this.floorplan.getWalls().forEach((wall) => {
      this.drawWall(wall)
    })

    this.floorplan.getCorners().forEach((corner) => {
      this.drawCorner(corner)
    })

    this.viewmodel
      .getModel()
      .scene.getItems()
      .forEach((item) => {
        this.drawItem(item)
      })

    if (this.viewmodel.mode == floorplannerModes.DRAW) {
      this.drawTarget(this.viewmodel.targetX, this.viewmodel.targetY, this.viewmodel.lastNode)
    }

    if (this.viewmodel.mode == floorplannerModes.CUT) {
      this.drawCutPreview()
    }

    if (this.viewmodel.mode == floorplannerModes.MEASURE) {
      this.drawMeasurePreview()
    }

    this.floorplan.getWalls().forEach((wall) => {
      this.drawWallLabels(wall)
    })
  }

  /** */
  private drawWallLabels(wall: Wall) {
    // we'll just draw the shorter label... idk
    if (wall.backEdge && wall.frontEdge) {
      if (wall.backEdge.interiorDistance < wall.frontEdge.interiorDistance) {
        this.drawEdgeLabel(wall.backEdge)
      } else {
        this.drawEdgeLabel(wall.frontEdge)
      }
    } else if (wall.backEdge) {
      this.drawEdgeLabel(wall.backEdge)
    } else if (wall.frontEdge) {
      this.drawEdgeLabel(wall.frontEdge)
    }
  }

  /** */
  private drawWall(wall: Wall) {
    const hover = wall === this.viewmodel.activeWall
    let color = wallColor
    if (hover && this.viewmodel.mode == floorplannerModes.DELETE) {
      color = deleteColor
    } else if (hover && this.viewmodel.mode == floorplannerModes.CUT) {
      color = cutColor
    } else if (hover) {
      color = wallColorHover
    }
    this.drawLine(
      this.viewmodel.convertX(wall.getStartX()),
      this.viewmodel.convertY(wall.getStartY()),
      this.viewmodel.convertX(wall.getEndX()),
      this.viewmodel.convertY(wall.getEndY()),
      hover ? wallWidthHover : wallWidth,
      color
    )
    if (!hover && wall.frontEdge) {
      this.drawEdge(wall.frontEdge, hover)
    }
    if (!hover && wall.backEdge) {
      this.drawEdge(wall.backEdge, hover)
    }
  }

  /** */
  private drawEdgeLabel(edge: HalfEdge) {
    const pos = edge.interiorCenter()
    const length = edge.interiorDistance()
    if (length < 60) {
      // dont draw labels on walls this short
      return
    }
    this.context.font = 'normal 12px Arial'
    this.context.fillStyle = '#000000'
    this.context.textBaseline = 'middle'
    this.context.textAlign = 'center'
    this.context.strokeStyle = '#ffffff'
    this.context.lineWidth = 4

    this.context.strokeText(
      Dimensioning.cmToMeasure(length),
      this.viewmodel.convertX(pos.x),
      this.viewmodel.convertY(pos.y)
    )
    this.context.fillText(
      Dimensioning.cmToMeasure(length),
      this.viewmodel.convertX(pos.x),
      this.viewmodel.convertY(pos.y)
    )
  }

  /** */
  private drawEdge(edge: HalfEdge, hover: boolean) {
    let color = edgeColor
    if (hover && this.viewmodel.mode == floorplannerModes.DELETE) {
      color = deleteColor
    } else if (hover) {
      color = edgeColorHover
    }
    const corners = edge.corners()

    this.drawPolygon(
      Utils.map(corners, (corner) => {
        return this.viewmodel.convertX(corner.x)
      }),
      Utils.map(corners, (corner) => {
        return this.viewmodel.convertY(corner.y)
      }),
      false,
      null,
      true,
      color,
      edgeWidth
    )
  }

  /** */
  private drawRoom(room: Room) {
    this.drawPolygon(
      Utils.map(room.corners, (corner: Corner) => {
        return this.viewmodel.convertX(corner.x)
      }),
      Utils.map(room.corners, (corner: Corner) => {
        return this.viewmodel.convertY(corner.y)
      }),
      true,
      roomColor
    )
  }

  /** Draws the room's name (or, if unnamed, its area) at its centroid. */
  private drawRoomLabel(room: Room) {
    if (room.getWidth() < 80 || room.getDepth() < 80) return // too small to bother labeling

    const center = room.getCenter()
    const x = this.viewmodel.convertX(center.x)
    const y = this.viewmodel.convertY(center.y)
    const name = room.getName()

    this.context.textAlign = 'center'
    this.context.strokeStyle = '#ffffff'

    if (name) {
      this.context.font = '600 13px Arial'
      this.context.fillStyle = '#3a3f47'
      this.context.textBaseline = 'alphabetic'
      this.context.lineWidth = 4
      this.context.strokeText(name, x, y - 3)
      this.context.fillText(name, x, y - 3)

      this.context.font = 'normal 11px Arial'
      this.context.fillStyle = '#8a8f98'
      this.context.textBaseline = 'top'
      this.context.lineWidth = 3
      const area = Dimensioning.cmSquaredToAreaMeasure(room.getArea())
      this.context.strokeText(area, x, y + 4)
      this.context.fillText(area, x, y + 4)
    } else {
      this.context.font = 'normal 12px Arial'
      this.context.fillStyle = '#8a8f98'
      this.context.textBaseline = 'middle'
      this.context.lineWidth = 4
      const area = Dimensioning.cmSquaredToAreaMeasure(room.getArea())
      this.context.strokeText(area, x, y)
      this.context.fillText(area, x, y)
    }
  }

  /** */
  private drawCorner(corner: Corner) {
    const hover = corner === this.viewmodel.activeCorner
    let color = cornerColor
    if (hover && this.viewmodel.mode == floorplannerModes.DELETE) {
      color = deleteColor
    } else if (hover) {
      color = cornerColorHover
    }
    this.drawCircle(
      this.viewmodel.convertX(corner.x),
      this.viewmodel.convertY(corner.y),
      hover ? cornerRadiusHover : cornerRadius,
      color
    )
  }

  /**
   * Draws a placed item's top-down footprint. Uses its authored
   * viewerData path icon when the catalog entry has one, otherwise falls
   * back to a plain rectangle sized to the item's current (possibly
   * resized) width/depth — so every item shows up in 2D immediately, with
   * or without hand-authored icon data.
   */
  private drawItem(item: Item) {
    const x = this.viewmodel.convertX(item.position.x)
    const y = this.viewmodel.convertY(item.position.z)
    // A length (not a point) in cm -> pixels, consistent with convertX/Y's
    // own pan+zoom transform (there's no dedicated "convert a distance"
    // helper on Floorplanner, so it's derived from two converted points).
    const pixelsPerCm = this.viewmodel.convertX(1) - this.viewmodel.convertX(0)

    // Three.js rotation.y and canvas rotation turn out to have the same
    // sign here because convertX/convertY apply no axis flip between
    // plan-space (x, z) and canvas (x, y) — see Item.getCorners(), which
    // this mirrors for consistency with how the 3D scene lays items out.
    const rotation = -item.rotation.y

    this.context.save()
    this.context.translate(x, y)
    this.context.rotate(rotation)

    const viewerData = item.metadata.viewerData
    if (viewerData?.paths?.length && viewerData.viewBox.width > 0 && viewerData.viewBox.height > 0) {
      this.drawItemPaths(item, viewerData, pixelsPerCm)
    }
    // No authored icon -> draw nothing, rather than a generic placeholder shape.

    this.context.restore()
  }

  private drawItemPaths(
    item: Item,
    viewerData: NonNullable<Item['metadata']['viewerData']>,
    pixelsPerCm: number
  ) {
    // Paths are authored at the item's default size — scale them to the
    // item's *current* footprint so a resized item's 2D icon stays in sync
    // with what's actually placed in the 3D scene.
    const scaleX = (item.getWidth() / viewerData.viewBox.width) * pixelsPerCm
    const scaleY = (item.getDepth() / viewerData.viewBox.height) * pixelsPerCm

    this.context.save()
    this.context.scale(scaleX, scaleY)

    viewerData.paths.forEach(({ d, fill, stroke }) => {
      let path: Path2D
      try {
        path = new Path2D(d)
      } catch {
        return // malformed path data — skip rather than break the whole draw
      }
      if (fill) {
        this.context.fillStyle = fill
        this.context.fill(path)
      }
      if (stroke) {
        // Undo the scale for stroke width so lines stay a consistent
        // thickness regardless of the item's footprint size.
        this.context.lineWidth = itemStrokeWidth / Math.max(Math.abs(scaleX), Math.abs(scaleY), 0.001)
        this.context.strokeStyle = stroke
        this.context.stroke(path)
      }
    })

    this.context.restore()
  }

  /** */
  private drawTarget(x: number, y: number, lastNode: Corner | null) {
    if (lastNode && this.viewmodel.angleSnapped) {
      this.drawAngleGuide(lastNode.x, lastNode.y, x, y)
    }
    this.drawCircle(
      this.viewmodel.convertX(x),
      this.viewmodel.convertY(y),
      cornerRadiusHover,
      cornerColorHover
    )
    if (this.viewmodel.lastNode) {
      this.drawLine(
        this.viewmodel.convertX(lastNode!.x),
        this.viewmodel.convertY(lastNode!.y),
        this.viewmodel.convertX(x),
        this.viewmodel.convertY(y),
        wallWidthHover,
        wallColorHover
      )
    }
  }

  /** Extends a faint dashed guide line through the full sticky-angle direction (past the
   * cursor in both directions), the way SketchUp-style inference lines work, so the "lock"
   * is visually obvious rather than just a number in a tooltip. */
  private drawAngleGuide(fromX: number, fromY: number, toX: number, toY: number) {
    const dx = toX - fromX
    const dy = toY - fromY
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 0.0001) return

    const dirX = dx / len
    const dirY = dy / len
    const guideLength = 3000 // cm — extends well past the visible canvas either way

    this.context.save()
    this.context.setLineDash([2, 6])
    this.drawLine(
      this.viewmodel.convertX(fromX - dirX * guideLength),
      this.viewmodel.convertY(fromY - dirY * guideLength),
      this.viewmodel.convertX(fromX + dirX * guideLength),
      this.viewmodel.convertY(fromY + dirY * guideLength),
      1,
      angleGuideColor
    )
    this.context.restore()
  }

  /** Draws a marker + perpendicular "cut line" at the pending cut point on the active wall. */
  private drawCutPreview() {
    const wall = this.viewmodel.activeWall
    const point = this.viewmodel.cutPoint
    if (!wall || !point) return

    const cx = this.viewmodel.convertX(point.x)
    const cy = this.viewmodel.convertY(point.y)

    // perpendicular tick across the wall, so the cut point reads as a "cut" rather than a dot
    const dx = wall.getEndX() - wall.getStartX()
    const dy = wall.getEndY() - wall.getStartY()
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const perpX = (-dy / len) * 14
    const perpY = (dx / len) * 14

    this.context.save()
    this.context.setLineDash([4, 3])
    this.drawLine(cx - perpX, cy - perpY, cx + perpX, cy + perpY, 2, cutColor)
    this.context.restore()

    this.drawCircle(cx, cy, cutMarkerRadius, cutColor)
  }

  /** Draws the in-progress, non-destructive measurement line between measureLastNode and the cursor. */
  private drawMeasurePreview() {
    const start = this.viewmodel.measureLastNode
    if (!start) {
      this.drawCircle(
        this.viewmodel.convertX(this.viewmodel.targetX),
        this.viewmodel.convertY(this.viewmodel.targetY),
        cornerRadiusHover,
        measureColor
      )
      return
    }

    const x1 = this.viewmodel.convertX(start.x)
    const y1 = this.viewmodel.convertY(start.y)
    const x2 = this.viewmodel.convertX(this.viewmodel.targetX)
    const y2 = this.viewmodel.convertY(this.viewmodel.targetY)

    if (this.viewmodel.angleSnapped) {
      this.drawAngleGuide(start.x, start.y, this.viewmodel.targetX, this.viewmodel.targetY)
    }

    this.context.save()
    this.context.setLineDash([6, 4])
    this.drawLine(x1, y1, x2, y2, 2, measureColor)
    this.context.restore()

    this.drawCircle(x1, y1, 5, measureColor)
    this.drawCircle(x2, y2, 5, measureColor)
  }

  /** */
  private drawLine(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number,
    color: string
  ) {
    // width is an integer
    // color is a hex string, i.e. #ff0000
    this.context.beginPath()
    this.context.moveTo(startX, startY)
    this.context.lineTo(endX, endY)
    this.context.lineWidth = width
    this.context.strokeStyle = color
    this.context.stroke()
  }

  /** */
  private drawPolygon(
    xArr: number[],
    yArr: number[],
    fill?: boolean,
    fillColor?: string | null,
    stroke?: boolean,
    strokeColor?: string,
    strokeWidth?: number
  ) {
    // fillColor is a hex string, i.e. #ff0000
    fill = fill || false
    stroke = stroke || false
    this.context.beginPath()
    this.context.moveTo(xArr[0], yArr[0])
    for (let i = 1; i < xArr.length; i++) {
      this.context.lineTo(xArr[i], yArr[i])
    }
    this.context.closePath()
    if (fill && fillColor) {
      this.context.fillStyle = fillColor
      this.context.fill()
    }
    if (stroke && strokeColor) {
      this.context.lineWidth = strokeWidth!
      this.context.strokeStyle = strokeColor
      this.context.stroke()
    }
  }

  /** */
  private drawCircle(centerX: number, centerY: number, radius: number, fillColor: string) {
    this.context.beginPath()
    this.context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false)
    this.context.fillStyle = fillColor
    this.context.fill()
  }

  /** returns n where -gridSize/2 < n <= gridSize/2  */
  private calculateGridOffset(n: number): number {
    if (n >= 0) {
      return ((n + gridSpacing / 2.0) % gridSpacing) - gridSpacing / 2.0
    } else {
      return ((n - gridSpacing / 2.0) % gridSpacing) + gridSpacing / 2.0
    }
  }

  /** */
  private drawGrid() {
    const offsetX = this.calculateGridOffset(-this.viewmodel.originX)
    const offsetY = this.calculateGridOffset(-this.viewmodel.originY)
    const width = this.canvasElement.width
    const height = this.canvasElement.height
    for (let x = 0; x <= width / gridSpacing; x++) {
      this.drawLine(
        gridSpacing * x + offsetX,
        0,
        gridSpacing * x + offsetX,
        height,
        gridWidth,
        gridColor
      )
    }
    for (let y = 0; y <= height / gridSpacing; y++) {
      this.drawLine(
        0,
        gridSpacing * y + offsetY,
        width,
        gridSpacing * y + offsetY,
        gridWidth,
        gridColor
      )
    }
  }
}
