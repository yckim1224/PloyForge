import { describe, expect, test } from 'vitest'
import { facesInRect, normalizeRect, pointsInRect, segmentsInRect } from './selection'
import type { Face, Point, Segment } from '../types'

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

describe('segmentsInRect', () => {
  const segments: Segment[] = [
    { id: 'ab', p0: 'a', p1: 'b', bdryFlag: 0 }, // horizontal at y=10
    { id: 'ac', p0: 'a', p1: 'c', bdryFlag: 0 }, // vertical at x=10
  ]
  test('selects a segment crossing the rect even if endpoints are outside', () => {
    // Rect around x=100..150, y=0..50 crosses segment ab (y=10).
    const r = normalizeRect(100, 0, 150, 50)
    expect(segmentsInRect(points, segments, vp, r)).toEqual(['ab'])
  })
  test('ignores segments fully outside', () => {
    const r = normalizeRect(300, 300, 400, 400)
    expect(segmentsInRect(points, segments, vp, r)).toEqual([])
  })
})

describe('facesInRect', () => {
  const faces: Face[] = [
    { id: 'f1', pointIds: [], segmentIds: [], centroid: { x: 50, z: -50 }, area: 1 },
    { id: 'f2', pointIds: [], segmentIds: [], centroid: { x: 500, z: -500 }, area: 1 },
  ]
  test('selects faces whose centroid is inside', () => {
    const r = normalizeRect(0, 0, 100, 100)
    expect(facesInRect(faces, vp, r)).toEqual(['f1'])
  })
})
