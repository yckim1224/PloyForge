import { describe, expect, test } from 'vitest'
import { detectFaces } from './faces'
import { parsePoly } from './parse'
import type { Point, Line } from '../types'
import { SAMPLES } from '../samples'

function ring(ids: string[]): Line[] {
  return ids.map((p0, i) => ({
    id: `s${i}`,
    p0,
    p1: ids[(i + 1) % ids.length],
    bdryFlag: 0,
  }))
}

describe('detectFaces', () => {
  test('a single closed square is one face', () => {
    const points: Point[] = [
      { id: 'a', x: 0, z: 0 },
      { id: 'b', x: 100, z: 0 },
      { id: 'c', x: 100, z: -100 },
      { id: 'd', x: 0, z: -100 },
    ]
    const faces = detectFaces(points, ring(['a', 'b', 'c', 'd']))
    expect(faces.length).toBe(1)
    expect(faces[0].pointIds.length).toBe(4)
    expect(faces[0].area).toBeCloseTo(10000, 3)
    // Centroid is the square center.
    expect(faces[0].centroid.x).toBeCloseTo(50, 3)
    expect(faces[0].centroid.z).toBeCloseTo(-50, 3)
  })

  test('two squares sharing an edge are two faces', () => {
    const points: Point[] = [
      { id: 'a', x: 0, z: 0 },
      { id: 'b', x: 100, z: 0 },
      { id: 'c', x: 200, z: 0 },
      { id: 'd', x: 200, z: -100 },
      { id: 'e', x: 100, z: -100 },
      { id: 'f', x: 0, z: -100 },
    ]
    const segments: Line[] = [
      { id: 's0', p0: 'a', p1: 'b', bdryFlag: 0 },
      { id: 's1', p0: 'b', p1: 'c', bdryFlag: 0 },
      { id: 's2', p0: 'c', p1: 'd', bdryFlag: 0 },
      { id: 's3', p0: 'd', p1: 'e', bdryFlag: 0 },
      { id: 's4', p0: 'e', p1: 'f', bdryFlag: 0 },
      { id: 's5', p0: 'f', p1: 'a', bdryFlag: 0 },
      { id: 's6', p0: 'b', p1: 'e', bdryFlag: 0 }, // shared edge
    ]
    const faces = detectFaces(points, segments)
    expect(faces.length).toBe(2)
  })

  test('an open path encloses no face', () => {
    const points: Point[] = [
      { id: 'a', x: 0, z: 0 },
      { id: 'b', x: 100, z: 0 },
      { id: 'c', x: 100, z: -100 },
    ]
    const segments: Line[] = [
      { id: 's0', p0: 'a', p1: 'b', bdryFlag: 0 },
      { id: 's1', p0: 'b', p1: 'c', bdryFlag: 0 },
    ]
    expect(detectFaces(points, segments)).toEqual([])
  })

  test('face ids are deterministic across recomputation', () => {
    const points: Point[] = [
      { id: 'a', x: 0, z: 0 },
      { id: 'b', x: 100, z: 0 },
      { id: 'c', x: 100, z: -100 },
      { id: 'd', x: 0, z: -100 },
    ]
    const segs = ring(['a', 'b', 'c', 'd'])
    expect(detectFaces(points, segs)[0].id).toBe(detectFaces(points, segs)[0].id)
  })

  test('rifting-2d sample encloses interior faces (>=4)', () => {
    const { doc } = parsePoly(SAMPLES.find((s) => s.id === 'rifting-2d')!.content)
    const faces = detectFaces(doc.points, doc.lines)
    // The rift cross-section has at least the 4 material regions as enclosed faces.
    expect(faces.length).toBeGreaterThanOrEqual(4)
  })
})
