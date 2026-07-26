import type { Item } from './item'
import type { Model } from '../model/model'
import type { Metadata } from './metadata'
import * as THREE from 'three'
import { CornerItem } from './corner_item'
import { FloorItem } from './floor_item'
import { InWallFloorItem } from './in_wall_floor_item'
import { InWallItem } from './in_wall_item'
import { OnFloorItem } from './on_floor_item'
import { WallFloorItem } from './wall_floor_item'
import { WallItem } from './wall_item'
import { StairsItem } from './stairs_item'
import { GroundPlaneItem } from './ground_plane_item'
import { BooleanWallItem } from './boolean_wall_item'

/** Item constructor type */
type ItemConstructor = new (
  model: Model,
  metadata: Metadata,
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  position?: THREE.Vector3,
  rotation?: number,
  scale?: THREE.Vector3
) => Item

/** Item types built procedurally from metadata params rather than loaded
 * from a model file — see Scene.addGeneratedItem. */
export const STAIRS_ITEM_TYPE = 11
export const GROUND_PLANE_ITEM_TYPE = 12
export const BOOLEAN_CUBE_ITEM_TYPE = 13
export const BOOLEAN_CYLINDER_ITEM_TYPE = 14
const GENERATED_ITEM_TYPES = new Set([
  STAIRS_ITEM_TYPE,
  GROUND_PLANE_ITEM_TYPE,
  BOOLEAN_CUBE_ITEM_TYPE,
  BOOLEAN_CYLINDER_ITEM_TYPE
])

/** Enumeration of item types. */
const item_types: Record<number, ItemConstructor> = {
  1: FloorItem as any, // FloorItem is abstract
  2: WallItem as any, // WallItem is abstract
  3: InWallItem,
  7: InWallFloorItem,
  8: OnFloorItem,
  9: WallFloorItem,
  10: CornerItem,
  // Procedurally-generated items (built from metadata params rather than a
  // loaded model file) — see Scene.addGeneratedItem.
  [STAIRS_ITEM_TYPE]: StairsItem,
  [GROUND_PLANE_ITEM_TYPE]: GroundPlaneItem,
  [BOOLEAN_CUBE_ITEM_TYPE]: BooleanWallItem,
  [BOOLEAN_CYLINDER_ITEM_TYPE]: BooleanWallItem
}

/** Factory class to create items. */
export class Factory {
  /** Gets the class for the specified item. */
  public static getClass(itemType: number): ItemConstructor {
    return item_types[itemType]
  }

  /** Whether this item type is built procedurally (no model file to load). */
  public static isGenerated(itemType: number): boolean {
    return GENERATED_ITEM_TYPES.has(itemType)
  }
}
