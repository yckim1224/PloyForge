import type { Line, Point, PolyDocument } from '../types'
import { uid } from '../lib/id'
import { inferDomain } from '../lib/defaults'
import { detectFaces } from './faces'
import { pointInPolygon, type Vec2 } from '../lib/geometry'

export interface ParseResult {
  doc: PolyDocument
  warnings: string[]
  /** Unique sorted mattypes encountered in parsed region records. */
  discoveredMaterials: number[]
}

interface ParsedRegion {
  x: number
  z: number
  mattype: number
  size: number
}

/** Split into whitespace-token rows, stripping `#` comments and blank lines. */
function tokenizeRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const h = line.indexOf('#')
      return (h >= 0 ? line.slice(0, h) : line).trim()
    })
    .filter((l) => l.length > 0)
    .map((l) => l.split(/\s+/))
}

/**
 * Parse a DES3D 2D `.poly` (PSLG) file. Tolerant of comments, inline comments,
 * extra blank lines, and scientific notation. Returns the document plus warnings
 * and the mattypes discovered in region records (for settings hydration).
 */
export function parsePoly(text: string): ParseResult {
  const warnings: string[] = []
  const rows = tokenizeRows(text)
  let i = 0
  const next = (): string[] => {
    if (i >= rows.length) throw new Error(`Unexpected end of .poly at record ${i}`)
    return rows[i++]
  }

  // Node header: npoints ndims nattr nbdrym
  const nodeHeader = next()
  const npoints = parseInt(nodeHeader[0], 10)
  const ndims = parseInt(nodeHeader[1] ?? '2', 10)
  if (!Number.isFinite(npoints) || npoints < 0) {
    throw new Error('Invalid node count in .poly header')
  }
  if (ndims !== 2) {
    warnings.push(`Expected 2D (.poly ndims=2); got ndims=${ndims}. Reading x and z columns.`)
  }

  const points: Point[] = []
  const idByOrig = new Map<number, string>()
  for (let k = 0; k < npoints; k++) {
    const t = next()
    const orig = parseInt(t[0], 10)
    const x = parseFloat(t[1])
    const z = parseFloat(t[2]) // 2D: second coordinate is z (depth)
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      warnings.push(`Node ${t[0] ?? k} has non-numeric coordinates; skipped.`)
      continue
    }
    const id = uid('p')
    idByOrig.set(orig, id)
    points.push({ id, x, z })
  }

  // Segment header: nsegments has_bdryflag
  const segHeader = next()
  const nseg = parseInt(segHeader[0], 10)
  const hasFlag = parseInt(segHeader[1] ?? '0', 10)
  if (hasFlag !== 1) {
    warnings.push(`Segment header has_bdryflag=${hasFlag} (expected 1); missing flags treated as 0.`)
  }

  const lines: Line[] = []
  for (let k = 0; k < nseg; k++) {
    const t = next()
    // line: j p0 p1 [bdry_flag]
    const p0o = parseInt(t[1], 10)
    const p1o = parseInt(t[2], 10)
    const flag = t.length >= 4 ? parseInt(t[3], 10) : 0
    const p0 = idByOrig.get(p0o)
    const p1 = idByOrig.get(p1o)
    if (p0 === undefined || p1 === undefined) {
      warnings.push(`Segment ${k} references unknown node (${p0o} -> ${p1o}); skipped.`)
      continue
    }
    lines.push({ id: uid('s'), p0, p1, bdryFlag: Number.isFinite(flag) ? flag : 0 })
  }

  // Holes header (DES3D requires 0)
  const holeHeader = next()
  const nholes = parseInt(holeHeader[0], 10)
  if (Number.isFinite(nholes) && nholes !== 0) {
    warnings.push(`Holes must be 0 for DES3D; found ${nholes}. Hole records ignored.`)
    for (let k = 0; k < nholes; k++) {
      if (i < rows.length) next()
    }
  }

  // Regions (optional). Stored transiently for mapping into faceTypes below.
  const parsedRegions: ParsedRegion[] = []
  if (i < rows.length) {
    const regHeader = next()
    const nreg = parseInt(regHeader[0], 10)
    if (Number.isFinite(nreg) && nreg > 0) {
      for (let k = 0; k < nreg; k++) {
        if (i >= rows.length) {
          warnings.push('Region records truncated.')
          break
        }
        const t = next()
        // line: k xk zk mattype size
        const x = parseFloat(t[1])
        const z = parseFloat(t[2])
        if (!Number.isFinite(x) || !Number.isFinite(z)) {
          warnings.push(`Region ${t[0] ?? k} has non-numeric coordinates; skipped.`)
          continue
        }
        const mattype = parseInt(t[3], 10)
        const size = parseFloat(t[4])
        parsedRegions.push({
          x,
          z,
          mattype: Number.isFinite(mattype) ? mattype : 0,
          size: Number.isFinite(size) ? size : -1,
        })
      }
    }
  }

  // Map each parsed region onto a detected face via point-in-polygon. Regions
  // that match no face are dropped (with a warning); multiple regions inside
  // the same face -> last one wins (plus warning).
  const faces = detectFaces(points, lines)
  const pointById = new Map(points.map((p) => [p.id, p]))
  const faceVerts: Vec2[][] = faces.map((f) =>
    f.pointIds
      .map((pid) => pointById.get(pid))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ x: p.x, z: p.z })),
  )
  const faceTypes: PolyDocument['faceTypes'] = {}
  for (const r of parsedRegions) {
    let matchedIndex = -1
    for (let k = 0; k < faces.length; k++) {
      if (pointInPolygon({ x: r.x, z: r.z }, faceVerts[k])) {
        matchedIndex = k
        break
      }
    }
    if (matchedIndex < 0) {
      warnings.push(`Region @ (${r.x}, ${r.z}) is not inside any detected face; dropped.`)
      continue
    }
    const face = faces[matchedIndex]
    if (face.id in faceTypes) {
      warnings.push(
        `Multiple regions land in the same face (id=${face.id}); the last record (mattype=${r.mattype}) wins.`,
      )
    }
    faceTypes[face.id] = { mattype: r.mattype, size: r.size }
  }

  const discoveredMaterials = [...new Set(parsedRegions.map((r) => r.mattype))].sort(
    (a, b) => a - b,
  )

  const domain = inferDomain(points)
  return {
    doc: { domain, points, lines, faceTypes },
    warnings,
    discoveredMaterials,
  }
}
