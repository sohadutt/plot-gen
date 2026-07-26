import * as THREE from 'three'
import { Model } from '../model/model'
import { InWallItem } from './in_wall_item'
import { Metadata } from './metadata'
import {
  BooleanCutterParams,
  buildBooleanCutterGeometry,
  clampBooleanCutterParams
} from './generators/boolean_cutter'

/**
 * Invisible wall-mounted boolean cutter. The mesh remains raycastable but
 * transparent; its wireframe appears while hovered or selected.
 */
export class BooleanWallItem extends InWallItem {
  private params: BooleanCutterParams
  private wireframe: THREE.LineSegments | null = null
  private hovering = false
  private selectedForWire = false

  constructor(
    model: Model,
    metadata: Metadata,
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    position?: THREE.Vector3,
    rotation?: number,
    scale?: THREE.Vector3
  ) {
    const params = clampBooleanCutterParams(metadata.booleanCutterParams || {})
    void geometry
    const built = buildBooleanCutterGeometry(params)

    super(model, metadata, built, material, position, rotation, scale)

    this.params = params
    this.allowRotate = false
    this.obstructFloorMoves = false
    this.castShadow = false
    this.receiveShadow = false
    this.metadata.boolean = true
    this.metadata.booleanCutterParams = params

    this.configureMaterial()
    this.rebuildWireframe()
  }

  public mouseOver(): void {
    this.hovering = true
    super.mouseOver()
    this.updateWireframeVisibility()
  }

  public mouseOff(): void {
    this.hovering = false
    super.mouseOff()
    this.updateWireframeVisibility()
  }

  public setSelected(): void {
    this.selectedForWire = true
    super.setSelected()
    this.updateWireframeVisibility()
  }

  public setUnselected(): void {
    this.selectedForWire = false
    super.setUnselected()
    this.updateWireframeVisibility()
  }

  public setScale(x: number, y: number, z: number): void {
    this.params = clampBooleanCutterParams({
      shape: this.params.shape,
      width: this.getWidth() * x,
      height: this.getHeight() * y,
      depth: this.getDepth() * z
    })
    this.metadata.booleanCutterParams = this.params
    this.regenerate()
  }

  public resizeToPoint(intersection: THREE.Intersection | null): void {
    if (!intersection || !this.currentWallEdge) return

    const point = intersection.point.clone().applyMatrix4(this.currentWallEdge.interiorTransform)
    const center = this.position.clone().applyMatrix4(this.currentWallEdge.interiorTransform)
    const width = Math.abs(point.x - center.x) * 2
    const height = Math.abs(point.y - center.y) * 2

    this.resize(height, width, this.getDepth())
  }

  public removed(): void {
    this.disposeWireframe()
    super.removed()
  }

  private configureMaterial(): void {
    const materials = Array.isArray(this.material) ? this.material : [this.material]
    materials.forEach((mat) => {
      mat.transparent = true
      mat.opacity = 0
      mat.depthWrite = false
      mat.side = THREE.DoubleSide
    })
  }

  private regenerate(): void {
    const oldGeometry = this.geometry
    this.disposeWireframe()
    this.geometry = buildBooleanCutterGeometry(this.params)
    oldGeometry.dispose()
    const boundingBox = this.geometry.boundingBox!
    this.halfSize = boundingBox.max.clone().sub(boundingBox.min).divideScalar(2)
    this.rebuildWireframe()
    this.resized()
    this.scene.needsUpdate = true
  }

  private rebuildWireframe(): void {
    this.disposeWireframe()
    const geometry = new THREE.EdgesGeometry(this.geometry)
    const material = new THREE.LineBasicMaterial({
      color: this.params.shape === 'cylinder' ? '#22c55e' : '#38bdf8',
      depthTest: false,
      transparent: true,
      opacity: 0.95
    })
    this.wireframe = new THREE.LineSegments(geometry, material)
    this.wireframe.renderOrder = 50
    this.add(this.wireframe)
    this.updateWireframeVisibility()
  }

  private disposeWireframe(): void {
    if (!this.wireframe) return
    this.remove(this.wireframe)
    this.wireframe.geometry.dispose()
    const material = this.wireframe.material
    if (Array.isArray(material)) {
      material.forEach((mat) => mat.dispose())
    } else {
      material.dispose()
    }
    this.wireframe = null
  }

  private updateWireframeVisibility(): void {
    if (this.wireframe) {
      this.wireframe.visible = this.hovering || this.selectedForWire
    }
  }
}
