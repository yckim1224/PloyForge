import { describe, expect, test } from 'vitest'
import { nearestPoint, nearestLinePoint, snapWorld } from './snapping'
import type { Point, Line } from '../types'

describe('snapWorld', () => {
  test('snaps to the nearest grid multiple', () => {
    expect(snapWorld(2300, -1800, 1000)).toEqual({ x: 2000, z: -2000 })
    expect(snapWorld(2600, -1400, 1000)).toEqual({ x: 3000, z: -1000 })
  })
})

describe('nearestPoint', () => {
  const vp = { scale: 1, originX: 0, originY: 0 } // 1px per meter, z down
  const points: Point[] = [
    { id: 'a', x: 0, z: 0 },
    { id: 'b', x: 100, z: 0 },
  ]

  test('returns the point within the pixel threshold', () => {
    // Point a is at screen (0, 0); cursor near it.
    const hit = nearestPoint(points, vp, 5, -4, 10)
    expect(hit?.id).toBe('a')
  })

  test('returns null when no point is within the threshold', () => {
    expect(nearestPoint(points, vp, 50, -50, 10)).toBeNull()
  })
})

describe('nearestLinePoint', () => {
  const vp = { scale: 1, originX: 0, originY: 0 }
  // Horizontal segment at world z=-10 (screen y=10).
  const segPoints: Point[] = [
    { id: 'a', x: 0, z: -10 },
    { id: 'b', x: 200, z: -10 },
  ]
  const segments: Line[] = [{ id: 's', p0: 'a', p1: 'b', bdryFlag: 0 }]

  test('projects the cursor onto the edge when within the threshold', () => {
    const hit = nearestLinePoint(segments, segPoints, vp, 100, 14, 10)
    expect(hit).not.toBeNull()
    expect(hit!.x).toBeCloseTo(100, 6)
    expect(hit!.z).toBeCloseTo(-10, 6)
  })

  test('returns null when no edge is within the threshold', () => {
    expect(nearestLinePoint(segments, segPoints, vp, 100, 60, 10)).toBeNull()
  })
})
