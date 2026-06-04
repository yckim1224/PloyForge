import type { Face, Point, Segment } from '../types'
import { worldToScreen, type Viewport } from './viewport'

export interface ScreenRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export function normalizeRect(ax: number, ay: number, bx: number, by: number): ScreenRect {
  return {
    x0: Math.min(ax, bx),
    y0: Math.min(ay, by),
    x1: Math.max(ax, bx),
    y1: Math.max(ay, by),
  }
}

function inRect(r: ScreenRect, x: number, y: number): boolean {
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1
}

/** Liang–Barsky: does segment (x0,y0)-(x1,y1) intersect the axis-aligned rect? */
function segIntersectsRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: ScreenRect,
): boolean {
  if (inRect(r, x0, y0) || inRect(r, x1, y1)) return true
  const dx = x1 - x0
  const dy = y1 - y0
  const p = [-dx, dx, -dy, dy]
  const q = [x0 - r.x0, r.x1 - x0, y0 - r.y0, r.y1 - y0]
  let u1 = 0
  let u2 = 1
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false
    } else {
      const t = q[i] / p[i]
      if (p[i] < 0) {
        if (t > u2) return false
        if (t > u1) u1 = t
      } else {
        if (t < u1) return false
        if (t < u2) u2 = t
      }
    }
  }
  return u1 <= u2
}

export function pointsInRect(points: Point[], vp: Viewport, r: ScreenRect): string[] {
  const out: string[] = []
  for (const p of points) {
    const s = worldToScreen(vp, p.x, p.z)
    if (inRect(r, s.sx, s.sy)) out.push(p.id)
  }
  return out
}

export function segmentsInRect(
  points: Point[],
  segments: Segment[],
  vp: Viewport,
  r: ScreenRect,
): string[] {
  const byId = new Map(points.map((p) => [p.id, p]))
  const out: string[] = []
  for (const s of segments) {
    const a = byId.get(s.p0)
    const b = byId.get(s.p1)
    if (!a || !b) continue
    const pa = worldToScreen(vp, a.x, a.z)
    const pb = worldToScreen(vp, b.x, b.z)
    if (segIntersectsRect(pa.sx, pa.sy, pb.sx, pb.sy, r)) out.push(s.id)
  }
  return out
}

export function facesInRect(faces: Face[], vp: Viewport, r: ScreenRect): string[] {
  const out: string[] = []
  for (const f of faces) {
    const s = worldToScreen(vp, f.centroid.x, f.centroid.z)
    if (inRect(r, s.sx, s.sy)) out.push(f.id)
  }
  return out
}
