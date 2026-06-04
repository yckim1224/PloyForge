import { describe, expect, test } from 'vitest'
import { pointOnSegment, projectToSegment } from './geometry'

describe('projectToSegment', () => {
  test('projects onto the segment with distance and parameter', () => {
    const r = projectToSegment({ x: 50, z: -30 }, { x: 0, z: 0 }, { x: 100, z: 0 })
    expect(r.point).toEqual({ x: 50, z: 0 })
    expect(r.dist).toBeCloseTo(30, 6)
    expect(r.t).toBeCloseTo(0.5, 6)
  })

  test('clamps to the nearest endpoint when beyond the segment', () => {
    const r = projectToSegment({ x: -40, z: 0 }, { x: 0, z: 0 }, { x: 100, z: 0 })
    expect(r.t).toBe(0)
    expect(r.point).toEqual({ x: 0, z: 0 })
  })
})

describe('pointOnSegment', () => {
  const a = { x: 0, z: 0 }
  const b = { x: 100, z: 0 }
  test('true for an interior point', () => {
    expect(pointOnSegment({ x: 50, z: 0 }, a, b)).toBe(true)
  })
  test('false when off the line', () => {
    expect(pointOnSegment({ x: 50, z: -1 }, a, b)).toBe(false)
  })
  test('false at the endpoints (no split needed there)', () => {
    expect(pointOnSegment({ x: 0, z: 0 }, a, b)).toBe(false)
    expect(pointOnSegment({ x: 100, z: 0 }, a, b)).toBe(false)
  })
  test('works on a slanted segment', () => {
    expect(pointOnSegment({ x: 50, z: -50 }, { x: 0, z: 0 }, { x: 100, z: -100 })).toBe(true)
  })
})
