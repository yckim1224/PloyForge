import type { Point, Segment } from '../types'
import { snap } from '../lib/geometry'
import { screenToWorld, worldToScreen, type Viewport } from './viewport'

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

/**
 * Nearest point lying ON a segment (its projection) within `thresholdPx` screen
 * pixels, or null. Lets the user drop a point exactly on an edge so faces split.
 */
export function nearestSegmentPoint(
  segments: Segment[],
  points: Point[],
  vp: Viewport,
  sx: number,
  sy: number,
  thresholdPx: number,
): { x: number; z: number } | null {
  const byId = new Map(points.map((p) => [p.id, p]))
  let best: { x: number; z: number } | null = null
  let bestD = thresholdPx
  for (const s of segments) {
    const a = byId.get(s.p0)
    const b = byId.get(s.p1)
    if (!a || !b) continue
    const pa = worldToScreen(vp, a.x, a.z)
    const pb = worldToScreen(vp, b.x, b.z)
    const dx = pb.sx - pa.sx
    const dy = pb.sy - pa.sy
    const len2 = dx * dx + dy * dy
    if (len2 === 0) continue
    let t = ((sx - pa.sx) * dx + (sy - pa.sy) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const px = pa.sx + t * dx
    const py = pa.sy + t * dy
    const d = Math.hypot(sx - px, sy - py)
    if (d <= bestD) {
      bestD = d
      best = screenToWorld(vp, px, py)
    }
  }
  return best
}
