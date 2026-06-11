import type { Point, Line } from '../types'
import { snap } from '../lib/geometry'
import { screenToWorld, worldToScreen, type Viewport } from './viewport'

/** Snap a world coordinate to the nearest grid intersection (multiples of spacing from 0). */
export function snapWorld(x: number, z: number, spacing: number) {
  return { x: snap(x, spacing, 0), z: snap(z, spacing, 0) }
}

/**
 * Snap to the nearest grid intersection only when the cursor sits within
 * `thresholdPx` screen pixels of one. Returns null when the cursor is closer
 * to mid-cell, so callers can defer to line-interior snap before falling back
 * to unconditional grid snap.
 */
export function nearestGridIntersection(
  vp: Viewport,
  sx: number,
  sy: number,
  spacing: number,
  thresholdPx: number,
): { x: number; z: number } | null {
  if (spacing <= 0) return null
  const w = screenToWorld(vp, sx, sy)
  const gx = snap(w.x, spacing, 0)
  const gz = snap(w.z, spacing, 0)
  const s = worldToScreen(vp, gx, gz)
  const d = Math.hypot(s.sx - sx, s.sy - sy)
  if (d > thresholdPx) return null
  return { x: gx, z: gz }
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
 * Resolve a click/hover screen position to a target world coordinate using the
 * point-placement snap priority:
 *   1. an existing vertex within thresholdPx (lets the cursor adopt that point's id),
 *   2. a grid intersection within thresholdPx (so a grid+line crossing lands on grid),
 *   3. a projection onto an existing line within thresholdPx (places on the edge),
 *   4. a free grid snap (always rounds to the nearest intersection).
 * altKey bypasses every snap stage and returns the raw cursor world position.
 */
export function snapPointTarget(
  points: Point[],
  lines: Line[],
  vp: Viewport,
  sx: number,
  sy: number,
  gridSpacing: number,
  thresholdPx: number,
  altKey: boolean,
): { x: number; z: number; existingId?: string } {
  if (altKey) {
    const w = screenToWorld(vp, sx, sy)
    return { x: w.x, z: w.z }
  }
  const vertex = nearestPoint(points, vp, sx, sy, thresholdPx)
  if (vertex) return { x: vertex.x, z: vertex.z, existingId: vertex.id }
  const onGrid = nearestGridIntersection(vp, sx, sy, gridSpacing, thresholdPx)
  if (onGrid) return onGrid
  const onSeg = nearestLinePoint(lines, points, vp, sx, sy, thresholdPx)
  if (onSeg) return onSeg
  const w = screenToWorld(vp, sx, sy)
  return snapWorld(w.x, w.z, gridSpacing)
}

/**
 * Nearest point lying ON a line (its projection) within `thresholdPx` screen
 * pixels, or null. Lets the user drop a point exactly on an edge so faces split.
 */
export function nearestLinePoint(
  lines: Line[],
  points: Point[],
  vp: Viewport,
  sx: number,
  sy: number,
  thresholdPx: number,
): { x: number; z: number } | null {
  const byId = new Map(points.map((p) => [p.id, p]))
  let best: { x: number; z: number } | null = null
  let bestD = thresholdPx
  for (const s of lines) {
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
