import { describe, expect, test } from 'vitest'
import { exceededDragThreshold, isDraggableTarget, snapDelta } from './drag'
import type { Selection } from '../store/editorStore'

const sel = (over: Partial<Selection> = {}): Selection => ({
  pointIds: [],
  lineIds: [],
  faceIds: [],
  ...over,
})

describe('isDraggableTarget', () => {
  test('true only for a selected node of the matching kind', () => {
    expect(isDraggableTarget('point', 'p1', sel({ pointIds: ['p1'] }))).toBe(true)
    expect(isDraggableTarget('line', 's1', sel({ lineIds: ['s1'] }))).toBe(true)
    expect(isDraggableTarget('face', 'f1', sel({ faceIds: ['f1'] }))).toBe(true)
  })

  test('false for unselected id, wrong kind, or non-entity name', () => {
    expect(isDraggableTarget('point', 'p2', sel({ pointIds: ['p1'] }))).toBe(false)
    expect(isDraggableTarget('point', 'p1', sel({ lineIds: ['p1'] }))).toBe(false)
    expect(isDraggableTarget('', 'p1', sel({ pointIds: ['p1'] }))).toBe(false)
    expect(isDraggableTarget('grid', 'x', sel({ pointIds: ['x'] }))).toBe(false)
  })
})

describe('exceededDragThreshold', () => {
  test('false at or below the threshold, true above it', () => {
    expect(exceededDragThreshold(0, 0)).toBe(false)
    expect(exceededDragThreshold(3, 0)).toBe(false)
    expect(exceededDragThreshold(-3, 3)).toBe(false)
    expect(exceededDragThreshold(4, 0)).toBe(true)
    expect(exceededDragThreshold(0, -5)).toBe(true)
  })
})

describe('snapDelta', () => {
  test('rounds the delta to grid-spacing multiples', () => {
    expect(snapDelta(12, -27, 10, false)).toEqual({ dx: 10, dz: -30 })
  })

  test('free (Alt) passes the raw delta through', () => {
    expect(snapDelta(12, -27, 10, true)).toEqual({ dx: 12, dz: -27 })
  })

  test('non-positive spacing passes the raw delta through', () => {
    expect(snapDelta(12, -27, 0, false)).toEqual({ dx: 12, dz: -27 })
  })
})
