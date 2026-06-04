import type { Material, Point, PolyDocument, Region, Segment } from '../types'
import { uid } from '../lib/id'
import { inferDomain } from '../lib/defaults'
import { materialColor } from '../constants/materials'

export interface ParseResult {
  doc: PolyDocument
  warnings: string[]
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

function inferMaterials(regions: Region[]): Material[] {
  const types = [...new Set(regions.map((r) => r.mattype))].sort((a, b) => a - b)
  return types.map((mattype) => ({ mattype, color: materialColor(mattype) }))
}

/**
 * Parse a DES3D 2D `.poly` (PSLG) file. Tolerant of comments, inline comments,
 * extra blank lines, and scientific notation. Returns the document plus warnings.
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

  const segments: Segment[] = []
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
    segments.push({ id: uid('s'), p0, p1, bdryFlag: Number.isFinite(flag) ? flag : 0 })
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

  // Regions (optional)
  const regions: Region[] = []
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
        const mattype = parseInt(t[3], 10)
        const size = parseFloat(t[4])
        regions.push({
          id: uid('r'),
          x,
          z,
          mattype: Number.isFinite(mattype) ? mattype : 0,
          size: Number.isFinite(size) ? size : -1,
        })
      }
    }
  }

  const domain = inferDomain(points)
  const materials = inferMaterials(regions)
  return { doc: { domain, points, segments, regions, materials }, warnings }
}
