import { describe, expect, test } from 'vitest'
import { validateDocument } from './validate'
import { parsePoly } from './parse'
import { defaultDomain } from '../lib/defaults'
import type { PolyDocument } from '../types'
import { SAMPLES } from '../samples'

function box(): PolyDocument {
  const points = [
    { id: 'a', x: 0, z: 0 },
    { id: 'b', x: 100, z: 0 },
    { id: 'c', x: 100, z: -100 },
    { id: 'd', x: 0, z: -100 },
  ]
  const segments = [
    { id: 's0', p0: 'a', p1: 'b', bdryFlag: 32 },
    { id: 's1', p0: 'b', p1: 'c', bdryFlag: 2 },
    { id: 's2', p0: 'c', p1: 'd', bdryFlag: 16 },
    { id: 's3', p0: 'd', p1: 'a', bdryFlag: 1 },
  ]
  return { domain: defaultDomain(), points, segments, regions: [], materials: [] }
}

describe('validateDocument', () => {
  test('a valid sample has no errors', () => {
    const { doc } = parsePoly(SAMPLES.find((s) => s.id === 'rifting-2d')!.content)
    const issues = validateDocument(doc)
    expect(issues.filter((i) => i.level === 'error')).toEqual([])
  })

  test('errors when there are no regions (DES3D requires nregions >= 1)', () => {
    const doc = box() // regions: []
    const issues = validateDocument(doc)
    expect(issues.some((i) => i.level === 'error' && /nregions/.test(i.message))).toBe(true)
  })

  test('flags a non-single-bit boundary flag as an error', () => {
    const doc = box()
    doc.segments[0].bdryFlag = 3 // 1|2, two bits
    const issues = validateDocument(doc)
    expect(issues.some((i) => i.level === 'error' && /single-bit/.test(i.message))).toBe(true)
  })

  test('warns when a region seed is outside every face', () => {
    const doc = box()
    doc.regions = [{ id: 'r', x: 999, z: 999, mattype: 0, size: -1 }]
    const issues = validateDocument(doc)
    expect(issues.some((i) => i.level === 'warning' && /not inside/.test(i.message))).toBe(true)
  })

  test('accepts a region seed inside the box', () => {
    const doc = box()
    doc.regions = [{ id: 'r', x: 50, z: -50, mattype: 0, size: -1 }]
    const issues = validateDocument(doc)
    expect(issues.some((i) => /not inside/.test(i.message))).toBe(false)
  })

  test('warns on crossing segments', () => {
    const doc: PolyDocument = {
      domain: defaultDomain(),
      points: [
        { id: 'a', x: 0, z: 0 },
        { id: 'b', x: 100, z: -100 },
        { id: 'c', x: 0, z: -100 },
        { id: 'd', x: 100, z: 0 },
      ],
      segments: [
        { id: 's0', p0: 'a', p1: 'b', bdryFlag: 0 }, // diagonal
        { id: 's1', p0: 'c', p1: 'd', bdryFlag: 0 }, // crossing diagonal
      ],
      regions: [],
      materials: [],
    }
    expect(validateDocument(doc).some((i) => /cross/.test(i.message))).toBe(true)
  })
})
