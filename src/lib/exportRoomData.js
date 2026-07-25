import { Dimensioning } from '@blueprint3d/core/dimensioning'

function serializeItem(item) {
  const metadata = item.metadata || {}
  return {
    name: metadata.itemName || '',
    key: metadata.itemKey || null,
    category: metadata.category || null,
    model: metadata.modelUrl || null,
    position: { x: round(item.position.x), y: round(item.position.y), z: round(item.position.z) },
    rotationRadians: round(item.rotation.y, 3),
    sizeCm: {
      width: typeof item.getWidth === 'function' ? round(item.getWidth()) : null,
      height: typeof item.getHeight === 'function' ? round(item.getHeight()) : null,
      depth: typeof item.getDepth === 'function' ? round(item.getDepth()) : null
    },
    cutsWall: metadata.boolean !== false && (metadata.itemType === 3 || metadata.itemType === 7)
  }
}

function serializeWall(wall) {
  return {
    lengthCm: round(Math.hypot(wall.getEndX() - wall.getStartX(), wall.getEndY() - wall.getStartY())),
    thicknessCm: round(wall.thickness),
    heightCm: round(wall.height),
    frontTexture: wall.frontTexture || null,
    backTexture: wall.backTexture || null
  }
}

function round(n, decimals = 1) {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

function wallsBoundingRoom(floorplan, room) {
  const allWalls = floorplan.getWalls()
  const walls = []
  for (let i = 0; i < room.corners.length; i++) {
    const a = room.corners[i]
    const b = room.corners[(i + 1) % room.corners.length]
    const wall = allWalls.find(
      (w) => (w.getStart() === a && w.getEnd() === b) || (w.getStart() === b && w.getEnd() === a)
    )
    if (wall) walls.push(wall)
  }
  return walls
}

/** Builds the reference JSON for a single room: its own walls/textures and the items inside it. */
export function buildRoomExportData(blueprint3d, room) {
  const floorplan = blueprint3d.model.floorplan
  const items = blueprint3d.model.scene.getItems().filter((item) => room.containsPoint(item.position.x, item.position.z))

  return {
    type: 'room',
    name: room.getName() || 'Unnamed room',
    generatedAt: new Date().toISOString(),
    unit: 'cm',
    dimensions: {
      widthCm: round(room.getWidth()),
      depthCm: round(room.getDepth()),
      areaM2: round(room.getArea() / 10000, 2),
      areaFormatted: Dimensioning.cmSquaredToAreaMeasure(room.getArea())
    },
    floorTexture: floorplan.getFloorTexture(room.getUuid()),
    walls: wallsBoundingRoom(floorplan, room).map(serializeWall),
    items: items.map(serializeItem)
  }
}

/** Builds the reference JSON for the entire flat: every wall/room/item in the plan. */
export function buildFlatExportData(blueprint3d, floorplanName) {
  const floorplan = blueprint3d.model.floorplan
  const rooms = floorplan.getRooms()
  const size = floorplan.getSize()

  return {
    type: 'flat',
    name: floorplanName || 'Floorplan',
    generatedAt: new Date().toISOString(),
    unit: 'cm',
    dimensions: {
      widthCm: round(size.x),
      depthCm: round(size.z)
    },
    rooms: rooms.map((room) => ({
      name: room.getName() || 'Unnamed room',
      widthCm: round(room.getWidth()),
      depthCm: round(room.getDepth()),
      areaM2: round(room.getArea() / 10000, 2),
      floorTexture: floorplan.getFloorTexture(room.getUuid())
    })),
    walls: floorplan.getWalls().map(serializeWall),
    items: blueprint3d.model.scene.getItems().map(serializeItem)
  }
}
