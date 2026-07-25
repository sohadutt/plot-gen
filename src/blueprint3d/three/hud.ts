import * as THREE from 'three'
import type { Item } from '../items/item'
import type { Main } from './main'

/**
 * Drawings on "top" of the scene: the rotate arrow and (for resizable
 * items) 4 corner handles you can drag to resize the item's footprint.
 */
export class HUD {
  private readonly three: Main
  private readonly scene: THREE.Scene
  private selectedItem: Item | null = null
  private rotating = false
  private mouseover = false
  // @ts-ignore - tolerance is declared but not used, keeping for future use
  private readonly tolerance = 10
  private readonly height = 5
  private readonly distance = 20
  private readonly color = '#ffffff'
  private readonly hoverColor = '#f1c40f'
  private readonly resizeColor = '#2563eb'
  private activeObject: THREE.Object3D | null = null

  private resizing = false
  private resizeHover = false
  private resizeHandles: THREE.Mesh[] = []
  private rotateHandleParts: THREE.Object3D[] = []
  private readonly resizeHandlePad = 3 // cm, sits just outside the item's footprint

  // Mobile detection for larger touch targets
  private readonly isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  private readonly scaleFactor = this.isMobile ? 1.8 : 1.0 // Make 80% larger on mobile

  constructor(three: Main) {
    this.three = three
    this.scene = new THREE.Scene()
    this.init()
  }

  public getScene(): THREE.Scene {
    return this.scene
  }

  public getObject(): THREE.Object3D | null {
    return this.activeObject
  }

  /** The 4 corner resize handles of the current selection, for the
   * controller to raycast against separately from the rotate handle. */
  public getResizeHandles(): THREE.Mesh[] {
    return this.resizeHandles
  }

  /** The rotate handle's parts (line/cone/sphere), for the controller to
   * raycast against separately from the resize handles — both live under
   * the same parent object, so they can't be told apart via getObject(). */
  public getRotateHandleParts(): THREE.Object3D[] {
    return this.rotateHandleParts
  }

  private init(): void {
    this.three.itemSelectedCallbacks.add(this.itemSelected.bind(this))
    this.three.itemUnselectedCallbacks.add(this.itemUnselected.bind(this))
  }

  private resetSelectedItem(): void {
    this.selectedItem = null
    this.resizeHandles = []
    this.rotateHandleParts = []
    if (this.activeObject) {
      this.scene.remove(this.activeObject)
      this.activeObject = null
    }
  }

  private itemSelected(item: Item): void {
    if (this.selectedItem !== item) {
      this.resetSelectedItem()
      if ((item.allowRotate || item.metadata.resizable) && !item.fixed) {
        this.selectedItem = item
        this.activeObject = new THREE.Object3D()
        this.scene.add(this.activeObject)

        if (item.allowRotate) {
          this.rotateHandleParts = this.makeRotateHandleParts(item)
          this.rotateHandleParts.forEach((part) => this.activeObject!.add(part))
        }
        if (item.metadata.resizable) {
          this.resizeHandles = this.makeResizeHandles(item)
          this.resizeHandles.forEach((handle) => this.activeObject!.add(handle))
        }

        this.activeObject.rotation.y = item.rotation.y
        this.activeObject.position.x = item.position.x
        this.activeObject.position.z = item.position.z
        this.activeObject.position.y = this.height
      }
    }
  }

  private itemUnselected(): void {
    this.resetSelectedItem()
  }

  public setRotating(isRotating: boolean): void {
    this.rotating = isRotating
    this.setColor()
  }

  public setMouseover(isMousedOver: boolean): void {
    this.mouseover = isMousedOver
    this.setColor()
  }

  public setResizing(isResizing: boolean): void {
    this.resizing = isResizing
    this.setColor()
  }

  public setResizeHover(isHovered: boolean): void {
    this.resizeHover = isHovered
    this.setColor()
  }

  private setColor(): void {
    if (this.activeObject) {
      this.activeObject.children.forEach((obj) => {
        if (!(obj instanceof THREE.Mesh || obj instanceof THREE.Line)) return
        const material = obj.material as THREE.Material & { color?: THREE.Color }
        const color = obj.userData.hudPart === 'resize' ? this.getResizeColor() : this.getColor()
        material.color?.set(color)
      })
    }
    this.three.needsUpdate()
  }

  private getColor(): string {
    return this.mouseover || this.rotating ? this.hoverColor : this.color
  }

  private getResizeColor(): string {
    return this.resizeHover || this.resizing ? this.hoverColor : this.resizeColor
  }

  public update(): void {
    if (this.activeObject && this.selectedItem) {
      this.activeObject.rotation.y = this.selectedItem.rotation.y
      this.activeObject.position.x = this.selectedItem.position.x
      this.activeObject.position.z = this.selectedItem.position.z

      // Reposition resize handles every frame — the item's halfSize changes
      // live while dragging one, so a handle fixed at its creation-time
      // position would drift out of sync with the footprint it represents.
      const halfSize = this.selectedItem.halfSize
      this.resizeHandles.forEach((handle) => {
        const sign = handle.userData.cornerSign as { x: number; z: number }
        handle.position.set(
          sign.x * (halfSize.x + this.resizeHandlePad),
          0,
          sign.z * (halfSize.z + this.resizeHandlePad)
        )
      })
    }
  }

  private makeLineGeometry(item: Item): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()

    const rotVec = this.rotateVector(item)
    const positions = new Float32Array([0, 0, 0, rotVec.x, rotVec.y, rotVec.z])

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    return geometry
  }

  private rotateVector(item: Item): THREE.Vector3 {
    const vec = new THREE.Vector3(
      0,
      0,
      Math.max(item.halfSize.x, item.halfSize.z) + 1.4 + this.distance
    )
    return vec
  }

  private makeLineMaterial(): THREE.LineBasicMaterial {
    const mat = new THREE.LineBasicMaterial({
      color: this.getColor(),
      linewidth: 3
    })
    return mat
  }

  private makeCone(item: Item): THREE.Mesh {
    // Larger cone on mobile for easier touch interaction
    const coneRadius = 5 * this.scaleFactor
    const coneHeight = 10 * this.scaleFactor
    const coneGeo = new THREE.CylinderGeometry(coneRadius, 0, coneHeight)
    const coneMat = new THREE.MeshBasicMaterial({
      color: this.getColor()
    })
    const cone = new THREE.Mesh(coneGeo, coneMat)
    cone.position.copy(this.rotateVector(item))

    cone.rotation.x = -Math.PI / 2.0

    return cone
  }

  private makeSphere(): THREE.Mesh {
    // Larger sphere on mobile for easier touch interaction
    const sphereRadius = 4 * this.scaleFactor
    const geometry = new THREE.SphereGeometry(sphereRadius, 16, 16)
    const material = new THREE.MeshBasicMaterial({
      color: this.getColor()
    })
    const sphere = new THREE.Mesh(geometry, material)
    return sphere
  }

  private makeRotateHandleParts(item: Item): THREE.Object3D[] {
    const line = new THREE.Line(this.makeLineGeometry(item), this.makeLineMaterial())
    const cone = this.makeCone(item)
    const sphere = this.makeSphere()
    ;[line, cone, sphere].forEach((part) => (part.userData.hudPart = 'rotate'))
    return [line, cone, sphere]
  }

  /** 4 small cubes at the item's footprint corners — drag one to resize.
   * Positions are set here for the initial frame and then kept in sync by
   * update() every frame after (since halfSize changes while resizing). */
  private makeResizeHandles(item: Item): THREE.Mesh[] {
    const handleSize = 6 * this.scaleFactor
    const geometry = new THREE.BoxGeometry(handleSize, handleSize, handleSize)

    const corners: Array<{ x: number; z: number }> = [
      { x: 1, z: 1 },
      { x: 1, z: -1 },
      { x: -1, z: 1 },
      { x: -1, z: -1 }
    ]

    return corners.map(({ x, z }) => {
      const material = new THREE.MeshBasicMaterial({ color: this.getResizeColor() })
      const handle = new THREE.Mesh(geometry, material)
      handle.userData.hudPart = 'resize'
      handle.userData.cornerSign = { x, z }
      handle.position.set(
        x * (item.halfSize.x + this.resizeHandlePad),
        0,
        z * (item.halfSize.z + this.resizeHandlePad)
      )
      return handle
    })
  }
}
