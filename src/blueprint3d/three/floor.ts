import * as THREE from 'three'
import type { Room } from '../model/room'

export class Floor {
  public readonly room: Room
  private readonly scene: THREE.Scene
  private readonly renderer: THREE.WebGLRenderer
  private floorPlane: THREE.Mesh | null = null
  // @ts-ignore - roofPlane is declared but not used, keeping for future use
  private roofPlane: THREE.Mesh | null = null

  private readonly baseColor = 0xffffff
  private readonly hoverColor = 0xdce8fb

  constructor(scene: THREE.Scene, room: Room, renderer: THREE.WebGLRenderer) {
    this.scene = scene
    this.room = room
    this.renderer = renderer
    this.init()
  }

  /** Tints the floor material on hover, restoring it on hover-off — a lightweight visual
   * cue that doesn't require a separate outline mesh. */
  public setHighlighted(on: boolean): void {
    const material = this.floorPlane?.material as THREE.MeshPhongMaterial | undefined
    material?.color.setHex(on ? this.hoverColor : this.baseColor)
  }

  private init(): void {
    this.room.fireOnFloorChange(this.redraw.bind(this))
    this.floorPlane = this.buildFloor()
    // roofs look weird, so commented out
    // this.roofPlane = this.buildRoof();
  }

  private redraw(): void {
    this.removeFromScene()
    this.floorPlane = this.buildFloor()
    this.addToScene()
  }

  private buildFloor(): THREE.Mesh {
    const textureSettings = this.room.getTexture()
    const shininess = textureSettings.glossy !== undefined ? Math.round(textureSettings.glossy * 100) : 3

    let floorMaterialTop: THREE.MeshPhongMaterial

    if (textureSettings.isColor) {
      // Flat solid color — no image texture to load or tile.
      floorMaterialTop = new THREE.MeshPhongMaterial({
        side: THREE.DoubleSide,
        color: new THREE.Color(textureSettings.color || '#cccccc'),
        specular: 0x111111,
        shininess
      })
    } else {
      // setup texture
      const textureLoader = new THREE.TextureLoader()
      const floorTexture = textureLoader.load(textureSettings.url)
      floorTexture.wrapS = THREE.RepeatWrapping
      floorTexture.wrapT = THREE.RepeatWrapping
      floorTexture.repeat.set(1, 1)
      floorTexture.colorSpace = THREE.SRGBColorSpace
      // Apply anisotropic filtering for sharper textures at angles
      floorTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
      floorTexture.minFilter = THREE.LinearMipmapLinearFilter
      floorTexture.magFilter = THREE.LinearFilter
      floorMaterialTop = new THREE.MeshPhongMaterial({
        map: floorTexture,
        side: THREE.DoubleSide,
        // ambient: 0xffffff, TODO_Ekki
        color: 0xffffff, // Changed from 0xcccccc to 0xffffff for brighter floor
        specular: 0x111111,  // Very subtle specular to avoid moiré
        shininess  // Defaults to 3 (very matte) unless the texture specifies glossy
      })
    }

    const textureScale = textureSettings.scale || 300
    // http://stackoverflow.com/questions/19182298/how-to-texture-a-three-js-mesh-created-with-shapegeometry
    // scale down coords to fit 0 -> 1, then rescale

    const points: THREE.Vector2[] = []
    this.room.interiorCorners.forEach((corner) => {
      points.push(new THREE.Vector2(corner.x / textureScale, corner.y / textureScale))
    })
    const shape = new THREE.Shape(points)

    const geometry = new THREE.ShapeGeometry(shape)

    const floor = new THREE.Mesh(geometry, floorMaterialTop)

    floor.rotation.set(Math.PI / 2, 0, 0)
    floor.scale.set(textureScale, textureScale, textureScale)
    floor.receiveShadow = true
    floor.castShadow = false
    return floor
  }

  // @ts-ignore - buildRoof is declared but not used, keeping for future use
  private buildRoof(): THREE.Mesh {
    // setup texture
    const roofMaterial = new THREE.MeshBasicMaterial({
      side: THREE.FrontSide,
      color: 0xe5e5e5
    })

    const points: THREE.Vector2[] = []
    this.room.interiorCorners.forEach((corner) => {
      points.push(new THREE.Vector2(corner.x, corner.y))
    })
    const shape = new THREE.Shape(points)
    const geometry = new THREE.ShapeGeometry(shape)
    const roof = new THREE.Mesh(geometry, roofMaterial)

    roof.rotation.set(Math.PI / 2, 0, 0)
    roof.position.y = 250
    return roof
  }

  public addToScene(): void {
    if (this.floorPlane) {
      this.scene.add(this.floorPlane)
    }
    // if (this.roofPlane) {
    //   this.scene.add(this.roofPlane);
    // }
    // hack so we can do intersect testing
    this.scene.add(this.room.floorPlane)
  }

  public removeFromScene(): void {
    if (this.floorPlane) {
      this.scene.remove(this.floorPlane)
    }
    // if (this.roofPlane) {
    //   this.scene.remove(this.roofPlane);
    // }
    this.scene.remove(this.room.floorPlane)
  }
}
