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

  test('toggleSelect keeps the selection single-kind (switches on a different type)', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const s = store().addSegment(a, b)!
    store().toggleSelect('point', a)
    expect(store().selection.pointIds).toEqual([a])
    // Toggling a segment while a point is selected switches to just that segment.
    store().toggleSelect('segment', s)
    expect(store().selection.pointIds).toEqual([])
    expect(store().selection.segmentIds).toEqual([s])
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

  test('autoAssignBoundaryFlags sets left/right/bottom/top from the domain extent', () => {
    store().setDomain({ xmin: 0, xmax: 100, zmin: -100, zmax: 0 })
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const d = store().addPoint(0, -100)
    const top = store().addSegment(a, b)!
    const right = store().addSegment(b, c)!
    const bottom = store().addSegment(c, d)!
    const left = store().addSegment(d, a)!
    store().autoAssignBoundaryFlags()
    const flag = (id: string) => store().segments.find((s) => s.id === id)!.bdryFlag
    expect(flag(top)).toBe(32)
    expect(flag(right)).toBe(2)
    expect(flag(bottom)).toBe(16)
    expect(flag(left)).toBe(1)
  })

  test('setSegmentFlag updates only the given segments', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const s = store().addSegment(a, b)!
    store().setSegmentFlag([s], 16)
    expect(store().segments[0].bdryFlag).toBe(16)
  })

  test('applyFaceMaterial creates one region at the face centroid, then updates it', () => {
    store().setDomain({ xmin: 0, xmax: 100, zmin: -100, zmax: 0 })
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const d = store().addPoint(0, -100)
    store().addSegment(a, b)
    store().addSegment(b, c)
    store().addSegment(c, d)
    store().addSegment(d, a)
    expect(store().faces.length).toBe(1)
    const faceId = store().faces[0].id

    store().applyFaceMaterial([faceId], { mattype: 3, size: 5 })
    expect(store().regions.length).toBe(1)
    expect(store().regions[0]).toMatchObject({ mattype: 3, size: 5 })
    expect(store().regions[0].x).toBeCloseTo(50, 6)
    expect(store().regions[0].z).toBeCloseTo(-50, 6)

    // Re-applying edits the same region rather than creating a duplicate.
    store().applyFaceMaterial([faceId], { mattype: 1 })
    expect(store().regions.length).toBe(1)
    expect(store().regions[0].mattype).toBe(1)
  })

  test('drawing a line across a face splits it into two faces (T-junction noding)', () => {
    // Build a closed square -> 1 face.
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const d = store().addPoint(0, -100)
    store().addSegment(a, b) // top edge
    store().addSegment(b, c)
    store().addSegment(c, d) // bottom edge
    store().addSegment(d, a)
    expect(store().faces.length).toBe(1)

    // Draw a vertical line whose endpoints land mid-edge (new points on the
    // top and bottom edges). This must split the square into two faces.
    const res = store().addLineByCoords(50, 0, 50, -100, true)
    expect(res.segmentId).not.toBeNull()
    expect(store().faces.length).toBe(2)
  })

  test('removeOrphanRegions drops seeds that fall outside every face', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const d = store().addPoint(0, -100)
    store().addSegment(a, b)
    store().addSegment(b, c)
    store().addSegment(c, d)
    store().addSegment(d, a)
    store().addRegion(50, -50, 0) // inside the face
    store().addRegion(999, 999, 1) // outside every face
    expect(store().regions.length).toBe(2)
    store().removeOrphanRegions()
    expect(store().regions.length).toBe(1)
    expect(store().regions[0]).toMatchObject({ x: 50, z: -50 })
  })

  test('nudgeSelection moves selected points by one grid step (10x with Shift)', () => {
    store().setDomain({ gridSpacing: 100 })
    const a = store().addPoint(0, 0)
    store().selectSingle('point', a)
    store().nudgeSelection(1, 0, false) // right
    expect(store().points.find((p) => p.id === a)).toMatchObject({ x: 100, z: 0 })
    store().nudgeSelection(0, 1, false) // up = +z
    expect(store().points.find((p) => p.id === a)).toMatchObject({ x: 100, z: 100 })
    store().nudgeSelection(-1, 0, true) // left, large step
    expect(store().points.find((p) => p.id === a)).toMatchObject({ x: -900, z: 100 })
  })

  test('nudgeSelection moves both endpoints of a selected segment', () => {
    store().setDomain({ gridSpacing: 100 })
    const a = store().addPoint(0, 0)
    const b = store().addPoint(200, 0)
    const s = store().addSegment(a, b)!
    store().selectSingle('segment', s)
    store().nudgeSelection(0, -1, false) // down = -z
    expect(store().points.find((p) => p.id === a)).toMatchObject({ x: 0, z: -100 })
    expect(store().points.find((p) => p.id === b)).toMatchObject({ x: 200, z: -100 })
  })

  test('nudgeSelection moves a region seed and is a no-op without a selection', () => {
    store().setDomain({ gridSpacing: 100 })
    const r = store().addRegion(50, -50, 0)
    store().selectSingle('region', r)
    store().nudgeSelection(1, 0, false)
    expect(store().regions[0]).toMatchObject({ x: 150, z: -50 })
    store().clearSelection()
    store().nudgeSelection(1, 0, false)
    expect(store().regions[0]).toMatchObject({ x: 150, z: -50 })
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
