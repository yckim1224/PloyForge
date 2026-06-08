import type { Point } from '../types'

/**
 * Viewport maps world coordinates (x in meters, z in meters with z<=0 downward)
 * to screen pixels. Surface (z=0) sits at originY; deeper z renders lower.
 */
export interface Viewport {
  /** Pixels per world meter. */
  scale: number
  /** Screen x (px) where world x = 0. */
  originX: number
  /** Screen y (px) where world z = 0. */
  originY: number
}

export interface WorldPoint {
  x: number
  z: number
}

export interface ScreenPoint {
  sx: number
  sy: number
}

const MIN_SCALE = 1e-7
const MAX_SCALE = 1e5

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

export function worldToScreen(v: Viewport, x: number, z: number): ScreenPoint {
  return { sx: v.originX + x * v.scale, sy: v.originY - z * v.scale }
}

export function screenToWorld(v: Viewport, sx: number, sy: number): WorldPoint {
  return { x: (sx - v.originX) / v.scale, z: (v.originY - sy) / v.scale }
}

export function panBy(v: Viewport, dxPx: number, dyPx: number): Viewport {
  return { ...v, originX: v.originX + dxPx, originY: v.originY + dyPx }
}

/**
 * Screen-pixel pan delta for an arrow key, where `(dirX, dirZ)` is the world
 * unit direction of the arrow (right = +x, up = +z). The arrow moves the camera
 * in that direction, so on-screen content shifts the opposite way on x and,
 * because screen y is inverted from world z, the same way as `dirZ` on y.
 */
export function arrowPanDelta(
  dirX: number,
  dirZ: number,
  stepPx: number,
): { dxPx: number; dyPx: number } {
  // `=== 0 ? 0` avoids returning a negative zero for the unused axis.
  return {
    dxPx: dirX === 0 ? 0 : -dirX * stepPx,
    dyPx: dirZ === 0 ? 0 : dirZ * stepPx,
  }
}

/** Zoom by `factor` keeping the world point under (sx, sy) fixed on screen. */
export function zoomAt(v: Viewport, factor: number, sx: number, sy: number): Viewport {
  const w = screenToWorld(v, sx, sy)
  const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
  return {
    scale,
    originX: sx - w.x * scale,
    originY: sy + w.z * scale,
  }
}

/** Fallback extent (meters) used by `fitPoints` when no points exist yet. */
const FALLBACK_HALF_EXTENT = 100_000

/**
 * Fit the bounding box of `points` within (width, height) with padding, centered.
 * Falls back to a 200km-wide square centered at the origin when `points` is empty.
 */
export function fitPoints(points: Point[], width: number, height: number, pad = 48): Viewport {
  let xmin: number
  let xmax: number
  let zmin: number
  let zmax: number
  if (points.length === 0) {
    xmin = -FALLBACK_HALF_EXTENT
    xmax = FALLBACK_HALF_EXTENT
    zmin = -FALLBACK_HALF_EXTENT
    zmax = FALLBACK_HALF_EXTENT
  } else {
    xmin = points[0].x
    xmax = xmin
    zmin = points[0].z
    zmax = zmin
    for (let i = 1; i < points.length; i++) {
      const p = points[i]
      if (p.x < xmin) xmin = p.x
      else if (p.x > xmax) xmax = p.x
      if (p.z < zmin) zmin = p.z
      else if (p.z > zmax) zmax = p.z
    }
  }
  const dw = xmax - xmin || 1
  const dh = zmax - zmin || 1
  const sx = (width - 2 * pad) / dw
  const sy = (height - 2 * pad) / dh
  const scale = clamp(Math.min(sx, sy) || 1, MIN_SCALE, MAX_SCALE)
  const cx = (xmin + xmax) / 2
  const cz = (zmin + zmax) / 2
  return {
    scale,
    originX: width / 2 - cx * scale,
    originY: height / 2 + cz * scale,
  }
}
