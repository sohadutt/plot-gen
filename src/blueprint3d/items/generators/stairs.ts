import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export interface StairsParams {
  /** Left-right width of the stairs, cm. */
  width: number
  /** Total vertical height climbed, cm. */
  totalRise: number
  /** Total horizontal depth covered, cm. */
  totalRun: number
  /** Explicit step count. Omit to derive one from a comfortable step height. */
  stepCount?: number
}

export const STAIRS_DEFAULTS: StairsParams = {
  width: 100,
  totalRise: 260, // a typical single-story floor-to-floor height
  totalRun: 300
}

export const STAIRS_LIMITS = {
  width: { min: 60, max: 400 },
  totalRise: { min: 30, max: 600 },
  totalRun: { min: 60, max: 800 }
}

// Comfortable residential step height (~7") — used to derive a step count
// when one isn't given explicitly, per common stair-building rule of thumb.
const IDEAL_STEP_HEIGHT_CM = 17.5

export function computeStepCount(totalRise: number, requested?: number): number {
  if (requested && requested > 0) return Math.max(1, Math.round(requested))
  return Math.max(1, Math.round(totalRise / IDEAL_STEP_HEIGHT_CM))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clampStairsParams(params: Partial<StairsParams>): StairsParams {
  return {
    width: clamp(params.width ?? STAIRS_DEFAULTS.width, STAIRS_LIMITS.width.min, STAIRS_LIMITS.width.max),
    totalRise: clamp(
      params.totalRise ?? STAIRS_DEFAULTS.totalRise,
      STAIRS_LIMITS.totalRise.min,
      STAIRS_LIMITS.totalRise.max
    ),
    totalRun: clamp(
      params.totalRun ?? STAIRS_DEFAULTS.totalRun,
      STAIRS_LIMITS.totalRun.min,
      STAIRS_LIMITS.totalRun.max
    ),
    stepCount: params.stepCount
  }
}

/** A plain wood-toned default — stairs aren't wired into the Texture
 * catalog (v1 scope), just a sensible PBR material out of the box. */
export function createDefaultStairsMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#a67c52',
    roughness: 0.8,
    metalness: 0.05
  })
}

/**
 * Builds a staircase as a stack of merged boxes, one per step — each box
 * runs from the ground up to that step's tread height, and out to that
 * step's depth, so the exposed silhouette reads as a proper staircase
 * (each riser + tread pair is one box's front-top edge). Centered on the
 * origin in X (width) and starting at z=0 climbing toward +z, y=0 up to
 * totalRise, matching how Item centers geometry on construction.
 */
export function buildStairsGeometry(rawParams: Partial<StairsParams>): THREE.BufferGeometry {
  const params = clampStairsParams(rawParams)
  const { width, totalRise, totalRun } = params
  const stepCount = computeStepCount(totalRise, params.stepCount)
  const stepHeight = totalRise / stepCount
  const stepDepth = totalRun / stepCount

  const boxes: THREE.BufferGeometry[] = []
  for (let i = 0; i < stepCount; i++) {
    const boxHeight = (i + 1) * stepHeight
    const boxDepth = (i + 1) * stepDepth
    const box = new THREE.BoxGeometry(width, boxHeight, boxDepth)
    // BoxGeometry is centered on its own origin — shift so the bottom sits
    // at y=0 and the front face sits at z=0 (steps stack away from the
    // approach direction, toward +z).
    box.translate(0, boxHeight / 2, boxDepth / 2)
    boxes.push(box)
  }

  const merged = mergeGeometries(boxes, false)
  if (!merged) {
    // Merge failing (mismatched attributes, empty input) shouldn't be
    // possible here since every box comes from the same BoxGeometry
    // constructor, but fall back to a single flat slab rather than crash.
    const fallback = new THREE.BoxGeometry(width, totalRise, totalRun)
    fallback.translate(0, totalRise / 2, totalRun / 2)
    return fallback
  }
  merged.computeVertexNormals()
  return merged
}
