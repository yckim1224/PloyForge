import { polygonize } from '@turf/polygonize'
import { featureCollection, lineString } from '@turf/helpers'
import type { Face, Point, Segment } from '../types'
import { coordKey, polygonArea, polygonCentroid, type Vec2 } from '../lib/geometry'

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Detect closed faces enclosed by the segment graph using turf's polygonize.
 * Faces get a deterministic id (from their sorted point set) so selection and
 * region association survive recomputation. Requires endpoint-noded segments
 * (guaranteed here because segments share point ids / identical coordinates).
 */
export function detectFaces(points: Point[], segments: Segment[]): Face[] {
  const byId = new Map(points.map((p) => [p.id, p]))
  const lines = []
  for (const s of segments) {
    const a = byId.get(s.p0)
    const b = byId.get(s.p1)
    if (!a || !b || (a.x === b.x && a.z === b.z)) continue
    lines.push(
      lineString([
        [a.x, a.z],
        [b.x, b.z],
      ]),
    )
  }
  if (lines.length < 3) return []

  let collection
  try {
    collection = polygonize(featureCollection(lines))
  } catch {
    return []
  }

  const coordToId = new Map<string, string>()
  for (const p of points) coordToId.set(coordKey(p.x, p.z), p.id)
  const segByPair = new Map<string, string>()
  for (const s of segments) segByPair.set(pairKey(s.p0, s.p1), s.id)

  const faces: Face[] = []
  const seen = new Set<string>()
  for (const feature of collection.features) {
    const ring = feature.geometry.coordinates[0] as number[][]
    const coords = ring.slice(0, -1) // drop the closing duplicate vertex
    const verts: Vec2[] = coords.map(([x, z]) => ({ x, z }))
    const pointIds: string[] = []
    for (const [x, z] of coords) {
      const id = coordToId.get(coordKey(x, z))
      if (id) pointIds.push(id)
    }
    if (pointIds.length < 3) continue

    const id = `face:${[...pointIds].sort().join(',')}`
    if (seen.has(id)) continue
    seen.add(id)

    const segmentIds: string[] = []
    for (let i = 0; i < pointIds.length; i++) {
      const sid = segByPair.get(pairKey(pointIds[i], pointIds[(i + 1) % pointIds.length]))
      if (sid) segmentIds.push(sid)
    }
    const c = polygonCentroid(verts)
    faces.push({
      id,
      pointIds,
      segmentIds,
      centroid: { x: c.x, z: c.z },
      area: polygonArea(verts),
    })
  }
  return faces
}
