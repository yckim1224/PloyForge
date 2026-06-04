import { beforeEach, describe, expect, test } from 'vitest'
import { useEditorStore } from './editorStore'

const store = () => useEditorStore.getState()

beforeEach(() => {
  store().reset()
})

describe('editorStore', () => {
  test('addPoint dedupes identical coordinates', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(0, 0)
    expect(a).toBe(b)
    expect(store().points.length).toBe(1)
  })

  test('addSegment dedupes (both directions) and rejects self-loops', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    expect(store().addSegment(a, b)).not.toBeNull()
    expect(store().addSegment(a, b)).toBeNull()
    expect(store().addSegment(b, a)).toBeNull()
    expect(store().addSegment(a, a)).toBeNull()
    expect(store().segments.length).toBe(1)
  })

  test('addLineByCoords auto-creates missing points', () => {
    const res = store().addLineByCoords(0, 0, 100, -50, true)
    expect(res.segmentId).not.toBeNull()
    expect(store().points.length).toBe(2)
    expect(store().segments.length).toBe(1)
  })

  test('addLineByCoords without auto-create fails cleanly on a missing point', () => {
    store().addPoint(0, 0)
    const res = store().addLineByCoords(0, 0, 100, -50, false)
    expect(res.segmentId).toBeNull()
    expect(res.error).toBeTruthy()
    expect(store().points.length).toBe(1)
    expect(store().segments.length).toBe(0)
  })

  test('removePoints cascades to incident segments', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -50)
    store().addSegment(a, b)
    store().addSegment(b, c)
    store().removePoints([b])
    expect(store().points.length).toBe(2)
    expect(store().segments.length).toBe(0)
  })

  test('selectSingle replaces selection; toggleSelect adds/removes', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    store().selectSingle('point', a)
    expect(store().selection.pointIds).toEqual([a])
    store().selectSingle('point', b)
    expect(store().selection.pointIds).toEqual([b]) // replaced
    store().toggleSelect('point', a)
    expect(store().selection.pointIds.sort()).toEqual([a, b].sort())
    store().toggleSelect('point', a)
    expect(store().selection.pointIds).toEqual([b]) // removed
  })

  test('deleteSelection removes selected points (with cascade) and clears selection', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    store().addSegment(a, b)
    store().selectSingle('point', a)
    store().deleteSelection()
    expect(store().points.length).toBe(1)
    expect(store().segments.length).toBe(0)
    expect(store().selection.pointIds).toEqual([])
  })

  test('switching away from the line tool clears the pending line start', () => {
    const a = store().addPoint(0, 0)
    store().setTool('line')
    store().setPendingLineStart(a)
    expect(store().pendingLineStart).toBe(a)
    store().setTool('select')
    expect(store().pendingLineStart).toBeNull()
  })

  test('deleting the pending line start point clears it', () => {
    const a = store().addPoint(0, 0)
    store().setPendingLineStart(a)
    store().removePoints([a])
    expect(store().pendingLineStart).toBeNull()
  })

  test('toDocument / loadDocument round-trips through the store', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    store().addSegment(a, b, 1)
    store().addRegion(50, -10, 2, -1)
    const doc = store().toDocument()

    store().reset()
    expect(store().points.length).toBe(0)

    store().loadDocument(doc)
    expect(store().points.length).toBe(2)
    expect(store().segments.length).toBe(1)
    expect(store().regions.length).toBe(1)
    expect(store().materials.some((m) => m.mattype === 2)).toBe(true)
  })
})
