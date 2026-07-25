import * as THREE from 'three'

export interface GroundPlaneParams {
  /** Left-right width, cm. */
  width: number
  /** Front-back depth, cm. */
  depth: number
  /** Slab thickness, cm — kept small and mostly cosmetic (avoids z-fighting
   * with the ground/floor while still catching a shadow edge). */
  thickness?: number
}

export const GROUND_PLANE_DEFAULTS: GroundPlaneParams = {
  width: 500,
  depth: 500,
  thickness: 2
}

export const GROUND_PLANE_LIMITS = {
  width: { min: 30, max: 5000 },
  depth: { min: 30, max: 5000 }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clampGroundPlaneParams(params: Partial<GroundPlaneParams>): GroundPlaneParams {
  return {
    width: clamp(params.width ?? GROUND_PLANE_DEFAULTS.width, GROUND_PLANE_LIMITS.width.min, GROUND_PLANE_LIMITS.width.max),
    depth: clamp(params.depth ?? GROUND_PLANE_DEFAULTS.depth, GROUND_PLANE_LIMITS.depth.min, GROUND_PLANE_LIMITS.depth.max),
    thickness: params.thickness && params.thickness > 0 ? params.thickness : GROUND_PLANE_DEFAULTS.thickness
  }
}

/** Default material — GroundPlaneItem's constructor tints this to
 * metadata.color (or the default land-green) right after creation. */
export function createDefaultGroundPlaneMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#8ba888',
    roughness: 1,
    metalness: 0
  })
}

/** A flat rectangular slab — stand-in for a road segment, yard, or patch of
 * terrain. Deliberately simple (a thin box, not a heightmapped terrain
 * mesh); width/depth are freely resizable via the same drag gizmo as any
 * other item. */
export function buildGroundPlaneGeometry(rawParams: Partial<GroundPlaneParams>): THREE.BufferGeometry {
  const { width, depth, thickness } = clampGroundPlaneParams(rawParams)
  const geometry = new THREE.BoxGeometry(width, thickness!, depth)
  geometry.translate(0, thickness! / 2, 0)
  return geometry
}
