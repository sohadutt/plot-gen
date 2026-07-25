import * as THREE from 'three'
import { Item } from './item'

/**
 * A FreeformItem sits on the ground plane like a FloorItem, but — unlike
 * FloorItem — isn't required to stay inside a room's interior polygon or
 * snap to walls. That's wrong for furniture, but right for things that
 * legitimately live outside rooms: stairs connecting levels, or ground
 * planes standing in for roads/terrain/land around a building.
 */
export abstract class FreeformItem extends Item {
  /** */
  public placeInRoom(): void {
    if (!this.position_set) {
      const center = this.model.floorplan.getCenter()
      this.position.x = center.x
      this.position.z = center.z
      this.position.y = this.halfSize.y
    }
  }

  /** Take action after a resize. */
  public resized(): void {
    this.position.y = this.halfSize.y
  }

  /** No room-containment or wall-snapping — just move it. */
  public moveToPosition(vec3: THREE.Vector3, _intersection: THREE.Intersection | null): void {
    vec3.y = this.position.y // stay level with the ground
    this.position.copy(vec3)
  }

  /** Always a valid position — nothing constrains where these can go. */
  public isValidPosition(_vec3: THREE.Vector3): boolean {
    return true
  }
}
