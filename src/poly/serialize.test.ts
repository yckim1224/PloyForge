import { describe, expect, test } from 'vitest'
import { serializePoly } from './serialize'
import { parsePoly } from './parse'
import { defaultDomain } from '../lib/defaults'
import type { PolyDocument } from '../types'

function makeDoc(): PolyDocument {
  return {
    domain: defaultDomain(),
    // Deliberately non-sequential, non-numeric ids to verify reindexing.
    points: [
      { id: 'pA', x: 0, z: 0 },
      { id: 'pB', x: 1000, z: 0 },
      { id: 'pC', x: 1000, z: -500 },
    ],
    segments: [
      { id: 's1', p0: 'pA', p1: 'pB', bdryFlag: 32 },
      { id: 's2', p0: 'pB', p1: 'pC', bdryFlag: 2 },
    ],
    regions: [{ id: 'r1', x: 500, z: -100, mattype: 0, size: -1 }],
    materials: [{ mattype: 0, color: '#60a5fa' }],
  }
}

describe('serializePoly', () => {
  test('emits the four DES3D sections with correct headers', () => {
    const out = serializePoly(makeDoc())
    expect(out).toContain('3 2 0 0') // npoints ndims 0 0
    expect(out).toContain('2 1') // nsegments has_bdryflag
    expect(out).toMatch(/#### holes ####\n0/)
    expect(out).toContain('#### regions ####')
    expect(out.endsWith('\n')).toBe(true)
  })

  test('reindexes points to contiguous 0-based integers and remaps segments', () => {
    const out = serializePoly(makeDoc())
    const { doc } = parsePoly(out)
    expect(doc.points.length).toBe(3)
    expect(doc.segments.length).toBe(2)
    // pA->0, pB->1, pC->2; so segment endpoints become (0,1) and (1,2).
    const coordsOf = (id: string) => {
      const p = doc.points.find((x) => x.id === id)!
      return { x: p.x, z: p.z }
    }
    expect(coordsOf(doc.segments[0].p0)).toEqual({ x: 0, z: 0 })
    expect(coordsOf(doc.segments[0].p1)).toEqual({ x: 1000, z: 0 })
  })

  test('drops self-loops and segments with dangling endpoints', () => {
    const doc = makeDoc()
    doc.segments.push({ id: 'bad1', p0: 'pA', p1: 'pA', bdryFlag: 0 })
    doc.segments.push({ id: 'bad2', p0: 'pA', p1: 'ghost', bdryFlag: 0 })
    const out = serializePoly(doc)
    // Still only the 2 valid segments.
    expect(out).toContain('2 1')
  })

  test('formats integers cleanly and avoids negative zero', () => {
    const doc = makeDoc()
    doc.points[0] = { id: 'pA', x: -0, z: 0 }
    const out = serializePoly(doc)
    expect(out).not.toContain('-0 ')
    expect(out).toContain('0 0 0') // node 0 at x=0 z=0
  })
})
