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

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** Quantized coordinate key used to merge near-identical points (tolerance in meters). */
export function coordKey(x: number, z: number, tol = 1e-3): string {
  const qx = Math.round(x / tol)
  const qz = Math.round(z / tol)
  return `${qx}:${qz}`
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
