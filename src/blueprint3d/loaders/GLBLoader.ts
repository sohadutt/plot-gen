import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

export class GLBLoader {
  private loader: GLTFLoader
  private dracoLoader: DRACOLoader
  private manager: THREE.LoadingManager

  constructor(manager?: THREE.LoadingManager) {
    this.manager = manager || THREE.DefaultLoadingManager
    this.dracoLoader = new DRACOLoader(this.manager)
    this.dracoLoader.setDecoderPath('/draco/')
    this.loader = new GLTFLoader(this.manager)
    this.loader.setDRACOLoader(this.dracoLoader)
  }

  load(
    url: string,
    onLoad: (geometry: THREE.BufferGeometry, materials: THREE.Material[]) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: Error) => void
  ): void {
    this.manager.itemStart(url)

    this.loader.load(
      url,
      (gltf) => {
        try {
          const { geometry, materials } = this.extractGeometryAndMaterials(gltf)
          onLoad(geometry, materials)
          this.manager.itemEnd(url)
        } catch (e) {
          console.error(e)
          if (onError) onError(e as Error)
          this.manager.itemError(url)
          this.manager.itemEnd(url)
        }
      },
      onProgress as (event: ProgressEvent<EventTarget>) => void,
      (error: unknown) => {
        console.error(error)
        if (onError) onError(error instanceof Error ? error : new Error(String(error)))
        this.manager.itemError(url)
        this.manager.itemEnd(url)
      }
    )
  }

  private extractGeometryAndMaterials(gltf: { scene: THREE.Group }): {
    geometry: THREE.BufferGeometry
    materials: THREE.Material[]
  } {
    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []
    const materialMap = new Map<THREE.Material, number>()

    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mesh = child
        const geom = mesh.geometry.clone()
        
        mesh.updateWorldMatrix(true, false)
        geom.applyMatrix4(mesh.matrixWorld)

        const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

        if (geom.groups.length === 0) {
          const matIndex = this.getOrAddMaterial(meshMaterials[0], materials, materialMap)
          geom.addGroup(0, geom.index ? geom.index.count : geom.attributes.position.count, matIndex)
        } else {
          for (const group of geom.groups) {
            const originalMat = meshMaterials[group.materialIndex || 0]
            group.materialIndex = this.getOrAddMaterial(originalMat, materials, materialMap)
          }
        }

        geometries.push(geom)
      }
    })

    if (geometries.length === 0) {
      throw new Error('No meshes found in GLB file')
    }

    const mergedGeometry = geometries.length === 1 ? geometries[0] : this.mergeGeometries(geometries)

    mergedGeometry.scale(100, 100, 100)
    mergedGeometry.computeBoundingBox()
    mergedGeometry.computeBoundingSphere()

    const processedMaterials = materials.map((mat) => {
      if (mat instanceof THREE.MeshStandardMaterial) {
        return new THREE.MeshPhongMaterial({
          color: mat.color,
          map: mat.map || null,
          normalMap: mat.normalMap || null,
          emissive: mat.emissive,
          emissiveMap: mat.emissiveMap || null,
          emissiveIntensity: mat.emissiveIntensity,
          specular: new THREE.Color(0x222222),
          shininess: 5,
          side: THREE.DoubleSide,
          transparent: mat.transparent,
          opacity: mat.opacity,
          alphaTest: mat.alphaTest
        })
      }

      mat.side = THREE.DoubleSide
      mat.depthTest = true
      mat.depthWrite = true
      return mat
    })

    return { geometry: mergedGeometry, materials: processedMaterials }
  }

  private getOrAddMaterial(
    material: THREE.Material,
    materials: THREE.Material[],
    materialMap: Map<THREE.Material, number>
  ): number {
    if (materialMap.has(material)) {
      return materialMap.get(material)!
    }
    const index = materials.length
    materials.push(material)
    materialMap.set(material, index)
    return index
  }

  private mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const merged = new THREE.BufferGeometry()
    let vertexCount = 0
    let indexCount = 0

    for (const geom of geometries) {
      vertexCount += geom.attributes.position.count
      indexCount += geom.index ? geom.index.count : geom.attributes.position.count
    }

    const positions = new Float32Array(vertexCount * 3)
    const normals = new Float32Array(vertexCount * 3)
    const uvs = new Float32Array(vertexCount * 2)
    const indices = new Uint32Array(indexCount)
    const groups: { start: number; count: number; materialIndex: number }[] = []

    let vOffset = 0
    let iOffset = 0
    let hasNormals = false
    let hasUvs = false

    for (const geom of geometries) {
      const pAttr = geom.attributes.position
      const nAttr = geom.attributes.normal
      const uAttr = geom.attributes.uv
      const vCount = pAttr.count

      positions.set(pAttr.array, vOffset * 3)

      if (nAttr) {
        normals.set(nAttr.array, vOffset * 3)
        hasNormals = true
      }

      if (uAttr) {
        uvs.set(uAttr.array, vOffset * 2)
        hasUvs = true
      }

      const geomIndexCount = geom.index ? geom.index.count : vCount

      if (geom.index) {
        for (let i = 0; i < geomIndexCount; i++) {
          indices[iOffset + i] = geom.index.getX(i) + vOffset
        }
      } else {
        for (let i = 0; i < geomIndexCount; i++) {
          indices[iOffset + i] = vOffset + i
        }
      }

      for (const group of geom.groups) {
        groups.push({
          start: group.start + iOffset,
          count: group.count,
          materialIndex: group.materialIndex || 0
        })
      }

      vOffset += vCount
      iOffset += geomIndexCount
    }

    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    if (hasNormals) merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    if (hasUvs) merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    merged.setIndex(new THREE.BufferAttribute(indices, 1))

    for (const group of groups) {
      merged.addGroup(group.start, group.count, group.materialIndex)
    }

    return merged
  }

  dispose(): void {
    this.dracoLoader.dispose()
  }
}