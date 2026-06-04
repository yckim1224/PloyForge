import { create } from 'zustand'
import type { Domain, Material, Point, PolyDocument, Region, Segment } from '../types'
import { uid } from '../lib/id'
import { coordKey } from '../lib/geometry'
import { defaultDomain } from '../lib/defaults'
import { materialColor } from '../constants/materials'

export interface Selection {
  pointIds: string[]
  segmentIds: string[]
  faceIds: string[]
  regionIds: string[]
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
  selection: Selection
  /** Bumped to ask the canvas to fit the view to the domain. */
  fitNonce: number

  // View
  requestFit: () => void

  // Geometry mutations
  addPoint: (x: number, z: number) => string
  movePoint: (id: string, x: number, z: number) => void
  updatePoint: (id: string, patch: Partial<Pick<Point, 'x' | 'z'>>) => void
  addSegment: (p0: string, p1: string, bdryFlag?: number) => string | null
  addLineByCoords: (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    autoCreate: boolean,
  ) => AddLineResult
  updateSegment: (id: string, patch: Partial<Pick<Segment, 'bdryFlag'>>) => void
  addRegion: (x: number, z: number, mattype?: number, size?: number) => string
  updateRegion: (id: string, patch: Partial<Omit<Region, 'id'>>) => void
  removePoints: (ids: string[]) => void
  removeSegments: (ids: string[]) => void
  removeRegions: (ids: string[]) => void

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

export const useEditorStore = create<EditorState>((set, get) => ({
  domain: defaultDomain(),
  points: [],
  segments: [],
  regions: [],
  materials: [],
  selection: emptySelection(),
  fitNonce: 0,

  requestFit: () => set((s) => ({ fitNonce: s.fitNonce + 1 })),

  addPoint: (x, z) => {
    const existing = findPointByCoord(get().points, x, z)
    if (existing) return existing.id
    const id = uid('p')
    set((s) => ({ points: [...s.points, { id, x, z }] }))
    return id
  },

  movePoint: (id, x, z) => {
    set((s) => ({
      points: s.points.map((p) => (p.id === id ? { ...p, x, z } : p)),
    }))
  },

  updatePoint: (id, patch) => {
    set((s) => ({
      points: s.points.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  },

  addSegment: (p0, p1, bdryFlag = 0) => {
    if (p0 === p1) return null
    if (segmentExists(get().segments, p0, p1)) return null
    const id = uid('s')
    set((s) => ({ segments: [...s.segments, { id, p0, p1, bdryFlag }] }))
    return id
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
    }))
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

  loadDocument: (doc) =>
    set((s) => ({
      domain: doc.domain,
      points: doc.points,
      segments: doc.segments,
      regions: doc.regions,
      materials: doc.materials,
      selection: emptySelection(),
      fitNonce: s.fitNonce + 1,
    })),

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
      selection: emptySelection(),
    }),
}))
