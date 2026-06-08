import { create } from 'zustand'
import { temporal } from 'zundo'
import type { Face, Line, Point, PolyDocument } from '../types'
import { uid } from '../lib/id'
import {
  coordKey,
  pointOnSegment,
  projectToSegment,
  segmentIntersection,
  type Vec2,
} from '../lib/geometry'
import { autoBoundaryFlag, type BoundingBox } from '../poly/boundary'
import { detectFaces } from '../poly/faces'
import { useSettingsStore } from './settingsStore'

/** Convex envelope of the supplied points; an empty array yields a zero-extent box at the origin. */
function pointsBoundingBox(points: Point[]): BoundingBox {
  if (points.length === 0) return { xmin: 0, xmax: 0, zmin: 0, zmax: 0 }
  let xmin = points[0].x
  let xmax = xmin
  let zmin = points[0].z
  let zmax = zmin
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    if (p.x < xmin) xmin = p.x
    else if (p.x > xmax) xmax = p.x
    if (p.z < zmin) zmin = p.z
    else if (p.z > zmax) zmax = p.z
  }
  return { xmin, xmax, zmin, zmax }
}

export type Tool = 'select' | 'point' | 'line' | 'pan'
export type SelectableKind = 'point' | 'line' | 'face'
export type MarqueeTarget = 'point' | 'line' | 'face'

export interface Selection {
  pointIds: string[]
  lineIds: string[]
  faceIds: string[]
}

const KIND_KEY: Record<SelectableKind, keyof Selection> = {
  point: 'pointIds',
  line: 'lineIds',
  face: 'faceIds',
}

export const emptySelection = (): Selection => ({
  pointIds: [],
  lineIds: [],
  faceIds: [],
})

export interface AddLineResult {
  lineId: string | null
  createdPointIds: string[]
  error?: string
}

export interface EditorState {
  points: Point[]
  lines: Line[]
  /** Face-keyed material/size map. Stale keys (no matching face) are kept; they
   *  auto-resurrect if the same face reforms (e.g. an Undo). */
  faceTypes: Record<string, { mattype: number; size: number }>
  /** Derived closed faces (recomputed on geometry change). */
  faces: Face[]
  selection: Selection
  tool: Tool
  /** Which element type a marquee (rubber-band) drag selects by default. */
  marqueeTarget: MarqueeTarget
  /** Point id of the in-progress line's first endpoint (line tool). */
  pendingLineStart: string | null
  /** Bumped to ask the canvas to fit the view to the current points. */
  fitNonce: number
  /** Bumped to ask the Actions panel to run an Export (keyboard Cmd/Ctrl+S). */
  exportNonce: number

  // View & tools
  requestFit: () => void
  /** Trigger an Export from outside the Actions panel (keyboard shortcut). */
  requestExport: () => void
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
  /** Translate the current selection by an arbitrary world delta (mouse-drag commit). */
  translateSelectionBy: (dx: number, dz: number) => void

  // Geometry mutations
  addPoint: (x: number, z: number) => string
  /**
   * Insert a point at a specific display position. `index === null` or
   * `>= points.length` appends (delegates to addPoint logic). Otherwise the
   * point is spliced so existing items shift right; line p0/p1 uids are
   * preserved (only display indices change).
   */
  insertPoint: (index: number | null, x: number, z: number) => string
  movePoint: (id: string, x: number, z: number) => void
  updatePoint: (id: string, patch: Partial<Pick<Point, 'x' | 'z'>>) => void
  addLine: (p0: string, p1: string, bdryFlag?: number) => string | null
  /**
   * Insert a line at a specific display position. Validation matches
   * `addLine` (self-loops and duplicate pairs rejected). Returns the new uid
   * or null when rejected.
   */
  insertLine: (
    index: number | null,
    p0: string,
    p1: string,
    bdryFlag?: number,
  ) => string | null
  /**
   * Split every line at any point lying on its interior (T-junction noding),
   * so polygonize sees a conforming PSLG. Returns true if anything was split.
   */
  renode: () => boolean
  addLineByCoords: (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    autoCreate: boolean,
  ) => AddLineResult
  updateLine: (id: string, patch: Partial<Pick<Line, 'bdryFlag' | 'p0' | 'p1'>>) => void
  setLineFlag: (ids: string[], flag: number) => void
  autoAssignBoundaryFlags: (ids?: string[]) => void
  removePoints: (ids: string[]) => void
  removeLines: (ids: string[]) => void
  /** Move a point to a new display slot; the surrounding rows shift to fill. */
  movePointToIndex: (id: string, index: number) => void
  /** Move a line to a new display slot; the surrounding rows shift to fill. */
  moveLineToIndex: (id: string, index: number) => void
  /**
   * Reorder the points array by a coordinate key. Default ascending; pass
   * `desc` to reverse. Screen convention: ascending x = left -> right,
   * descending z = top -> bottom (z=0 is the surface; smaller z is deeper).
   */
  sortPointsBy: (key: 'x' | 'z', direction?: 'asc' | 'desc') => void
  /** Drop every point that no line references. */
  removeIsolatedPoints: () => void
  /** Remove every point (and cascade-remove every line that referenced one). */
  removeAllPoints: () => void
  /** Remove every line; points and face-type assignments stay. */
  removeAllLines: () => void
  /** Drop every line that is not part of any detected face's boundary. */
  removeNonFaceLines: () => void

  // Face Types (face-keyed material/size map)
  setFaceType: (faceId: string, mattype: number, size?: number) => void
  clearFaceType: (faceId: string) => void

  // Selection
  setSelection: (sel: Partial<Selection>) => void
  clearSelection: () => void

  // Document I/O
  loadDocument: (doc: PolyDocument, discoveredMaterials?: number[]) => void
  toDocument: () => PolyDocument
  reset: () => void
}

function findPointByCoord(points: Point[], x: number, z: number): Point | undefined {
  const key = coordKey(x, z)
  return points.find((p) => coordKey(p.x, p.z) === key)
}

function lineExists(lines: Line[], a: string, b: string): boolean {
  return lines.some(
    (s) => (s.p0 === a && s.p1 === b) || (s.p0 === b && s.p1 === a),
  )
}

/**
 * Every point id referenced by the current selection: selected points directly,
 * both endpoints of selected lines, and every vertex of selected faces. Faces are
 * keyed by sorted point ids, so translating all of a face's vertices together
 * preserves its faceId (and thus its faceTypes entry). Shared by nudgeSelection
 * and translateSelectionBy.
 */
export function collectSelectionPointIds(
  s: Pick<EditorState, 'selection' | 'lines' | 'faces'>,
): Set<string> {
  const ids = new Set<string>(s.selection.pointIds)
  const lineById = new Map(s.lines.map((seg) => [seg.id, seg]))
  for (const id of s.selection.lineIds) {
    const seg = lineById.get(id)
    if (seg) {
      ids.add(seg.p0)
      ids.add(seg.p1)
    }
  }
  const faceById = new Map(s.faces.map((f) => [f.id, f]))
  for (const id of s.selection.faceIds) {
    faceById.get(id)?.pointIds.forEach((pid) => ids.add(pid))
  }
  return ids
}

/** Return a copy of `points` with every id in `ids` shifted by (dx, dz). */
function translatePoints(points: Point[], ids: Set<string>, dx: number, dz: number): Point[] {
  return points.map((p) => (ids.has(p.id) ? { ...p, x: p.x + dx, z: p.z + dz } : p))
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
  points: [],
  lines: [],
  faceTypes: {},
  faces: [],
  selection: emptySelection(),
  tool: 'select',
  marqueeTarget: 'point',
  pendingLineStart: null,
  fitNonce: 0,
  exportNonce: 0,

  requestFit: () => set((s) => ({ fitNonce: s.fitNonce + 1 })),
  requestExport: () => set((s) => ({ exportNonce: s.exportNonce + 1 })),
  setTool: (tool) =>
    set((s) => ({ tool, pendingLineStart: tool === 'line' ? s.pendingLineStart : null })),
  setMarqueeTarget: (t) => set({ marqueeTarget: t }),
  setPendingLineStart: (id) => set({ pendingLineStart: id }),

  recomputeFaces: () =>
    set((s) => {
      const detected = detectFaces(s.points, s.lines)
      // Resolve Type from the face-keyed map. Stale entries (faceId not in
      // current detection set) stay in faceTypes for resurrection on reform.
      const faces: Face[] = detected.map((f) => {
        const spec = s.faceTypes[f.id]
        return spec
          ? { ...f, mattype: spec.mattype, size: spec.size }
          : f
      })
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
    if (sel.lineIds.length) get().removeLines(sel.lineIds)
    get().clearSelection()
  },

  nudgeSelection: (dirX, dirZ, large) => {
    const movePts = collectSelectionPointIds(get())
    if (movePts.size === 0) return
    const spacing = useSettingsStore.getState().grid.spacing
    const step = spacing * (large ? 10 : 1)
    const dx = dirX * step
    const dz = dirZ * step
    set((st) => ({ points: translatePoints(st.points, movePts, dx, dz) }))
    get().recomputeFaces()
  },

  translateSelectionBy: (dx, dz) => {
    if (dx === 0 && dz === 0) return
    const movePts = collectSelectionPointIds(get())
    if (movePts.size === 0) return
    set((st) => ({ points: translatePoints(st.points, movePts, dx, dz) }))
    // Topology is finalized only here (on the drag-end commit), matching point
    // placement / line drawing. renode + recompute run in the same synchronous
    // burst as the move, so handleSet batching records exactly one undo entry.
    get().renode()
    get().recomputeFaces()
  },

  addPoint: (x, z) => {
    const existing = findPointByCoord(get().points, x, z)
    if (existing) return existing.id
    const id = uid('p')
    set((s) => ({ points: [...s.points, { id, x, z }] }))
    // An isolated point never changes faces; only recompute if it nodes an edge.
    if (get().renode()) get().recomputeFaces()
    return id
  },

  insertPoint: (index, x, z) => {
    // Dedupe matches addPoint's existing-coordinate fast path so callers can
    // rely on idempotent inserts.
    const existing = findPointByCoord(get().points, x, z)
    if (existing) return existing.id
    const points = get().points
    const append = index === null || index >= points.length
    if (append) return get().addPoint(x, z)
    const id = uid('p')
    const k = Math.max(0, index as number)
    set((s) => ({ points: [...s.points.slice(0, k), { id, x, z }, ...s.points.slice(k)] }))
    if (get().renode()) get().recomputeFaces()
    return id
  },

  movePoint: (id, x, z) => {
    set((s) => ({
      points: s.points.map((p) => (p.id === id ? { ...p, x, z } : p)),
    }))
    get().renode()
    get().recomputeFaces()
  },

  updatePoint: (id, patch) => {
    set((s) => ({
      points: s.points.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
    get().renode()
    get().recomputeFaces()
  },

  addLine: (p0, p1, bdryFlag = 0) => {
    if (p0 === p1) return null
    if (lineExists(get().lines, p0, p1)) return null
    const id = uid('s')
    set((s) => ({ lines: [...s.lines, { id, p0, p1, bdryFlag }] }))
    // The new line may pass through existing points; node it before meshing.
    get().renode()
    get().recomputeFaces()
    return id
  },

  insertLine: (index, p0, p1, bdryFlag = 0) => {
    if (p0 === p1) return null
    if (lineExists(get().lines, p0, p1)) return null
    const lines = get().lines
    const append = index === null || index >= lines.length
    if (append) return get().addLine(p0, p1, bdryFlag)
    const id = uid('s')
    const k = Math.max(0, index as number)
    set((s) => ({
      lines: [...s.lines.slice(0, k), { id, p0, p1, bdryFlag }, ...s.lines.slice(k)],
    }))
    get().renode()
    get().recomputeFaces()
    return id
  },

  renode: () => {
    // PSLG conformity has two pieces:
    //   (A) every proper segment-segment crossing must materialize as a point
    //       so face detection can see four sub-regions instead of one.
    //   (B) any point on a segment's interior must split that segment.
    // Phase A inserts the missing intersection points; Phase B then runs the
    // existing T-junction split. Splitting along an already-resolved crossing
    // does not introduce new crossings, so a single pass over both phases is
    // sufficient.

    // ----- Phase A: insert points at proper crossings --------------------
    {
      const pts = get().points
      const lines = get().lines
      const byIdA = new Map(pts.map((p) => [p.id, p]))
      const candidates: Vec2[] = []
      for (let i = 0; i < lines.length; i++) {
        const si = lines[i]
        const ai = byIdA.get(si.p0)
        const bi = byIdA.get(si.p1)
        if (!ai || !bi) continue
        for (let j = i + 1; j < lines.length; j++) {
          const sj = lines[j]
          // Shared endpoints don't count as crossings.
          if (si.p0 === sj.p0 || si.p0 === sj.p1 || si.p1 === sj.p0 || si.p1 === sj.p1)
            continue
          const aj = byIdA.get(sj.p0)
          const bj = byIdA.get(sj.p1)
          if (!aj || !bj) continue
          const hit = segmentIntersection(ai, bi, aj, bj)
          if (hit) candidates.push(hit)
        }
      }
      if (candidates.length > 0) {
        // Dedupe against existing points and against other candidates in the
        // batch via the same coordKey tolerance addPoint uses, so multiple
        // lines meeting at one spot collapse to a single new point.
        const seenKeys = new Set(pts.map((p) => coordKey(p.x, p.z)))
        const additions: Point[] = []
        for (const c of candidates) {
          const k = coordKey(c.x, c.z)
          if (seenKeys.has(k)) continue
          seenKeys.add(k)
          additions.push({ id: uid('p'), x: c.x, z: c.z })
        }
        if (additions.length > 0) {
          set((s) => ({ points: [...s.points, ...additions] }))
        }
      }
    }

    // ----- Phase B: T-junction noding ------------------------------------
    const points = get().points
    const byId = new Map(points.map((p) => [p.id, p]))
    const next: Line[] = []
    let changed = false
    for (const s of get().lines) {
      const a = byId.get(s.p0)
      const b = byId.get(s.p1)
      if (!a || !b) {
        next.push(s)
        continue
      }
      const interior = points
        .filter((pt) => pt.id !== s.p0 && pt.id !== s.p1 && pointOnSegment(pt, a, b))
        .map((pt) => ({ id: pt.id, t: projectToSegment(pt, a, b).t }))
        .sort((m, n) => m.t - n.t)
      if (interior.length === 0) {
        next.push(s)
        continue
      }
      changed = true
      const chain = [s.p0, ...interior.map((i) => i.id), s.p1]
      for (let k = 0; k + 1 < chain.length; k++) {
        next.push({ id: uid('s'), p0: chain[k], p1: chain[k + 1], bdryFlag: s.bdryFlag })
      }
    }
    if (!changed) return false
    // Splitting can produce a piece coinciding with another line; keep one.
    const seen = new Set<string>()
    const deduped = next.filter((s) => {
      const key = s.p0 < s.p1 ? `${s.p0}|${s.p1}` : `${s.p1}|${s.p0}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const validIds = new Set(deduped.map((s) => s.id))
    set((st) => ({
      lines: deduped,
      selection: {
        ...st.selection,
        lineIds: st.selection.lineIds.filter((id) => validIds.has(id)),
      },
    }))
    return true
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
        lineId: null,
        createdPointIds: [],
        error: 'Endpoint does not match an existing point (enable auto-create).',
      }
    }
    const lineId = get().addLine(a, b)
    if (lineId === null) {
      // Roll back auto-created points so a rejected line leaves no orphans.
      if (created.length) get().removePoints(created)
      return {
        lineId: null,
        createdPointIds: [],
        error: a === b ? 'Endpoints coincide; no line added.' : 'That segment already exists.',
      }
    }
    return { lineId, createdPointIds: created }
  },

  updateLine: (id, patch) => {
    set((s) => ({
      lines: s.lines.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)),
    }))
    // Endpoint swaps change topology; flag-only edits don't, but renode
    // short-circuits when nothing intersects, so a single guarded call is fine.
    if (patch.p0 !== undefined || patch.p1 !== undefined) {
      get().renode()
      get().recomputeFaces()
    }
  },

  setLineFlag: (ids, flag) => {
    const idSet = new Set(ids)
    set((s) => ({
      lines: s.lines.map((seg) => (idSet.has(seg.id) ? { ...seg, bdryFlag: flag } : seg)),
    }))
  },

  autoAssignBoundaryFlags: (ids) => {
    const { points } = get()
    if (points.length === 0) {
      const target = ids ? new Set(ids) : null
      set((s) => ({
        lines: s.lines.map((seg) => (target && !target.has(seg.id) ? seg : { ...seg, bdryFlag: 0 })),
      }))
      return
    }
    const bbox = pointsBoundingBox(points)
    const byId = new Map(points.map((p) => [p.id, p]))
    const target = ids ? new Set(ids) : null
    set((s) => ({
      lines: s.lines.map((seg) => {
        if (target && !target.has(seg.id)) return seg
        const a = byId.get(seg.p0)
        const b = byId.get(seg.p1)
        if (!a || !b) return seg
        return { ...seg, bdryFlag: autoBoundaryFlag(a, b, bbox) }
      }),
    }))
  },

  removePoints: (ids) => {
    const idSet = new Set(ids)
    set((s) => ({
      points: s.points.filter((p) => !idSet.has(p.id)),
      // Cascade: drop lines that referenced a removed point.
      lines: s.lines.filter((seg) => !idSet.has(seg.p0) && !idSet.has(seg.p1)),
      selection: {
        ...s.selection,
        pointIds: s.selection.pointIds.filter((id) => !idSet.has(id)),
      },
      pendingLineStart:
        s.pendingLineStart && idSet.has(s.pendingLineStart) ? null : s.pendingLineStart,
    }))
    get().recomputeFaces()
  },

  removeLines: (ids) => {
    const idSet = new Set(ids)
    set((s) => ({
      lines: s.lines.filter((seg) => !idSet.has(seg.id)),
      selection: {
        ...s.selection,
        lineIds: s.selection.lineIds.filter((id) => !idSet.has(id)),
      },
    }))
    get().recomputeFaces()
  },

  movePointToIndex: (id, index) => {
    set((s) => {
      const cur = s.points.findIndex((p) => p.id === id)
      if (cur < 0) return {}
      const target = Math.max(0, Math.min(s.points.length - 1, index))
      if (cur === target) return {}
      const next = s.points.slice()
      const [item] = next.splice(cur, 1)
      next.splice(target, 0, item)
      return { points: next }
    })
  },

  moveLineToIndex: (id, index) => {
    set((s) => {
      const cur = s.lines.findIndex((l) => l.id === id)
      if (cur < 0) return {}
      const target = Math.max(0, Math.min(s.lines.length - 1, index))
      if (cur === target) return {}
      const next = s.lines.slice()
      const [item] = next.splice(cur, 1)
      next.splice(target, 0, item)
      return { lines: next }
    })
  },

  sortPointsBy: (key, direction = 'asc') => {
    const sign = direction === 'desc' ? -1 : 1
    set((s) => ({ points: [...s.points].sort((a, b) => sign * (a[key] - b[key])) }))
  },

  removeIsolatedPoints: () => {
    const { points, lines } = get()
    const used = new Set<string>()
    for (const l of lines) {
      used.add(l.p0)
      used.add(l.p1)
    }
    const orphans = points.filter((p) => !used.has(p.id)).map((p) => p.id)
    if (orphans.length > 0) get().removePoints(orphans)
  },

  removeAllPoints: () => {
    const ids = get().points.map((p) => p.id)
    if (ids.length > 0) get().removePoints(ids)
  },

  removeAllLines: () => {
    const ids = get().lines.map((l) => l.id)
    if (ids.length > 0) get().removeLines(ids)
  },

  removeNonFaceLines: () => {
    const { lines, faces } = get()
    const inSomeFace = new Set<string>()
    for (const f of faces) for (const lid of f.lineIds) inSomeFace.add(lid)
    const orphans = lines.filter((l) => !inSomeFace.has(l.id)).map((l) => l.id)
    if (orphans.length > 0) get().removeLines(orphans)
  },

  setFaceType: (faceId, mattype, size = -1) => {
    // Ensure the settings store has a color entry for this mattype (non-overwriting).
    useSettingsStore.getState().ensureMaterial(mattype)
    set((s) => ({
      faceTypes: { ...s.faceTypes, [faceId]: { mattype, size } },
    }))
    get().recomputeFaces()
  },

  clearFaceType: (faceId) => {
    set((s) => {
      if (!(faceId in s.faceTypes)) return {}
      const next = { ...s.faceTypes }
      delete next[faceId]
      return { faceTypes: next }
    })
    get().recomputeFaces()
  },

  setSelection: (sel) => set((s) => ({ selection: { ...s.selection, ...sel } })),

  clearSelection: () => set({ selection: emptySelection() }),

  loadDocument: (doc, discoveredMaterials) => {
    set((s) => ({
      points: doc.points,
      lines: doc.lines,
      faceTypes: doc.faceTypes ?? {},
      selection: emptySelection(),
      pendingLineStart: null,
      fitNonce: s.fitNonce + 1,
    }))
    get().recomputeFaces()
    // Every mattype actually used by the loaded doc must have a settings entry
    // so its color resolves; otherwise rehydrated faces render gray. Callers
    // may pass `discoveredMaterials` (e.g. from parsePoly), but we also walk
    // faceTypes so the persistence-rehydrate path stays correct on its own.
    const settings = useSettingsStore.getState()
    const used = new Set<number>(discoveredMaterials ?? [])
    for (const spec of Object.values(doc.faceTypes ?? {})) used.add(spec.mattype)
    for (const m of used) settings.ensureMaterial(m)
  },

  toDocument: () => {
    const s = get()
    return {
      points: s.points,
      lines: s.lines,
      faceTypes: s.faceTypes,
    }
  },

  reset: () =>
    set({
      points: [],
      lines: [],
      faceTypes: {},
      faces: [],
      selection: emptySelection(),
      pendingLineStart: null,
    }),
    }),
    {
      // Only geometry is undoable; selection/tool/faces are derived or transient.
      partialize: (s) => ({
        points: s.points,
        lines: s.lines,
        faceTypes: s.faceTypes,
      }),
      limit: 100,
      equality: (a, b) =>
        a.points === b.points &&
        a.lines === b.lines &&
        a.faceTypes === b.faceTypes,
      // A single user action calls set() several times (e.g. addLineByCoords ->
      // addPoint + addPoint + addLine). Record only the first change of each
      // synchronous burst so one action becomes exactly one undo step.
      handleSet: (record) => {
        let batching = false
        return (pastState) => {
          if (batching) return
          batching = true
          record(pastState)
          queueMicrotask(() => {
            batching = false
          })
        }
      },
    },
  ),
)

/**
 * True when the document holds any geometry. This is the single source of
 * truth for "there is unsaved work" -- the document is never persisted, so a
 * separate dirty flag would have nothing to compare against. Shared by the
 * beforeunload guard and the import flow.
 */
export const hasGeometry = (s: Pick<EditorState, 'points' | 'lines'>): boolean =>
  s.points.length > 0 || s.lines.length > 0

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
