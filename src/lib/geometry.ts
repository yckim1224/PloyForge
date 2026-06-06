// Planar geometry helpers operating in world coordinates (x, z).
// turf.area assumes geographic coordinates, so we compute planar area ourselves.

export interface Vec2 {
  x: number
  z: number
}

/** Signed polygon area via the shoelace formula (positive = counter-clockwise). */
export function shoelaceArea(pts: Vec2[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    a += p.x * q.z - q.x * p.z
  }
  return a / 2
}

export function polygonArea(pts: Vec2[]): number {
  return Math.abs(shoelaceArea(pts))
}

/** Area-weighted polygon centroid; falls back to vertex average when degenerate. */
export function polygonCentroid(pts: Vec2[]): Vec2 {
  let a = 0
  let cx = 0
  let cz = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    const cross = p.x * q.z - q.x * p.z
    a += cross
    cx += (p.x + q.x) * cross
    cz += (p.z + q.z) * cross
  }
  a /= 2
  if (Math.abs(a) < 1e-12) {
    const n = pts.length || 1
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / n,
      z: pts.reduce((s, p) => s + p.z, 0) / n,
    }
  }
  return { x: cx / (6 * a), z: cz / (6 * a) }
}

/**
 * A point guaranteed to lie inside the polygon. Uses the area centroid when it
 * falls inside (the common convex case); otherwise picks the midpoint of the
 * widest interior span on the scanline through the centroid, so concave faces
 * still get a seed that is actually inside them.
 */
export function interiorPoint(verts: Vec2[]): Vec2 {
  const c = polygonCentroid(verts)
  if (pointInPolygon(c, verts)) return c
  const z = c.z
  const xs: number[] = []
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const zi = verts[i].z
    const zj = verts[j].z
    if (zi > z !== zj > z) {
      xs.push(verts[i].x + ((z - zi) / (zj - zi)) * (verts[j].x - verts[i].x))
    }
  }
  xs.sort((a, b) => a - b)
  let best = c
  let bestWidth = -1
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const width = xs[k + 1] - xs[k]
    if (width > bestWidth) {
      bestWidth = width
      best = { x: (xs[k] + xs[k + 1]) / 2, z }
    }
  }
  return best
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(pt: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const zi = poly[i].z
    const xj = poly[j].x
    const zj = poly[j].z
    const intersect =
      zi > pt.z !== zj > pt.z &&
      pt.x < ((xj - xi) * (pt.z - zi)) / (zj - zi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Snap a value to the nearest multiple of `spacing` (relative to `origin`). */
export function snap(value: number, spacing: number, origin = 0): number {
  if (spacing <= 0) return value
  return origin + Math.round((value - origin) / spacing) * spacing
}

/** Closest point on segment a-b to p, with perpendicular distance and parameter t in [0,1]. */
export function projectToSegment(
  p: Vec2,
  a: Vec2,
  b: Vec2,
): { point: Vec2; dist: number; t: number } {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz
  if (len2 === 0) {
    return { point: { x: a.x, z: a.z }, dist: Math.hypot(p.x - a.x, p.z - a.z), t: 0 }
  }
  let t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2
  t = Math.max(0, Math.min(1, t))
  const point = { x: a.x + t * dx, z: a.z + t * dz }
  return { point, dist: Math.hypot(p.x - point.x, p.z - point.z), t }
}

/** True if p lies on the interior of segment a-b (within eps, excluding endpoints). */
export function pointOnSegment(p: Vec2, a: Vec2, b: Vec2, eps = 1e-6): boolean {
  const { dist, t } = projectToSegment(p, a, b)
  return dist <= eps && t > 1e-9 && t < 1 - 1e-9
}

/** Quantized coordinate key used to merge near-identical points (tolerance in meters). */
export function coordKey(x: number, z: number, tol = 1e-3): string {
  const qx = Math.round(x / tol)
  const qz = Math.round(z / tol)
  return `${qx}:${qz}`
}

/**
 * Strict proper intersection of two segments. Returns the intersection
 * point in world coordinates, or null when the segments are parallel,
 * colinear, only touch at a shared endpoint, or only kiss at an endpoint
 * lying on the other segment's interior (the latter case is a T-junction
 * that the existing renode pass handles).
 */
export function segmentIntersection(
  a0: Vec2,
  a1: Vec2,
  b0: Vec2,
  b1: Vec2,
): Vec2 | null {
  const dx1 = a1.x - a0.x
  const dz1 = a1.z - a0.z
  const dx2 = b1.x - b0.x
  const dz2 = b1.z - b0.z
  const denom = dx1 * dz2 - dz1 * dx2
  if (denom === 0) return null
  const ex = b0.x - a0.x
  const ez = b0.z - a0.z
  const t = (ex * dz2 - ez * dx2) / denom
  const u = (ex * dz1 - ez * dx1) / denom
  const EPS = 1e-9
  if (t <= EPS || t >= 1 - EPS) return null
  if (u <= EPS || u >= 1 - EPS) return null
  return { x: a0.x + t * dx1, z: a0.z + t * dz1 }
}

/** Round to a "nice" 1/2/5 x 10^k step. */
export function niceStep(v: number): number {
  if (!(v > 0)) return 1
  const exp = Math.floor(Math.log10(v))
  const base = Math.pow(10, exp)
  const f = v / base
  const nf = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10
  return nf * base
}
