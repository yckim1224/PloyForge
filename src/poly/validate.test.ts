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
  const lines = [
    { id: 's0', p0: 'a', p1: 'b', bdryFlag: 32 },
    { id: 's1', p0: 'b', p1: 'c', bdryFlag: 2 },
    { id: 's2', p0: 'c', p1: 'd', bdryFlag: 16 },
    { id: 's3', p0: 'd', p1: 'a', bdryFlag: 1 },
  ]
  return { domain: defaultDomain(), points, lines, faceTypes: {} }
}

describe('validateDocument', () => {
  test('a valid sample has no errors', () => {
    const { doc } = parsePoly(SAMPLES.find((s) => s.id === 'rifting-2d')!.content)
    const issues = validateDocument(doc)
    expect(issues.filter((i) => i.level === 'error')).toEqual([])
  })

  test('errors when points exist but no closed face is detected', () => {
    const doc: PolyDocument = {
      domain: defaultDomain(),
      // Two-point open line cannot form a face.
      points: [
        { id: 'a', x: 0, z: 0 },
        { id: 'b', x: 100, z: 0 },
      ],
      lines: [{ id: 's0', p0: 'a', p1: 'b', bdryFlag: 0 }],
      faceTypes: {},
    }
    const issues = validateDocument(doc)
    expect(issues.some((i) => i.level === 'error' && /No closed face/.test(i.message))).toBe(true)
  })

  test('does not error on an empty document', () => {
    const doc: PolyDocument = {
      domain: defaultDomain(),
      points: [],
      lines: [],
      faceTypes: {},
    }
    const issues = validateDocument(doc)
    // Only warnings about empty points/lines; no errors.
    expect(issues.filter((i) => i.level === 'error')).toEqual([])
  })

  test('flags a non-single-bit boundary flag as an error', () => {
    const doc = box()
    doc.lines[0].bdryFlag = 3 // 1|2, two bits
    const issues = validateDocument(doc)
    expect(issues.some((i) => i.level === 'error' && /single-bit/.test(i.message))).toBe(true)
  })

  test('a closed box (with a detectable face) has no errors', () => {
    const doc = box()
    const issues = validateDocument(doc)
    expect(issues.filter((i) => i.level === 'error')).toEqual([])
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
      lines: [
        { id: 's0', p0: 'a', p1: 'b', bdryFlag: 0 }, // diagonal
        { id: 's1', p0: 'c', p1: 'd', bdryFlag: 0 }, // crossing diagonal
      ],
      faceTypes: {},
    }
    expect(validateDocument(doc).some((i) => /cross/.test(i.message))).toBe(true)
  })
})
