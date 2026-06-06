import { beforeEach, describe, expect, test } from 'vitest'
import { useEditorStore } from './editorStore'
import { useSettingsStore, defaultSettings } from './settingsStore'
import { serializePoly } from '../poly/serialize'

const store = () => useEditorStore.getState()

beforeEach(() => {
  store().reset()
  useSettingsStore.getState().hydrate(defaultSettings())
})

describe('editorStore', () => {
  test('addPoint dedupes identical coordinates', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(0, 0)
    expect(a).toBe(b)
    expect(store().points.length).toBe(1)
  })

  test('addLine dedupes (both directions) and rejects self-loops', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    expect(store().addLine(a, b)).not.toBeNull()
    expect(store().addLine(a, b)).toBeNull()
    expect(store().addLine(b, a)).toBeNull()
    expect(store().addLine(a, a)).toBeNull()
    expect(store().lines.length).toBe(1)
  })

  test('addLineByCoords auto-creates missing points', () => {
    const res = store().addLineByCoords(0, 0, 100, -50, true)
    expect(res.lineId).not.toBeNull()
    expect(store().points.length).toBe(2)
    expect(store().lines.length).toBe(1)
  })

  test('addLineByCoords without auto-create fails cleanly on a missing point', () => {
    store().addPoint(0, 0)
    const res = store().addLineByCoords(0, 0, 100, -50, false)
    expect(res.lineId).toBeNull()
    expect(res.error).toBeTruthy()
    expect(store().points.length).toBe(1)
    expect(store().lines.length).toBe(0)
  })

  test('removePoints cascades to incident segments', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -50)
    store().addLine(a, b)
    store().addLine(b, c)
    store().removePoints([b])
    expect(store().points.length).toBe(2)
    expect(store().lines.length).toBe(0)
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
    const s = store().addLine(a, b)!
    store().toggleSelect('point', a)
    expect(store().selection.pointIds).toEqual([a])
    // Toggling a segment while a point is selected switches to just that segment.
    store().toggleSelect('line', s)
    expect(store().selection.pointIds).toEqual([])
    expect(store().selection.lineIds).toEqual([s])
  })

  test('deleteSelection removes selected points (with cascade) and clears selection', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    store().addLine(a, b)
    store().selectSingle('point', a)
    store().deleteSelection()
    expect(store().points.length).toBe(1)
    expect(store().lines.length).toBe(0)
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

  test('autoAssignBoundaryFlags derives left/right/bottom/top from the points bbox', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const d = store().addPoint(0, -100)
    const top = store().addLine(a, b)!
    const right = store().addLine(b, c)!
    const bottom = store().addLine(c, d)!
    const left = store().addLine(d, a)!
    store().autoAssignBoundaryFlags()
    const flag = (id: string) => store().lines.find((s) => s.id === id)!.bdryFlag
    expect(flag(top)).toBe(32)
    expect(flag(right)).toBe(2)
    expect(flag(bottom)).toBe(16)
    expect(flag(left)).toBe(1)
  })

  test('setLineFlag updates only the given segments', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const s = store().addLine(a, b)!
    store().setLineFlag([s], 16)
    expect(store().lines[0].bdryFlag).toBe(16)
  })

  test('setFaceType writes a faceTypes entry and ensures the material color', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const d = store().addPoint(0, -100)
    store().addLine(a, b)
    store().addLine(b, c)
    store().addLine(c, d)
    store().addLine(d, a)
    expect(store().faces.length).toBe(1)
    const faceId = store().faces[0].id

    store().setFaceType(faceId, 3, 5)
    expect(store().faceTypes[faceId]).toEqual({ mattype: 3, size: 5 })
    expect(store().faces[0].mattype).toBe(3)
    expect(store().faces[0].size).toBe(5)
    // Settings store now contains a color entry for mattype 3.
    expect(useSettingsStore.getState().materials.some((m) => m.mattype === 3)).toBe(true)

    // Re-applying updates the same entry rather than duplicating.
    store().setFaceType(faceId, 1)
    expect(store().faceTypes[faceId]).toEqual({ mattype: 1, size: -1 })
    expect(store().faces[0].mattype).toBe(1)
  })

  test('clearFaceType removes the faceTypes entry and the face goes back to untyped', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const d = store().addPoint(0, -100)
    store().addLine(a, b)
    store().addLine(b, c)
    store().addLine(c, d)
    store().addLine(d, a)
    const fid = store().faces[0].id
    store().setFaceType(fid, 2)
    expect(store().faces[0].mattype).toBe(2)
    store().clearFaceType(fid)
    expect(store().faceTypes[fid]).toBeUndefined()
    expect(store().faces[0].mattype).toBeUndefined()
  })

  test('drawing a line across a face splits it; both children are untyped (A-13)', () => {
    // Build a closed square -> 1 face.
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const d = store().addPoint(0, -100)
    store().addLine(a, b)
    store().addLine(b, c)
    store().addLine(c, d)
    store().addLine(d, a)
    expect(store().faces.length).toBe(1)
    const parentId = store().faces[0].id
    store().setFaceType(parentId, 9)
    expect(store().faces[0].mattype).toBe(9)

    // Draw a vertical line whose endpoints land mid-edge (new points on the
    // top and bottom edges). This must split the square into two faces.
    const res = store().addLineByCoords(50, 0, 50, -100, true)
    expect(res.lineId).not.toBeNull()
    expect(store().faces.length).toBe(2)
    // Children have different faceIds from the parent, so both are untyped.
    for (const f of store().faces) {
      expect(f.id).not.toBe(parentId)
      expect(f.mattype).toBeUndefined()
    }
    // The parent's faceTypes entry is preserved (stale) for resurrection.
    expect(store().faceTypes[parentId]).toEqual({ mattype: 9, size: -1 })
  })

  test('nudgeSelection moves selected points by one grid step (10x with Shift)', () => {
    useSettingsStore.getState().setGrid({ spacing: 100 })
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
    useSettingsStore.getState().setGrid({ spacing: 100 })
    const a = store().addPoint(0, 0)
    const b = store().addPoint(200, 0)
    const s = store().addLine(a, b)!
    store().selectSingle('line', s)
    store().nudgeSelection(0, -1, false) // down = -z
    expect(store().points.find((p) => p.id === a)).toMatchObject({ x: 0, z: -100 })
    expect(store().points.find((p) => p.id === b)).toMatchObject({ x: 200, z: -100 })
  })

  test('nudgeSelection is a no-op without a selection', () => {
    useSettingsStore.getState().setGrid({ spacing: 100 })
    const a = store().addPoint(0, 0)
    store().clearSelection()
    store().nudgeSelection(1, 0, false)
    expect(store().points.find((p) => p.id === a)).toMatchObject({ x: 0, z: 0 })
  })

  test('addLine nodes a new segment drawn through an existing interior point', () => {
    const a = store().addPoint(0, 0)
    const mid = store().addPoint(50, 0)
    const b = store().addPoint(100, 0)
    expect(store().lines.length).toBe(0)
    expect(store().addLine(a, b)).not.toBeNull()
    // a-b passes through mid, so it must be split into a-mid and mid-b.
    expect(store().lines.length).toBe(2)
    const incidentToMid = store().lines.filter((s) => s.p0 === mid || s.p1 === mid)
    expect(incidentToMid.length).toBe(2)
  })

  test('moving a point onto a segment interior re-nodes that segment', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    store().addLine(a, b)
    const c = store().addPoint(50, -50) // off the segment
    expect(store().lines.length).toBe(1)
    store().movePoint(c, 50, 0) // now on the a-b interior
    expect(store().lines.length).toBe(2)
  })

  test('nudgeSelection preserves a face Type when its vertices translate together (A-22)', () => {
    useSettingsStore.getState().setGrid({ spacing: 10 })
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const d = store().addPoint(0, -100)
    store().addLine(a, b)
    store().addLine(b, c)
    store().addLine(c, d)
    store().addLine(d, a)
    const faceId = store().faces[0].id
    store().setFaceType(faceId, 1)
    expect(store().faceTypes[faceId]?.mattype).toBe(1)
    store().selectSingle('face', faceId)
    store().nudgeSelection(1, 0, false) // +x by one grid step (10)
    // The face id is sorted-pointIds, which is unchanged by translation, so
    // the face survives and keeps its Type without any seed-follow code.
    expect(store().faces[0].id).toBe(faceId)
    expect(store().faces[0].mattype).toBe(1)
    expect(store().faceTypes[faceId]?.mattype).toBe(1)
  })

  test('deleting a face boundary then undoing restores the Type (A-14)', async () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const d = store().addPoint(0, -100)
    store().addLine(a, b)
    store().addLine(b, c)
    store().addLine(c, d)
    const closing = store().addLine(d, a)!
    const fid = store().faces[0].id
    store().setFaceType(fid, 7)
    expect(store().faces[0].mattype).toBe(7)

    // Clear undo history so we measure exactly the next step.
    useEditorStore.temporal.getState().clear()
    await Promise.resolve()
    const before = useEditorStore.temporal.getState().pastStates.length

    // Remove the closing line: the face opens, no faceId matches; entry stays stale.
    store().removeLines([closing])
    expect(store().faces.length).toBe(0)
    expect(store().faceTypes[fid]).toEqual({ mattype: 7, size: -1 })
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(before + 1)

    // Undo: the face reforms with the same id and its Type resurrects.
    useEditorStore.temporal.getState().undo()
    store().recomputeFaces()
    expect(store().faces.length).toBe(1)
    expect(store().faces[0].id).toBe(fid)
    expect(store().faces[0].mattype).toBe(7)
  })

  test('addLineByCoords rejects a duplicate segment without leaving orphan points', () => {
    store().addLineByCoords(0, 0, 100, 0, true)
    const pointCount = store().points.length
    const res = store().addLineByCoords(0, 0, 100, 0, true)
    expect(res.lineId).toBeNull()
    expect(res.error).toBe('That segment already exists.')
    expect(store().points.length).toBe(pointCount) // no orphan auto-created point
    expect(store().lines.length).toBe(1)
  })

  test('a single logical edit is one undo step (zundo handleSet batching)', async () => {
    const temporal = useEditorStore.temporal
    temporal.getState().clear()
    await Promise.resolve() // flush the batching microtask
    const before = temporal.getState().pastStates.length
    // addLineByCoords calls set() three times (addPoint + addPoint + addLine).
    store().addLineByCoords(0, 0, 100, 0, true)
    expect(temporal.getState().pastStates.length).toBe(before + 1)
  })

  test('toDocument / loadDocument round-trips through the store', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const d = store().addPoint(0, -100)
    store().addLine(a, b, 1)
    store().addLine(b, c)
    store().addLine(c, d)
    store().addLine(d, a)
    const fid = store().faces[0].id
    store().setFaceType(fid, 2)
    const doc = store().toDocument()

    store().reset()
    expect(store().points.length).toBe(0)

    store().loadDocument(doc, [2])
    expect(store().points.length).toBe(4)
    expect(store().lines.length).toBe(4)
    expect(store().faces[0].mattype).toBe(2)
    expect(useSettingsStore.getState().materials.some((m) => m.mattype === 2)).toBe(true)
  })

  test('loadDocument + temporal.clear() leaves no undoable steps (import contract)', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    store().addLine(a, b)
    const doc = store().toDocument()

    store().reset()
    store().addPoint(10, 10) // some user history before "import"
    expect(useEditorStore.temporal.getState().pastStates.length).toBeGreaterThan(0)

    store().loadDocument(doc)
    useEditorStore.temporal.getState().clear()
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(0)
  })

  test('insertPoint(null, ...) appends at the end (A-4)', () => {
    store().addPoint(0, 0)
    store().addPoint(100, 0)
    const before = store().points.length
    const id = store().insertPoint(null, 50, -50)
    expect(store().points.length).toBe(before + 1)
    expect(store().points[store().points.length - 1].id).toBe(id)
  })

  test('insertPoint(k, ...) splices and preserves uids of shifted items (A-5)', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(200, 0)
    const before = store().points.map((p) => p.id)
    const newId = store().insertPoint(1, 50, 0)
    const after = store().points.map((p) => p.id)
    // Insertion at slot 1 yields [a, new, b, c]; original uids unchanged.
    expect(after).toEqual([a, newId, b, c])
    // Display indices shifted; uids stable.
    expect(before).toEqual([a, b, c])
  })

  test('insertPoint(huge, ...) clamps to append', () => {
    const a = store().addPoint(0, 0)
    const newId = store().insertPoint(99, 50, -50)
    expect(store().points.map((p) => p.id)).toEqual([a, newId])
  })

  test('insertLine(null, ...) appends, insertLine(k, ...) splices', () => {
    // Non-crossing rectangle so the crossing-noding pass stays out of the
    // way -- the assertion is purely about splice ordering, not noding.
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(0, -100)
    const d = store().addPoint(100, -100)
    const s0 = store().addLine(a, b)! // top
    const s1 = store().addLine(c, d)! // bottom
    const sNew = store().insertLine(null, a, c)! // left, appended
    expect(store().lines.map((l) => l.id)).toEqual([s0, s1, sNew])
    const sSpliced = store().insertLine(1, b, d)! // right, spliced at 1
    expect(store().lines.map((l) => l.id)).toEqual([s0, sSpliced, s1, sNew])
  })

  test('insertLine rejects self-loops and duplicates', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    store().addLine(a, b)
    expect(store().insertLine(0, a, a)).toBeNull()
    expect(store().insertLine(0, b, a)).toBeNull()
    expect(store().insertLine(null, a, b)).toBeNull()
  })

  test('after insertPoint(k, ...) export emits nodes 0..N-1 with Line indices reflecting new order (A-6)', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    store().addLine(a, b)
    // Insert at the front: a becomes index 1, b becomes index 2.
    store().insertPoint(0, 50, -50)
    const { text } = serializePoly(store().toDocument())
    const lines = text.split('\n')
    // Find the node block: "<n> 2 0 0" header, then n lines of "i x z".
    const nodeHdrIdx = lines.findIndex((l) => /^\d+ 2 0 0$/.test(l))
    expect(nodeHdrIdx).toBeGreaterThan(-1)
    const nNodes = Number(lines[nodeHdrIdx].split(' ')[0])
    expect(nNodes).toBe(3)
    // Subsequent header is "# i x z"; nodes start at nodeHdrIdx + 2.
    const nodeLines = lines.slice(nodeHdrIdx + 2, nodeHdrIdx + 2 + nNodes)
    nodeLines.forEach((l, i) => {
      expect(l.split(' ')[0]).toBe(String(i))
    })
    // The single segment now references indices 1 and 2 (a and b after the splice).
    const segHdrIdx = lines.findIndex((l) => /^\d+ 1$/.test(l))
    const segLine = lines[segHdrIdx + 2]
    const segParts = segLine.split(' ')
    // "0 <p0> <p1> <bf>"
    expect(segParts[1]).toBe('1')
    expect(segParts[2]).toBe('2')
  })

  test('loadDocument auto-ensures materials for mattypes used in faceTypes', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const d = store().addPoint(0, -100)
    store().addLine(a, b)
    store().addLine(b, c)
    store().addLine(c, d)
    store().addLine(d, a)
    const fid = store().faces[0].id
    store().setFaceType(fid, 7)
    const doc = store().toDocument()

    useSettingsStore.getState().hydrate(defaultSettings())
    store().reset()
    expect(useSettingsStore.getState().materials.some((m) => m.mattype === 7)).toBe(false)

    // Persistence rehydrate path does not pass discoveredMaterials.
    store().loadDocument(doc)
    expect(store().faces[0].mattype).toBe(7)
    expect(useSettingsStore.getState().materials.some((m) => m.mattype === 7)).toBe(true)
  })

  test('movePointToIndex shuffles a point to a new slot, preserving line uids', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    store().addLine(a, c) // line uses uids; display indices should not affect this
    expect(store().points.map((p) => p.id)).toEqual([a, b, c])

    store().movePointToIndex(c, 0)
    expect(store().points.map((p) => p.id)).toEqual([c, a, b])
    // Line still references the same uids; only the display indices changed.
    expect(store().lines[0].p0).toBe(a)
    expect(store().lines[0].p1).toBe(c)
  })

  test('movePointToIndex clamps out-of-range indices to the array bounds', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    store().movePointToIndex(a, 999)
    expect(store().points.map((p) => p.id)).toEqual([b, c, a])
    store().movePointToIndex(a, -5)
    expect(store().points.map((p) => p.id)).toEqual([a, b, c])
  })

  test('moveLineToIndex shuffles a line to a new slot', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const ab = store().addLine(a, b)!
    const bc = store().addLine(b, c)!
    const ca = store().addLine(c, a)!
    expect(store().lines.map((l) => l.id)).toEqual([ab, bc, ca])
    store().moveLineToIndex(ca, 0)
    expect(store().lines.map((l) => l.id)).toEqual([ca, ab, bc])
  })

  test('sortPointsBy reorders by the chosen coordinate', () => {
    store().addPoint(50, -50)
    store().addPoint(10, -90)
    store().addPoint(90, -10)
    store().sortPointsBy('x')
    expect(store().points.map((p) => p.x)).toEqual([10, 50, 90])
    store().sortPointsBy('z')
    expect(store().points.map((p) => p.z)).toEqual([-90, -50, -10])
  })

  test('removeIsolatedPoints drops points unreferenced by any line', () => {
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    store().addPoint(50, -50) // isolated
    store().addLine(a, b)
    store().removeIsolatedPoints()
    expect(store().points.map((p) => p.id)).toEqual([a, b])
  })

  test('renode auto-creates intersection points so crossing lines split into 4 faces', () => {
    // Square outline plus two internal lines that cross at the center
    // without a pre-existing point there.
    const a = store().addPoint(0, 0)
    const b = store().addPoint(100, 0)
    const c = store().addPoint(100, -100)
    const d = store().addPoint(0, -100)
    store().addLine(a, b)
    store().addLine(b, c)
    store().addLine(c, d)
    store().addLine(d, a)
    // Mid-edge points (T-junction noding splits the outline).
    const e = store().addPoint(50, 0)
    const f = store().addPoint(50, -100)
    const g = store().addPoint(0, -50)
    const h = store().addPoint(100, -50)
    // Internal verticals/horizontals that cross at (50, -50) -- no point yet.
    store().addLine(e, f)
    store().addLine(g, h)

    // Phase A added a single point at the crossing; phase B split both
    // internal lines into two pieces each.
    const center = store().points.find((p) => p.x === 50 && p.z === -50)
    expect(center).toBeDefined()
    expect(store().points.length).toBe(9)
    expect(store().faces.length).toBe(4)

    // sanity: every parent line was retired and each crossing branch exists.
    const has = (p0: string, p1: string) =>
      store().lines.some(
        (l) => (l.p0 === p0 && l.p1 === p1) || (l.p0 === p1 && l.p1 === p0),
      )
    const ci = center!.id
    expect(has(e, ci)).toBe(true)
    expect(has(ci, f)).toBe(true)
    expect(has(g, ci)).toBe(true)
    expect(has(ci, h)).toBe(true)
    expect(has(e, f)).toBe(false)
    expect(has(g, h)).toBe(false)
  })
})
