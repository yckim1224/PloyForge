import type { PolyDocument } from '../types'
import { isSingleBitFlag } from './boundary'
import { detectFaces } from './faces'
import type { Vec2 } from '../lib/geometry'

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
 *
 * Note: mattype validation now happens at write-time via `setFaceType`
 * (mattype lives in the `faceTypes` map, not on a standalone region record).
 */
export function validateDocument(doc: PolyDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const byId = new Map(doc.points.map((p) => [p.id, p]))

  if (doc.points.length === 0) issues.push({ level: 'warning', message: 'No points defined.' })
  if (doc.lines.length === 0)
    issues.push({ level: 'warning', message: 'No segments defined.' })

  // Boundary flags must be a single bit; endpoints must be valid; no self-loops.
  for (const s of doc.lines) {
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

  // DES3D fatally rejects nregions <= 0; serialize emits one region per detected
  // face, so a document with points but no closed face would write nregions=0.
  const faces = detectFaces(doc.points, doc.lines)
  if (doc.points.length > 0 && faces.length === 0) {
    issues.push({
      level: 'error',
      message:
        'No closed face detected. Draw at least one closed loop with segments so DES3D has a region to mesh.',
    })
  }

  // Crossing internal segments break polygonize and confuse meshing.
  const segs = doc.lines
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
