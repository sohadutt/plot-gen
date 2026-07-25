import * as THREE from 'three'
import { Model } from '../model/model'
import { FreeformItem } from './freeform_item'
import { Metadata } from './metadata'
import { buildStairsGeometry, clampStairsParams, StairsParams } from './generators/stairs'

/**
 * A modular staircase: width/rise/run are independently resizable, and the
 * step count is re-derived each time so steps stay a comfortable height
 * rather than just stretching a fixed number of them. Regeneration happens
 * in setScale() (which Item.resize() already funnels every resize through,
 * gizmo or numeric panel alike) rather than relying on THREE.js's built-in
 * mesh scale — a naive scale would squash/stretch the steps instead of
 * adding or removing them.
 */
export class StairsItem extends FreeformItem {
  private params: StairsParams

  constructor(
    model: Model,
    metadata: Metadata,
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    position?: THREE.Vector3,
    rotation?: number,
    scale?: THREE.Vector3
  ) {
    const params = clampStairsParams(metadata.stairsParams || {})
    // The passed-in `geometry` is a throwaway placeholder (see
    // Scene.addGeneratedItem) — stairs build their own from params instead
    // of loading a model file.
    void geometry
    const built = buildStairsGeometry(params)

    super(model, metadata, built, material, position, rotation, scale)

    this.params = params
    this.allowRotate = true
    this.receiveShadow = true
  }

  /** Rebuilds the step geometry for a new width/rise/run instead of
   * stretching the existing mesh. Item.resize(height, width, depth) already
   * computes x/y/z as ratios and calls this — height maps to totalRise,
   * depth to totalRun, matching how getHeight()/getDepth() read the mesh's
   * current bounding box. */
  public setScale(x: number, y: number, z: number): void {
    this.params = clampStairsParams({
      width: this.getWidth() * x,
      totalRise: this.getHeight() * y,
      totalRun: this.getDepth() * z,
      stepCount: this.params.stepCount
    })
    this.metadata.stairsParams = this.params
    this.regenerate()
  }

  private regenerate(): void {
    const oldGeometry = this.geometry
    this.geometry = buildStairsGeometry(this.params)
    oldGeometry.dispose()
    this.halfSize = this.objectHalfSize()
    this.resized()
    this.scene.needsUpdate = true
  }
}
