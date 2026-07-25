import * as THREE from 'three'
import { Model } from '../model/model'
import { FreeformItem } from './freeform_item'
import { Metadata } from './metadata'
import { buildGroundPlaneGeometry, clampGroundPlaneParams, GroundPlaneParams } from './generators/ground_plane'

const DEFAULT_COLOR = '#8ba888' // neutral land-green

/**
 * A flat, freely-resizable slab standing in for a road segment, yard, or
 * patch of terrain — placed and resized like any other item (including via
 * the drag gizmo), but not confined to a room's interior the way furniture
 * is, since roads and land legitimately sit outside rooms.
 */
export class GroundPlaneItem extends FreeformItem {
  private params: GroundPlaneParams

  constructor(
    model: Model,
    metadata: Metadata,
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    position?: THREE.Vector3,
    rotation?: number,
    scale?: THREE.Vector3
  ) {
    const params = clampGroundPlaneParams(metadata.groundPlaneParams || {})
    // The passed-in `geometry` is a throwaway placeholder (see
    // Scene.addGeneratedItem) — ground planes build their own from params.
    void geometry
    const built = buildGroundPlaneGeometry(params)
    const resolvedMaterial = GroundPlaneItem.applyColor(material, metadata.color)

    super(model, metadata, built, resolvedMaterial, position, rotation, scale)

    this.params = params
    this.allowRotate = true
    this.receiveShadow = true
  }

  private static applyColor(
    material: THREE.Material | THREE.Material[],
    color?: string
  ): THREE.Material | THREE.Material[] {
    const hex = color || DEFAULT_COLOR
    const materials = Array.isArray(material) ? material : [material]
    materials.forEach((mat) => {
      const colored = mat as THREE.Material & { color?: THREE.Color }
      colored.color?.set(hex)
    })
    return material
  }

  /** Swaps this plane's color (e.g. asphalt gray for a road, green for
   * land) without touching its size. */
  public setColor(hex: string): void {
    this.metadata.color = hex
    const materials = Array.isArray(this.material) ? this.material : [this.material]
    materials.forEach((mat) => {
      const colored = mat as THREE.Material & { color?: THREE.Color }
      colored.color?.set(hex)
    })
    this.scene.needsUpdate = true
  }

  /** Rebuilds the slab for a new width/depth instead of stretching it —
   * mainly to keep the (small, fixed) thickness visually consistent rather
   * than scaling it too, which non-uniform resizes would otherwise do. */
  public setScale(x: number, _y: number, z: number): void {
    this.params = clampGroundPlaneParams({
      width: this.getWidth() * x,
      depth: this.getDepth() * z,
      thickness: this.params.thickness
    })
    this.metadata.groundPlaneParams = this.params
    this.regenerate()
  }

  private regenerate(): void {
    const oldGeometry = this.geometry
    this.geometry = buildGroundPlaneGeometry(this.params)
    oldGeometry.dispose()
    this.halfSize = this.objectHalfSize()
    this.resized()
    this.scene.needsUpdate = true
  }
}
