import { describe, expect, test } from 'vitest'
import { parsePoly } from './parse'
import { isSingleBitFlag } from './boundary'
import { SAMPLES } from '../samples'

function sample(id: string): string {
  const s = SAMPLES.find((x) => x.id === id)
  if (!s) throw new Error(`sample ${id} not found`)
  return s.content
}

describe('parsePoly — known sample structure', () => {
  test('rifting-2d: 13 points, 16 segments, 4 regions', () => {
    const { doc, warnings } = parsePoly(sample('rifting-2d'))
    expect(doc.points.length).toBe(13)
    expect(doc.segments.length).toBe(16)
    expect(doc.regions.length).toBe(4)
    expect(warnings).toEqual([])
    // First node is the origin (0, 0).
    expect(doc.points[0]).toMatchObject({ x: 0, z: 0 })
    // Node 1 is at z = -35 km (from "-35.0e3").
    expect(doc.points[1]).toMatchObject({ x: 0, z: -35000 })
    // Region 0: seed (250e3, -20e3), mattype 0, size 2e7.
    expect(doc.regions[0]).toMatchObject({ x: 250000, z: -20000, mattype: 0, size: 20000000 })
  })

  test('test-three-layer: 8 / 10 / 3', () => {
    const { doc } = parsePoly(sample('test-three-layer'))
    expect(doc.points.length).toBe(8)
    expect(doc.segments.length).toBe(10)
    expect(doc.regions.length).toBe(3)
    // Material types present: 1, 2, 3.
    expect(doc.regions.map((r) => r.mattype).sort()).toEqual([1, 2, 3])
  })

  test('terrigenous: 14 / 17 / 4', () => {
    const { doc } = parsePoly(sample('terrigenous'))
    expect(doc.points.length).toBe(14)
    expect(doc.segments.length).toBe(17)
    expect(doc.regions.length).toBe(4)
  })

  test('rsf-long-strike: 12 / 16 / 5', () => {
    const { doc } = parsePoly(sample('rsf-long-strike'))
    expect(doc.points.length).toBe(12)
    expect(doc.segments.length).toBe(16)
    expect(doc.regions.length).toBe(5)
  })

  test('static-terrig: 17 / 20 / 2', () => {
    const { doc } = parsePoly(sample('static-terrig'))
    expect(doc.points.length).toBe(17)
    expect(doc.segments.length).toBe(20)
    expect(doc.regions.length).toBe(2)
  })

  test('sedimentary-basin: 12 / 16, regions read per header count (4)', () => {
    const { doc } = parsePoly(sample('sedimentary-basin'))
    expect(doc.points.length).toBe(12)
    expect(doc.segments.length).toBe(16)
    // Header declares 4 regions even though 5 lines follow; we read exactly 4 (like DES3D).
    expect(doc.regions.length).toBe(4)
  })
})

describe('parsePoly — invariants across all samples', () => {
  test('every segment has a single-bit boundary flag', () => {
    for (const s of SAMPLES) {
      const { doc } = parsePoly(s.content)
      for (const seg of doc.segments) {
        expect(isSingleBitFlag(seg.bdryFlag), `${s.id} flag ${seg.bdryFlag}`).toBe(true)
      }
    }
  })

  test('materials are inferred from region mattypes', () => {
    const { doc } = parsePoly(sample('rifting-2d'))
    expect(doc.materials.map((m) => m.mattype)).toEqual([0, 1])
    expect(doc.materials.every((m) => typeof m.color === 'string')).toBe(true)
  })

  test('inferred domain bounds enclose all points', () => {
    const { doc } = parsePoly(sample('rifting-2d'))
    for (const p of doc.points) {
      expect(p.x).toBeGreaterThanOrEqual(doc.domain.xmin)
      expect(p.x).toBeLessThanOrEqual(doc.domain.xmax)
      expect(p.z).toBeGreaterThanOrEqual(doc.domain.zmin)
      expect(p.z).toBeLessThanOrEqual(doc.domain.zmax)
    }
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
    expect(doc.segments.length).toBe(1)
    expect(doc.segments[0].bdryFlag).toBe(1)
    expect(doc.regions.length).toBe(0)
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
