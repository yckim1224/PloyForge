import { describe, expect, test } from 'vitest'
import {
  nearestGridIntersection,
  nearestLinePoint,
  nearestPoint,
  snapPointTarget,
  snapWorld,
} from './snapping'
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

describe('snapPointTarget priority', () => {
  const vp = { scale: 1, originX: 0, originY: 0 }
  // Long horizontal edge at world z=-10 (screen y=10). Endpoints are placed
  // far from the origin so they are always outside the vertex hit threshold
  // when probing near the world origin.
  const edgePoints: Point[] = [
    { id: 'c', x: -1000, z: -10 },
    { id: 'd', x: 1000, z: -10 },
  ]
  const segs: Line[] = [{ id: 's', p0: 'c', p1: 'd', bdryFlag: 0 }]

  test('alt key bypasses every snap stage and returns raw world position', () => {
    const out = snapPointTarget(edgePoints, segs, vp, 17, -23, 100, 10, true)
    expect(out).toEqual({ x: 17, z: 23 })
  })

  test('existing vertex wins over grid and edge snaps', () => {
    // Add a vertex at the origin. Cursor near it; grid is also at (0,0) and
    // the edge is also in range -- vertex priority must take all three.
    const withOrigin: Point[] = [{ id: 'a', x: 0, z: 0 }, ...edgePoints]
    const out = snapPointTarget(withOrigin, segs, vp, 3, 6, 100, 10, false)
    expect(out.existingId).toBe('a')
  })

  test('grid intersection beats edge snap when both are inside threshold', () => {
    // Cursor at screen (3, 6): grid (0,0) is sqrt(45) ~= 6.7 px away, edge
    // at screen y=10 is 4 px away. Per priority, grid wins despite being farther.
    const out = snapPointTarget(edgePoints, segs, vp, 3, 6, 100, 10, false)
    expect(out).toEqual({ x: 0, z: 0 })
  })

  test('falls through to edge projection when grid is out of threshold', () => {
    // Cursor at screen (50, 12): grid (100, 0) is ~51 px away (out), edge at
    // screen y=10 is 2 px away (in) -> projects onto the edge.
    const out = snapPointTarget(edgePoints, segs, vp, 50, 12, 100, 10, false)
    expect(out.x).toBeCloseTo(50, 6)
    expect(out.z).toBeCloseTo(-10, 6)
  })

  test('falls through to free grid snap when nothing else is within threshold', () => {
    // No points, no segments -> mid-cell cursor rounds to nearest intersection.
    const out = snapPointTarget([], [], vp, 60, -40, 100, 10, false)
    expect(out).toEqual({ x: 100, z: 0 })
  })
})

describe('nearestGridIntersection', () => {
  // 1 px per world meter; world (0,0) is at screen (0,0).
  const vp = { scale: 1, originX: 0, originY: 0 }

  test('snaps to the nearest grid intersection within the pixel threshold', () => {
    // Cursor at screen (8, -3) -> world (8, 3). Nearest intersection at (0, 0).
    const hit = nearestGridIntersection(vp, 8, -3, 100, 10)
    expect(hit).not.toBeNull()
    expect(hit!.x).toBe(0)
    expect(hit!.z).toBe(0)
  })

  test('returns null when cursor sits mid-cell, beyond the threshold', () => {
    // Halfway between two intersections; no intersection within HIT_PX.
    expect(nearestGridIntersection(vp, 40, -40, 100, 10)).toBeNull()
  })

  test('returns null when spacing is non-positive', () => {
    expect(nearestGridIntersection(vp, 0, 0, 0, 10)).toBeNull()
    expect(nearestGridIntersection(vp, 0, 0, -1, 10)).toBeNull()
  })
})
