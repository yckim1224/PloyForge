import { describe, expect, test } from 'vitest'
import { validateDocument } from './validate'
import { parsePoly } from './parse'
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
  return { points, lines, faceTypes: {} }
}

describe('validateDocument', () => {
  test('a valid sample has no errors', () => {
    const { doc } = parsePoly(SAMPLES.find((s) => s.id === 'rifting-2d')!.content)
    const issues = validateDocument(doc)
    expect(issues.filter((i) => i.level === 'error')).toEqual([])
  })

  test('errors when points exist but no closed face is detected', () => {
    const doc: PolyDocument = {
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

  const overlapErrors = (doc: PolyDocument) =>
    validateDocument(doc).filter((i) => i.level === 'error' && /overlap/.test(i.message))

  test('flags two points sharing coordinates as an error', () => {
    const doc: PolyDocument = {
      points: [
        { id: 'a', x: 0, z: 0 },
        { id: 'b', x: 0, z: 0 },
      ],
      lines: [],
      faceTypes: {},
    }
    expect(overlapErrors(doc)).toHaveLength(1)
  })

  test('a box with all-distinct points has no overlap error', () => {
    expect(overlapErrors(box())).toEqual([])
  })

  test('coincidence follows the coordKey cell, matching addPoint dedup', () => {
    // Same 1mm cell -> flagged.
    const same: PolyDocument = {
      points: [
        { id: 'a', x: 0, z: 0 },
        { id: 'b', x: 0.0004, z: 0 }, // rounds into the same cell as (0, 0)
      ],
      lines: [],
      faceTypes: {},
    }
    expect(overlapErrors(same)).toHaveLength(1)
    // Adjacent cell (1mm apart) -> not flagged.
    const apart: PolyDocument = {
      points: [
        { id: 'a', x: 0, z: 0 },
        { id: 'b', x: 0.001, z: 0 },
      ],
      lines: [],
      faceTypes: {},
    }
    expect(overlapErrors(apart)).toEqual([])
  })

  test('reports the duplicate and location counts for a triple coincidence', () => {
    const doc: PolyDocument = {
      points: [
        { id: 'a', x: 5, z: -5 },
        { id: 'b', x: 5, z: -5 },
        { id: 'c', x: 5, z: -5 },
      ],
      lines: [],
      faceTypes: {},
    }
    const [err] = overlapErrors(doc)
    expect(err.message).toMatch(/2 point\(s\) overlap another at 1 location\(s\)/)
  })
})
