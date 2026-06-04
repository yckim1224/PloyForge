import type { Point } from '../types'
import { snap } from '../lib/geometry'
import { worldToScreen, type Viewport } from './viewport'

/** Snap a world coordinate to the nearest grid intersection (multiples of spacing from 0). */
export function snapWorld(x: number, z: number, spacing: number) {
  return { x: snap(x, spacing, 0), z: snap(z, spacing, 0) }
}

/** Nearest existing point within `thresholdPx` screen pixels of (sx, sy), or null. */
export function nearestPoint(
  points: Point[],
  vp: Viewport,
  sx: number,
  sy: number,
  thresholdPx: number,
): Point | null {
  let best: Point | null = null
  let bestD = thresholdPx
  for (const p of points) {
    const s = worldToScreen(vp, p.x, p.z)
    const d = Math.hypot(s.sx - sx, s.sy - sy)
    if (d <= bestD) {
      bestD = d
      best = p
    }
  }
  return best
}
