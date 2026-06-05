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

export function pointsInRect(points: Point[], vp: Viewport, r: ScreenRect): string[] {
  const out: string[] = []
  for (const p of points) {
    const s = worldToScreen(vp, p.x, p.z)
    if (inRect(r, s.sx, s.sy)) out.push(p.id)
  }
  return out
}

/** A segment is selected only when BOTH endpoints are inside the rect (full containment). */
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
    if (inRect(r, pa.sx, pa.sy) && inRect(r, pb.sx, pb.sy)) out.push(s.id)
  }
  return out
}

/** A face is selected only when ALL of its vertices are inside the rect (full containment). */
export function facesInRect(
  faces: Face[],
  points: Point[],
  vp: Viewport,
  r: ScreenRect,
): string[] {
  const byId = new Map(points.map((p) => [p.id, p]))
  const out: string[] = []
  for (const f of faces) {
    if (f.pointIds.length === 0) continue
    const allInside = f.pointIds.every((pid) => {
      const p = byId.get(pid)
      if (!p) return false
      const s = worldToScreen(vp, p.x, p.z)
      return inRect(r, s.sx, s.sy)
    })
    if (allInside) out.push(f.id)
  }
  return out
}
