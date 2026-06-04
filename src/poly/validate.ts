import type { PolyDocument } from '../types'
import { isSingleBitFlag } from './boundary'
import { detectFaces } from './faces'
import { pointInPolygon, type Vec2 } from '../lib/geometry'

export interface ValidationIssue {
  level: 'error' | 'warning'
  message: string
}

function orient(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
}

/** Do segments a0-a1 and b0-b1 cross in their interiors (proper intersection)? */
function properlyCross(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): boolean {
  const d1 = orient(a0, a1, b0)
  const d2 = orient(a0, a1, b1)
  const d3 = orient(b0, b1, a0)
  const d4 = orient(b0, b1, a1)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/**
 * Validate a document against DES3D `.poly` reader expectations.
 * Returns errors (would break meshing) and warnings (likely mistakes).
 */
export function validateDocument(doc: PolyDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const byId = new Map(doc.points.map((p) => [p.id, p]))

  if (doc.points.length === 0) issues.push({ level: 'warning', message: 'No points defined.' })
  if (doc.segments.length === 0)
    issues.push({ level: 'warning', message: 'No segments defined.' })

  // Boundary flags must be a single bit; endpoints must be valid; no self-loops.
  for (const s of doc.segments) {
    if (!isSingleBitFlag(s.bdryFlag)) {
      issues.push({
        level: 'error',
        message: `Segment has a non-single-bit boundary flag (${s.bdryFlag}). DES3D rejects combined flags.`,
      })
    }
    if (!byId.has(s.p0) || !byId.has(s.p1)) {
      issues.push({ level: 'error', message: 'A segment references a missing point.' })
    } else if (s.p0 === s.p1) {
      issues.push({ level: 'error', message: 'A segment is a self-loop.' })
    }
  }

  // Region material types must be non-negative.
  for (const r of doc.regions) {
    if (r.mattype < 0 || !Number.isInteger(r.mattype)) {
      issues.push({
        level: 'error',
        message: `Region mattype must be a non-negative integer (got ${r.mattype}).`,
      })
    }
  }

  // Each region seed should fall inside a closed face.
  const faces = detectFaces(doc.points, doc.segments)
  const faceVerts = faces.map((f) =>
    f.pointIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ x: p.x, z: p.z })),
  )
  for (const r of doc.regions) {
    const inside = faceVerts.some((verts) => pointInPolygon({ x: r.x, z: r.z }, verts))
    if (!inside) {
      issues.push({
        level: 'warning',
        message: `Region seed (${r.x}, ${r.z}) is not inside any closed face; TetGen/Triangle may misassign it.`,
      })
    }
  }

  // Crossing internal segments break polygonize and confuse meshing.
  const segs = doc.segments
    .map((s) => {
      const a = byId.get(s.p0)
      const b = byId.get(s.p1)
      return a && b ? { id: s.id, p0: s.p0, p1: s.p1, a, b } : null
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
  let crossings = 0
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s1 = segs[i]
      const s2 = segs[j]
      // Skip segments that share an endpoint (they meet, not cross).
      if (s1.p0 === s2.p0 || s1.p0 === s2.p1 || s1.p1 === s2.p0 || s1.p1 === s2.p1) continue
      if (properlyCross(s1.a, s1.b, s2.a, s2.b)) crossings++
    }
  }
  if (crossings > 0) {
    issues.push({
      level: 'warning',
      message: `${crossings} pair(s) of segments cross. Split them at intersections so faces are detected correctly.`,
    })
  }

  return issues
}
