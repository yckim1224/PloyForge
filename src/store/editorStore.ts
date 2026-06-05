import { create } from 'zustand'
import { temporal } from 'zundo'
import type { Domain, Face, Material, Point, PolyDocument, Region, Segment } from '../types'
import { uid } from '../lib/id'
import { coordKey, pointInPolygon, pointOnSegment, type Vec2 } from '../lib/geometry'
import { defaultDomain } from '../lib/defaults'
import { materialColor } from '../constants/materials'
import { autoBoundaryFlag } from '../poly/boundary'
import { detectFaces } from '../poly/faces'

export type Tool = 'select' | 'point' | 'line' | 'pan'
export type SelectableKind = 'point' | 'segment' | 'region' | 'face'
export type MarqueeTarget = 'point' | 'segment' | 'face'

export interface Selection {
  pointIds: string[]
  segmentIds: string[]
  faceIds: string[]
  regionIds: string[]
}

const KIND_KEY: Record<SelectableKind, keyof Selection> = {
  point: 'pointIds',
  segment: 'segmentIds',
  region: 'regionIds',
  face: 'faceIds',
}

export const emptySelection = (): Selection => ({
  pointIds: [],
  segmentIds: [],
  faceIds: [],
  regionIds: [],
})

export interface AddLineResult {
  segmentId: string | null
  createdPointIds: string[]
  error?: string
}

export interface EditorState {
  domain: Domain
  points: Point[]
  segments: Segment[]
  regions: Region[]
  materials: Material[]
  /** Derived closed faces (recomputed on geometry change). */
  faces: Face[]
  selection: Selection
  tool: Tool
  /** Which element type a marquee (rubber-band) drag selects by default. */
  marqueeTarget: MarqueeTarget
  /** Point id of the in-progress line's first endpoint (line tool). */
  pendingLineStart: string | null
  /** Bumped to ask the canvas to fit the view to the domain. */
  fitNonce: number

  // View & tools
  requestFit: () => void
  setTool: (tool: Tool) => void
  setMarqueeTarget: (t: MarqueeTarget) => void
  setPendingLineStart: (id: string | null) => void

  // Derived faces
  recomputeFaces: () => void

  // Selection helpers
  selectSingle: (kind: SelectableKind, id: string) => void
  selectMany: (kind: SelectableKind, ids: string[]) => void
  toggleSelect: (kind: SelectableKind, id: string) => void
  deleteSelection: () => void
  /** Move the current selection by one (or 10x) grid step along a unit direction. */
  nudgeSelection: (dirX: number, dirZ: number, large: boolean) => void

  // Geometry mutations
  addPoint: (x: number, z: number) => string
  movePoint: (id: string, x: number, z: number) => void
  updatePoint: (id: string, patch: Partial<Pick<Point, 'x' | 'z'>>) => void
  addSegment: (p0: string, p1: string, bdryFlag?: number) => string | null
  /** Split any existing segment whose interior the point lies on (T-junction noding). */
  splitSegmentsAt: (pointId: string) => void
  addLineByCoords: (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    autoCreate: boolean,
  ) => AddLineResult
  updateSegment: (id: string, patch: Partial<Pick<Segment, 'bdryFlag'>>) => void
  setSegmentFlag: (ids: string[], flag: number) => void
  autoAssignBoundaryFlags: (ids?: string[]) => void
  addRegion: (x: number, z: number, mattype?: number, size?: number) => string
  updateRegion: (id: string, patch: Partial<Omit<Region, 'id'>>) => void
  /** Assign material/size to the region inside each face (creating a seed if needed). */
  applyFaceMaterial: (faceIds: string[], patch: { mattype?: number; size?: number }) => void
  removePoints: (ids: string[]) => void
  removeSegments: (ids: string[]) => void
  removeRegions: (ids: string[]) => void
  /** Remove region seeds that no longer sit inside any detected face. */
  removeOrphanRegions: () => void

  // Domain & materials
  setDomain: (patch: Partial<Domain>) => void
  ensureMaterial: (mattype: number) => void
  setMaterial: (mattype: number, patch: Partial<Omit<Material, 'mattype'>>) => void

  // Selection
  setSelection: (sel: Partial<Selection>) => void
  clearSelection: () => void

  // Document I/O
  loadDocument: (doc: PolyDocument) => void
  toDocument: () => PolyDocument
  reset: () => void
}

function findPointByCoord(points: Point[], x: number, z: number): Point | undefined {
  const key = coordKey(x, z)
  return points.find((p) => coordKey(p.x, p.z) === key)
}

function segmentExists(segments: Segment[], a: string, b: string): boolean {
  return segments.some(
    (s) => (s.p0 === a && s.p1 === b) || (s.p0 === b && s.p1 === a),
  )
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
  domain: defaultDomain(),
  points: [],
  segments: [],
  regions: [],
  materials: [],
  faces: [],
  selection: emptySelection(),
  tool: 'select',
  marqueeTarget: 'point',
  pendingLineStart: null,
  fitNonce: 0,

  requestFit: () => set((s) => ({ fitNonce: s.fitNonce + 1 })),
  setTool: (tool) =>
    set((s) => ({ tool, pendingLineStart: tool === 'line' ? s.pendingLineStart : null })),
  setMarqueeTarget: (t) => set({ marqueeTarget: t }),
  setPendingLineStart: (id) => set({ pendingLineStart: id }),

  recomputeFaces: () =>
    set((s) => {
      const faces = detectFaces(s.points, s.segments)
      const valid = new Set(faces.map((f) => f.id))
      return {
        faces,
        selection: {
          ...s.selection,
          faceIds: s.selection.faceIds.filter((id) => valid.has(id)),
        },
      }
    }),

  selectSingle: (kind, id) => {
    const sel = emptySelection()
    sel[KIND_KEY[kind]] = [id]
    set({ selection: sel })
  },

  selectMany: (kind, ids) => {
    const sel = emptySelection()
    sel[KIND_KEY[kind]] = ids
    set({ selection: sel })
  },

  toggleSelect: (kind, id) => {
    set((s) => {
      const key = KIND_KEY[kind]
      // Keep selection single-kind: toggling a different type starts fresh with it.
      const hasOtherKind = (Object.keys(KIND_KEY) as SelectableKind[]).some(
        (k) => k !== kind && s.selection[KIND_KEY[k]].length > 0,
      )
      const arr = hasOtherKind ? [] : s.selection[key]
      const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
      const sel = emptySelection()
      sel[key] = next
      return { selection: sel }
    })
  },

  deleteSelection: () => {
    const sel = get().selection
    if (sel.pointIds.length) get().removePoints(sel.pointIds)
    if (sel.segmentIds.length) get().removeSegments(sel.segmentIds)
    if (sel.regionIds.length) get().removeRegions(sel.regionIds)
    get().clearSelection()
  },

  nudgeSelection: (dirX, dirZ, large) => {
    const s = get()
    const sel = s.selection
    const hasSel =
      sel.pointIds.length || sel.segmentIds.length || sel.faceIds.length || sel.regionIds.length
    if (!hasSel) return
    const step = s.domain.gridSpacing * (large ? 10 : 1)
    const dx = dirX * step
    const dz = dirZ * step

    // Every point referenced by the selection (directly, or via segments/faces) moves once.
    const movePts = new Set<string>(sel.pointIds)
    const segById = new Map(s.segments.map((seg) => [seg.id, seg]))
    for (const id of sel.segmentIds) {
      const seg = segById.get(id)
      if (seg) {
        movePts.add(seg.p0)
        movePts.add(seg.p1)
      }
    }
    const faceById = new Map(s.faces.map((f) => [f.id, f]))
    for (const id of sel.faceIds) {
      faceById.get(id)?.pointIds.forEach((pid) => movePts.add(pid))
    }
    const moveRegions = new Set(sel.regionIds)

    set((st) => ({
      points: st.points.map((p) =>
        movePts.has(p.id) ? { ...p, x: p.x + dx, z: p.z + dz } : p,
      ),
      regions: st.regions.map((r) =>
        moveRegions.has(r.id) ? { ...r, x: r.x + dx, z: r.z + dz } : r,
      ),
    }))
    get().recomputeFaces()
  },

  addPoint: (x, z) => {
    const existing = findPointByCoord(get().points, x, z)
    if (existing) return existing.id
    const id = uid('p')
    set((s) => ({ points: [...s.points, { id, x, z }] }))
    // Node any edge this point lands on so faces split correctly.
    get().splitSegmentsAt(id)
    return id
  },

  movePoint: (id, x, z) => {
    set((s) => ({
      points: s.points.map((p) => (p.id === id ? { ...p, x, z } : p)),
    }))
    get().recomputeFaces()
  },

  updatePoint: (id, patch) => {
    set((s) => ({
      points: s.points.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
    get().recomputeFaces()
  },

  addSegment: (p0, p1, bdryFlag = 0) => {
    if (p0 === p1) return null
    if (segmentExists(get().segments, p0, p1)) return null
    const id = uid('s')
    set((s) => ({ segments: [...s.segments, { id, p0, p1, bdryFlag }] }))
    get().recomputeFaces()
    return id
  },

  splitSegmentsAt: (pointId) => {
    const { points, segments } = get()
    const p = points.find((pt) => pt.id === pointId)
    if (!p) return
    const byId = new Map(points.map((pt) => [pt.id, pt]))
    const hits = segments.filter((s) => {
      if (s.p0 === pointId || s.p1 === pointId) return false
      const a = byId.get(s.p0)
      const b = byId.get(s.p1)
      return a !== undefined && b !== undefined && pointOnSegment(p, a, b)
    })
    if (hits.length === 0) return
    const hitIds = new Set(hits.map((s) => s.id))
    const added = hits.flatMap((s) => [
      { id: uid('s'), p0: s.p0, p1: pointId, bdryFlag: s.bdryFlag },
      { id: uid('s'), p0: pointId, p1: s.p1, bdryFlag: s.bdryFlag },
    ])
    set((s) => ({
      segments: [...s.segments.filter((seg) => !hitIds.has(seg.id)), ...added],
      selection: {
        ...s.selection,
        segmentIds: s.selection.segmentIds.filter((id) => !hitIds.has(id)),
      },
    }))
    get().recomputeFaces()
  },

  addLineByCoords: (x1, z1, x2, z2, autoCreate) => {
    const created: string[] = []
    const resolve = (x: number, z: number): string | null => {
      const existing = findPointByCoord(get().points, x, z)
      if (existing) return existing.id
      if (!autoCreate) return null
      const id = get().addPoint(x, z)
      created.push(id)
      return id
    }
    const a = resolve(x1, z1)
    const b = resolve(x2, z2)
    if (a === null || b === null) {
      // Roll back any points created during this failed call.
      if (created.length) get().removePoints(created)
      return {
        segmentId: null,
        createdPointIds: [],
        error: 'Endpoint does not match an existing point (enable auto-create).',
      }
    }
    const segmentId = get().addSegment(a, b)
    return { segmentId, createdPointIds: created }
  },

  updateSegment: (id, patch) => {
    set((s) => ({
      segments: s.segments.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)),
    }))
  },

  setSegmentFlag: (ids, flag) => {
    const idSet = new Set(ids)
    set((s) => ({
      segments: s.segments.map((seg) => (idSet.has(seg.id) ? { ...seg, bdryFlag: flag } : seg)),
    }))
  },

  autoAssignBoundaryFlags: (ids) => {
    const { points, domain } = get()
    const byId = new Map(points.map((p) => [p.id, p]))
    const target = ids ? new Set(ids) : null
    set((s) => ({
      segments: s.segments.map((seg) => {
        if (target && !target.has(seg.id)) return seg
        const a = byId.get(seg.p0)
        const b = byId.get(seg.p1)
        if (!a || !b) return seg
        return { ...seg, bdryFlag: autoBoundaryFlag(a, b, domain) }
      }),
    }))
  },

  addRegion: (x, z, mattype = 0, size = -1) => {
    const id = uid('r')
    get().ensureMaterial(mattype)
    set((s) => ({ regions: [...s.regions, { id, x, z, mattype, size }] }))
    return id
  },

  updateRegion: (id, patch) => {
    if (patch.mattype !== undefined) get().ensureMaterial(patch.mattype)
    set((s) => ({
      regions: s.regions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }))
  },

  applyFaceMaterial: (faceIds, patch) => {
    const { faces, points } = get()
    const byId = new Map(points.map((p) => [p.id, p]))
    for (const fid of faceIds) {
      const face = faces.find((f) => f.id === fid)
      if (!face) continue
      const verts: Vec2[] = face.pointIds
        .map((pid) => byId.get(pid))
        .filter((p): p is Point => Boolean(p))
        .map((p) => ({ x: p.x, z: p.z }))
      const region = get().regions.find((r) => pointInPolygon({ x: r.x, z: r.z }, verts))
      if (region) {
        get().updateRegion(region.id, patch)
      } else {
        get().addRegion(face.centroid.x, face.centroid.z, patch.mattype ?? 0, patch.size ?? -1)
      }
    }
  },

  removePoints: (ids) => {
    const idSet = new Set(ids)
    set((s) => ({
      points: s.points.filter((p) => !idSet.has(p.id)),
      // Cascade: drop segments that referenced a removed point.
      segments: s.segments.filter((seg) => !idSet.has(seg.p0) && !idSet.has(seg.p1)),
      selection: {
        ...s.selection,
        pointIds: s.selection.pointIds.filter((id) => !idSet.has(id)),
      },
      pendingLineStart:
        s.pendingLineStart && idSet.has(s.pendingLineStart) ? null : s.pendingLineStart,
    }))
    get().recomputeFaces()
  },

  removeSegments: (ids) => {
    const idSet = new Set(ids)
    set((s) => ({
      segments: s.segments.filter((seg) => !idSet.has(seg.id)),
      selection: {
        ...s.selection,
        segmentIds: s.selection.segmentIds.filter((id) => !idSet.has(id)),
      },
    }))
    get().recomputeFaces()
  },

  removeRegions: (ids) => {
    const idSet = new Set(ids)
    set((s) => ({
      regions: s.regions.filter((r) => !idSet.has(r.id)),
      selection: {
        ...s.selection,
        regionIds: s.selection.regionIds.filter((id) => !idSet.has(id)),
      },
    }))
  },

  removeOrphanRegions: () => {
    const { regions, faces, points } = get()
    const byId = new Map(points.map((p) => [p.id, p]))
    const faceVerts = faces.map((f) =>
      f.pointIds
        .map((id) => byId.get(id))
        .filter((p): p is Point => p !== undefined)
        .map((p) => ({ x: p.x, z: p.z })),
    )
    const orphanIds = regions
      .filter((r) => !faceVerts.some((verts) => pointInPolygon({ x: r.x, z: r.z }, verts)))
      .map((r) => r.id)
    if (orphanIds.length > 0) get().removeRegions(orphanIds)
  },

  setDomain: (patch) => set((s) => ({ domain: { ...s.domain, ...patch } })),

  ensureMaterial: (mattype) => {
    if (get().materials.some((m) => m.mattype === mattype)) return
    set((s) => ({
      materials: [...s.materials, { mattype, color: materialColor(mattype) }].sort(
        (a, b) => a.mattype - b.mattype,
      ),
    }))
  },

  setMaterial: (mattype, patch) => {
    set((s) => ({
      materials: s.materials.map((m) => (m.mattype === mattype ? { ...m, ...patch } : m)),
    }))
  },

  setSelection: (sel) => set((s) => ({ selection: { ...s.selection, ...sel } })),

  clearSelection: () => set({ selection: emptySelection() }),

  loadDocument: (doc) => {
    set((s) => ({
      domain: doc.domain,
      points: doc.points,
      segments: doc.segments,
      regions: doc.regions,
      materials: doc.materials,
      selection: emptySelection(),
      pendingLineStart: null,
      fitNonce: s.fitNonce + 1,
    }))
    get().recomputeFaces()
  },

  toDocument: () => {
    const s = get()
    return {
      domain: s.domain,
      points: s.points,
      segments: s.segments,
      regions: s.regions,
      materials: s.materials,
    }
  },

  reset: () =>
    set({
      domain: defaultDomain(),
      points: [],
      segments: [],
      regions: [],
      materials: [],
      faces: [],
      selection: emptySelection(),
      pendingLineStart: null,
    }),
    }),
    {
      // Only geometry is undoable; selection/tool/faces are derived or transient.
      partialize: (s) => ({
        domain: s.domain,
        points: s.points,
        segments: s.segments,
        regions: s.regions,
        materials: s.materials,
      }),
      limit: 100,
      equality: (a, b) =>
        a.points === b.points &&
        a.segments === b.segments &&
        a.regions === b.regions &&
        a.materials === b.materials &&
        a.domain === b.domain,
    },
  ),
)

/** Undo the last geometry change and refresh derived faces. */
export function undoEdit() {
  useEditorStore.temporal.getState().undo()
  useEditorStore.getState().recomputeFaces()
  useEditorStore.getState().clearSelection()
}

/** Redo the last undone geometry change and refresh derived faces. */
export function redoEdit() {
  useEditorStore.temporal.getState().redo()
  useEditorStore.getState().recomputeFaces()
  useEditorStore.getState().clearSelection()
}
