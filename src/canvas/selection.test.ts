import { describe, expect, test } from 'vitest'
import { facesInRect, linesInRect, normalizeRect, pointsInRect } from './selection'
import type { Face, Line, Point } from '../types'

// 1px per meter, z down: world (x,z) -> screen (x, -z)
const vp = { scale: 1, originX: 0, originY: 0 }

const points: Point[] = [
  { id: 'a', x: 10, z: -10 }, // screen (10, 10)
  { id: 'b', x: 200, z: -10 }, // screen (200, 10)
  { id: 'c', x: 10, z: -200 }, // screen (10, 200)
]

describe('normalizeRect', () => {
  test('orders corners', () => {
    expect(normalizeRect(50, 60, 10, 20)).toEqual({ x0: 10, y0: 20, x1: 50, y1: 60 })
  })
})

describe('pointsInRect', () => {
  test('selects only points inside the rect', () => {
    const r = normalizeRect(0, 0, 100, 100) // covers screen (10,10) only
    expect(pointsInRect(points, vp, r)).toEqual(['a'])
  })
})

describe('linesInRect (full containment)', () => {
  // points: a(10,10) b(200,10) c(10,200) in screen space.
  const lines: Line[] = [
    { id: 'ab', p0: 'a', p1: 'b', bdryFlag: 0 },
    { id: 'ac', p0: 'a', p1: 'c', bdryFlag: 0 },
  ]
  test('selects a line only when BOTH endpoints are inside', () => {
    const r = normalizeRect(0, 0, 210, 20) // covers a and b, not c
    expect(linesInRect(points, lines, vp, r)).toEqual(['ab'])
  })
  test('does NOT select a line that merely crosses the rect', () => {
    const r = normalizeRect(100, 0, 150, 50) // crosses ab but no endpoint inside
    expect(linesInRect(points, lines, vp, r)).toEqual([])
  })
  test('ignores lines fully outside', () => {
    const r = normalizeRect(300, 300, 400, 400)
    expect(linesInRect(points, lines, vp, r)).toEqual([])
  })
})

describe('facesInRect (full containment)', () => {
  // f1 is a square with screen vertices in x,y ∈ {10, 50}; f2 is far away.
  const facePoints: Point[] = [
    { id: 'p1', x: 10, z: -10 },
    { id: 'p2', x: 50, z: -10 },
    { id: 'p3', x: 50, z: -50 },
    { id: 'p4', x: 10, z: -50 },
    { id: 'q1', x: 500, z: -500 },
    { id: 'q2', x: 540, z: -500 },
    { id: 'q3', x: 540, z: -540 },
  ]
  const faces: Face[] = [
    { id: 'f1', pointIds: ['p1', 'p2', 'p3', 'p4'], lineIds: [], centroid: { x: 30, z: -30 }, area: 1600 },
    { id: 'f2', pointIds: ['q1', 'q2', 'q3'], lineIds: [], centroid: { x: 520, z: -520 }, area: 1 },
  ]
  test('selects a face only when ALL its vertices are inside', () => {
    const r = normalizeRect(0, 0, 100, 100)
    expect(facesInRect(faces, facePoints, vp, r)).toEqual(['f1'])
  })
  test('does NOT select a face that is only partially inside', () => {
    const r = normalizeRect(0, 0, 30, 100) // covers x=10 vertices but not x=50 ones
    expect(facesInRect(faces, facePoints, vp, r)).toEqual([])
  })
})
