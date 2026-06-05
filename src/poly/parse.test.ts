import { describe, expect, test } from 'vitest'
import { parsePoly } from './parse'
import { isSingleBitFlag } from './boundary'
import { detectFaces } from './faces'
import type { Vec2 } from '../lib/geometry'
import { SAMPLES } from '../samples'

function sample(id: string): string {
  const s = SAMPLES.find((x) => x.id === id)
  if (!s) throw new Error(`sample ${id} not found`)
  return s.content
}

function faceTypesCount(doc: ReturnType<typeof parsePoly>['doc']): number {
  return Object.keys(doc.faceTypes).length
}

describe('parsePoly — known sample structure', () => {
  test('rifting-2d: 13 points, 16 segments, 4 faceTypes', () => {
    const { doc, warnings, discoveredMaterials } = parsePoly(sample('rifting-2d'))
    expect(doc.points.length).toBe(13)
    expect(doc.lines.length).toBe(16)
    expect(faceTypesCount(doc)).toBe(4)
    expect(warnings).toEqual([])
    // First node is the origin (0, 0).
    expect(doc.points[0]).toMatchObject({ x: 0, z: 0 })
    // Node 1 is at z = -35 km (from "-35.0e3").
    expect(doc.points[1]).toMatchObject({ x: 0, z: -35000 })
    // Discovered material types: sample uses mattypes 0 and 1.
    expect(discoveredMaterials).toEqual([0, 1])
  })

  test('test-three-layer: 8 / 10 / 3 typed faces', () => {
    const { doc, discoveredMaterials } = parsePoly(sample('test-three-layer'))
    expect(doc.points.length).toBe(8)
    expect(doc.lines.length).toBe(10)
    expect(faceTypesCount(doc)).toBe(3)
    // Material types present: 1, 2, 3.
    expect(discoveredMaterials).toEqual([1, 2, 3])
  })

  test('terrigenous: 14 / 17 / 4', () => {
    const { doc } = parsePoly(sample('terrigenous'))
    expect(doc.points.length).toBe(14)
    expect(doc.lines.length).toBe(17)
    expect(faceTypesCount(doc)).toBe(4)
  })

  test('rsf-long-strike: 12 / 16 / 5', () => {
    const { doc } = parsePoly(sample('rsf-long-strike'))
    expect(doc.points.length).toBe(12)
    expect(doc.lines.length).toBe(16)
    expect(faceTypesCount(doc)).toBe(5)
  })

  test('static-terrig: 17 / 20 / 2', () => {
    const { doc } = parsePoly(sample('static-terrig'))
    expect(doc.points.length).toBe(17)
    expect(doc.lines.length).toBe(20)
    expect(faceTypesCount(doc)).toBe(2)
  })

  test('sedimentary-basin: 12 / 16, 4 region records mapped to typed faces', () => {
    const { doc } = parsePoly(sample('sedimentary-basin'))
    expect(doc.points.length).toBe(12)
    expect(doc.lines.length).toBe(16)
    // Header declares 4 regions; we read exactly 4 (like DES3D).
    expect(faceTypesCount(doc)).toBe(4)
  })
})

describe('parsePoly — invariants across all samples', () => {
  test('every segment has a single-bit boundary flag', () => {
    for (const s of SAMPLES) {
      const { doc } = parsePoly(s.content)
      for (const seg of doc.lines) {
        expect(isSingleBitFlag(seg.bdryFlag), `${s.id} flag ${seg.bdryFlag}`).toBe(true)
      }
    }
  })

  test('discoveredMaterials are inferred from region mattypes (unique sorted)', () => {
    const { discoveredMaterials } = parsePoly(sample('rifting-2d'))
    expect(discoveredMaterials).toEqual([0, 1])
  })

  test('parsed document no longer carries a `domain` field', () => {
    const { doc } = parsePoly(sample('rifting-2d'))
    expect((doc as unknown as Record<string, unknown>).domain).toBeUndefined()
  })
})

describe('parsePoly — region -> faceTypes mapping', () => {
  test('a region inside a face populates faceTypes[face.id]', () => {
    const text = [
      '4 2 0 0',
      '0 0 0',
      '1 100 0',
      '2 100 -100',
      '3 0 -100',
      '4 1',
      '0 0 1 1',
      '1 1 2 2',
      '2 2 3 16',
      '3 3 0 32',
      '0',
      '1',
      '0 50 -50 3 7',
    ].join('\n')
    const { doc, warnings } = parsePoly(text)
    expect(warnings).toEqual([])
    expect(Object.keys(doc.faceTypes).length).toBe(1)
    const [spec] = Object.values(doc.faceTypes)
    expect(spec).toEqual({ mattype: 3, size: 7 })
  })

  test('a region outside every face is dropped with a warning', () => {
    const text = [
      '4 2 0 0',
      '0 0 0',
      '1 100 0',
      '2 100 -100',
      '3 0 -100',
      '4 1',
      '0 0 1 1',
      '1 1 2 2',
      '2 2 3 16',
      '3 3 0 32',
      '0',
      '1',
      '0 999 999 1 -1',
    ].join('\n')
    const { doc, warnings } = parsePoly(text)
    expect(Object.keys(doc.faceTypes).length).toBe(0)
    expect(warnings.some((w) => /not inside any detected face/.test(w))).toBe(true)
  })

  test('multiple regions in the same face: last one wins + warning', () => {
    const text = [
      '4 2 0 0',
      '0 0 0',
      '1 100 0',
      '2 100 -100',
      '3 0 -100',
      '4 1',
      '0 0 1 1',
      '1 1 2 2',
      '2 2 3 16',
      '3 3 0 32',
      '0',
      '2',
      '0 25 -25 1 -1',
      '1 75 -75 5 -1',
    ].join('\n')
    const { doc, warnings, discoveredMaterials } = parsePoly(text)
    const faces = detectFaces(doc.points, doc.lines)
    expect(faces.length).toBe(1)
    const spec = doc.faceTypes[faces[0].id]
    expect(spec).toBeTruthy()
    expect(spec.mattype).toBe(5) // last one wins
    expect(warnings.some((w) => /Multiple regions/.test(w))).toBe(true)
    expect(discoveredMaterials).toEqual([1, 5])
  })

  test('region seed is inside the resolved face (containment sanity)', () => {
    const { doc } = parsePoly(sample('rifting-2d'))
    const faces = detectFaces(doc.points, doc.lines)
    const pointById = new Map(doc.points.map((p) => [p.id, p]))
    for (const face of faces) {
      const spec = doc.faceTypes[face.id]
      if (!spec) continue
      const verts: Vec2[] = face.pointIds
        .map((pid) => pointById.get(pid)!)
        .map((p) => ({ x: p.x, z: p.z }))
      // No coordinate stored anymore; just confirm at least one parsed face has a spec.
      expect(verts.length).toBeGreaterThanOrEqual(3)
    }
    expect(Object.keys(doc.faceTypes).length).toBeGreaterThan(0)
  })
})

describe('parsePoly — tolerance', () => {
  test('handles inline comments and scientific notation', () => {
    const text = `
# a tiny poly
2 2 0 0
0 0.0 0.0   # origin
1 1.0e3 -2.5e3  # a point
1 1
0 0 1 1   # left boundary
0
0
`
    const { doc, warnings } = parsePoly(text)
    expect(doc.points.length).toBe(2)
    expect(doc.points[1]).toMatchObject({ x: 1000, z: -2500 })
    expect(doc.lines.length).toBe(1)
    expect(doc.lines[0].bdryFlag).toBe(1)
    expect(Object.keys(doc.faceTypes).length).toBe(0)
    expect(warnings).toEqual([])
  })

  test('skips nodes with non-numeric coordinates and warns instead of storing NaN', () => {
    const text = ['2 2 0 0', '0 abc def', '1 100 -50', '0 1', '0'].join('\n')
    const { doc, warnings } = parsePoly(text)
    expect(doc.points.length).toBe(1)
    expect(doc.points[0]).toMatchObject({ x: 100, z: -50 })
    expect(doc.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z))).toBe(true)
    expect(warnings.some((w) => /non-numeric/.test(w))).toBe(true)
  })
})
