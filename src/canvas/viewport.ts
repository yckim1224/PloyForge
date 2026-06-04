import type { Domain } from '../types'

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

/** Fit the domain extent within (width, height) with padding, centered. */
export function fitDomain(domain: Domain, width: number, height: number, pad = 48): Viewport {
  const dw = domain.xmax - domain.xmin || 1
  const dh = domain.zmax - domain.zmin || 1
  const sx = (width - 2 * pad) / dw
  const sy = (height - 2 * pad) / dh
  const scale = clamp(Math.min(sx, sy) || 1, MIN_SCALE, MAX_SCALE)
  const cx = (domain.xmin + domain.xmax) / 2
  const cz = (domain.zmin + domain.zmax) / 2
  return {
    scale,
    originX: width / 2 - cx * scale,
    originY: height / 2 + cz * scale,
  }
}
