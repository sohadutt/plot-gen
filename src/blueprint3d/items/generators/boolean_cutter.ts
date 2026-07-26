import * as THREE from 'three'

export type BooleanCutterShape = 'cube' | 'cylinder'

export interface BooleanCutterParams {
  shape: BooleanCutterShape
  width: number
  height: number
  depth: number
}

export const BOOLEAN_CUTTER_DEFAULTS: BooleanCutterParams = {
  shape: 'cube',
  width: 90,
  height: 90,
  depth: 24
}

export const BOOLEAN_CUTTER_LIMITS = {
  width: { min: 10, max: 500 },
  height: { min: 10, max: 400 },
  depth: { min: 4, max: 120 }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clampBooleanCutterParams(params: Partial<BooleanCutterParams> = {}): BooleanCutterParams {
  const shape = params.shape === 'cylinder' ? 'cylinder' : 'cube'
  return {
    shape,
    width: clamp(params.width ?? BOOLEAN_CUTTER_DEFAULTS.width, BOOLEAN_CUTTER_LIMITS.width.min, BOOLEAN_CUTTER_LIMITS.width.max),
    height: clamp(params.height ?? BOOLEAN_CUTTER_DEFAULTS.height, BOOLEAN_CUTTER_LIMITS.height.min, BOOLEAN_CUTTER_LIMITS.height.max),
    depth: clamp(params.depth ?? BOOLEAN_CUTTER_DEFAULTS.depth, BOOLEAN_CUTTER_LIMITS.depth.min, BOOLEAN_CUTTER_LIMITS.depth.max)
  }
}

export function buildBooleanCutterGeometry(params: BooleanCutterParams): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry
  if (params.shape === 'cylinder') {
    const radius = 0.5
    geometry = new THREE.CylinderGeometry(radius, radius, 1, 48, 1, false)
    geometry.scale(params.width, params.depth, params.height)
    geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2))
  } else {
    geometry = new THREE.BoxGeometry(params.width, params.height, params.depth)
  }

  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function createBooleanCutterMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0e7490',
    opacity: 0,
    transparent: true,
    depthWrite: false
  })
}
