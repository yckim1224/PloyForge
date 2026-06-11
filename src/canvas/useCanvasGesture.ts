import {
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
import type Konva from 'konva'
import {
  collectSelectionPointIds,
  useEditorStore,
  type Selection,
  type Tool,
  type SelectableKind,
} from '../store/editorStore'
import { toast } from '../store/toastStore'
import type { Face, Line, Point } from '../types'
import {
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Viewport,
} from './viewport'
import { snapPointTarget } from './snapping'
import {
  facesInRect,
  linesInRect,
  normalizeRect,
  pointsInRect,
  type ScreenRect,
} from './selection'
import { exceededDragThreshold, isDraggableTarget, snapDelta } from './drag'

const HIT_PX = 12
/** Placeholder shown until the first cursor move writes real coordinates. */
export const HUD_EMPTY = 'x —   z —'

function formatHud(x: number, z: number, scale: number): string {
  const meters = (v: number) => Math.round(v).toLocaleString('en-US')
  const mpp = scale > 0 ? 1 / scale : 0
  const scaleStr =
    mpp >= 1 ? `${Math.round(mpp).toLocaleString('en-US')} m/px` : `${mpp.toFixed(2)} m/px`
  return `x ${meters(x)}   z ${meters(z)}   ·   ${scaleStr}`
}

/** True when a Konva node is the background image or one of its Transformer handles. */
function isBackgroundTarget(node: Konva.Node | null): boolean {
  let n: Konva.Node | null = node
  while (n) {
    if (typeof n.name === 'function' && n.name() === 'background') return true
    if (typeof n.getClassName === 'function' && n.getClassName() === 'Transformer') return true
    n = typeof n.getParent === 'function' ? n.getParent() : null
  }
  return false
}

export interface CanvasGestureHover {
  sx: number
  sy: number
  x: number
  z: number
  existingId?: string
}

export interface CanvasGestureDrag {
  ids: Set<string>
  dx: number
  dz: number
}

export interface CanvasGestureActions {
  addPoint: (x: number, z: number) => string
  addLine: (p0: string, p1: string) => string | null
  selectSingle: (kind: SelectableKind, id: string) => void
  selectMany: (kind: SelectableKind, ids: string[]) => void
  toggleSelect: (kind: SelectableKind, id: string) => void
  clearSelection: () => void
  setPendingLineStart: (id: string | null) => void
  translateSelectionBy: (dx: number, dz: number) => void
}

export interface CanvasGestureParams {
  tool: Tool
  selection: Selection
  marqueeTarget: SelectableKind
  pendingLineStart: string | null
  points: Point[]
  lines: Line[]
  faces: Face[]
  vp: Viewport
  gridSpacing: number
  bgEditMode: boolean
  hudRef: RefObject<HTMLDivElement | null>
  setVp: Dispatch<SetStateAction<Viewport>>
  actions: CanvasGestureActions
}

export interface CanvasGestureReturn {
  handlers: {
    onWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void
    onMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void
    onMouseUp: (e: Konva.KonvaEventObject<MouseEvent>) => void
    onMouseLeave: (e: Konva.KonvaEventObject<MouseEvent>) => void
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => void
  }
  drag: CanvasGestureDrag | null
  marquee: ScreenRect | null
  hover: CanvasGestureHover | null
  spacePan: boolean
  /** Mouse-drag press point ref. Read by useKeyboardShortcuts to suppress mid-gesture keys. */
  dragStartRef: RefObject<{ x: number; y: number; moved: boolean } | null>
  /** Pan-drag press point ref. Cleared by useKeyboardShortcuts on Space-up / blur. */
  panningRef: RefObject<{ x: number; y: number } | null>
  setSpacePan: Dispatch<SetStateAction<boolean>>
  /** Called by BackgroundImageEditor's onGestureEnd to swallow the trailing click. */
  markBackgroundGestureEnd: () => void
}

/**
 * Mouse gesture lifecycle: wheel zoom, pan, marquee select, move-drag commit,
 * and tool-specific click (select / add point / add line). Owns the refs that
 * track gesture lifecycle (dragStart, panning, marqueeStart, justXxx flags) and
 * the render-facing state (drag, marquee, hover, spacePan). The parent reads
 * the returned state to render snap preview / marquee rect / drag offset, and
 * spreads `handlers` onto the Konva Stage.
 */
export function useCanvasGesture(params: CanvasGestureParams): CanvasGestureReturn {
  const {
    tool,
    selection,
    marqueeTarget,
    pendingLineStart,
    points,
    lines,
    faces,
    vp,
    gridSpacing,
    bgEditMode,
    hudRef,
    setVp,
    actions,
  } = params

  const {
    addPoint,
    addLine,
    selectSingle,
    selectMany,
    toggleSelect,
    clearSelection,
    setPendingLineStart,
    translateSelectionBy,
  } = actions

  const [drag, setDrag] = useState<CanvasGestureDrag | null>(null)
  const [marquee, setMarquee] = useState<ScreenRect | null>(null)
  const [hover, setHover] = useState<CanvasGestureHover | null>(null)
  const [spacePan, setSpacePan] = useState(false)

  const panning = useRef<{ x: number; y: number } | null>(null)
  const marqueeStart = useRef<{ x: number; y: number; target: SelectableKind } | null>(null)
  const justMarqueed = useRef(false)
  // Move-drag handler-only bookkeeping: press point + whether the drag threshold
  // has been crossed. (Render-facing drag data lives in `drag` state.) Store is
  // mutated only once, on drop.
  const dragStart = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  // Set when a real drag just ended, so the trailing click is swallowed.
  const justDragged = useRef(false)
  // Set when an image drag/resize just ended, so the trailing click is swallowed.
  const justImageDragged = useRef(false)

  const resolveTarget = (px: number, py: number, altKey: boolean) =>
    snapPointTarget(points, lines, vp, px, py, gridSpacing, HIT_PX, altKey)

  const resolveEndpointId = (
    px: number,
    py: number,
    altKey: boolean,
  ): { id: string; created: boolean } => {
    const tgt = resolveTarget(px, py, altKey)
    if (tgt.existingId) return { id: tgt.existingId, created: false }
    return { id: addPoint(tgt.x, tgt.z), created: true }
  }

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const p = e.target.getStage()?.getPointerPosition()
    if (!p) return
    const factor = e.evt.deltaY < 0 ? 1.1 : 1 / 1.1
    setVp((v) => zoomAt(v, factor, p.x, p.y))
  }

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    const p = stage?.getPointerPosition()
    if (!p) return
    // Clear stale suppress flags from a gesture that ended off-stage (mouseleave
    // fires no follow-up click to clear them), so this gesture's click isn't
    // swallowed. Both a marquee and a move-drag can release off-stage.
    justMarqueed.current = false
    justDragged.current = false
    justImageDragged.current = false
    // In background-edit mode, let Konva's draggable image / Transformer own the
    // gesture so the stage marquee and geometry move-drag stay out of the way.
    if (bgEditMode && !spacePan && e.evt.button === 0 && isBackgroundTarget(e.target)) {
      return
    }
    if (spacePan || tool === 'pan' || e.evt.button === 1) {
      panning.current = { x: p.x, y: p.y }
      return
    }
    if (tool === 'select' && e.evt.button === 0) {
      // R2: a plain press on an already-selected item begins a move drag.
      // Modifier presses stay reserved for marquee target switching below.
      if (!e.evt.shiftKey && !e.evt.ctrlKey && !e.evt.metaKey) {
        const node = e.target
        const name = typeof node.name === 'function' ? node.name() : ''
        const id = typeof node.id === 'function' ? node.id() : ''
        if (isDraggableTarget(name, id, selection)) {
          dragStart.current = { x: p.x, y: p.y, moved: false }
          setDrag({ ids: collectSelectionPointIds(useEditorStore.getState()), dx: 0, dz: 0 })
          return
        }
      }
      const target: SelectableKind = e.evt.shiftKey
        ? 'line'
        : e.evt.ctrlKey || e.evt.metaKey
          ? 'face'
          : marqueeTarget
      marqueeStart.current = { x: p.x, y: p.y, target }
      setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
    }
  }

  const onMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const p = e.target.getStage()?.getPointerPosition()
    if (!p) return
    if (hudRef.current) {
      const w = screenToWorld(vp, p.x, p.y)
      hudRef.current.textContent = formatHud(w.x, w.z, vp.scale)
    }
    if (dragStart.current) {
      const d = dragStart.current
      // R1: ignore sub-threshold jitter so a plain click never nudges geometry.
      if (!d.moved && !exceededDragThreshold(p.x - d.x, p.y - d.y)) return
      d.moved = true
      const w0 = screenToWorld(vp, d.x, d.y)
      const w1 = screenToWorld(vp, p.x, p.y)
      // R4: snap the delta to grid spacing; Alt frees it. No store mutation here.
      const snapped = snapDelta(w1.x - w0.x, w1.z - w0.z, gridSpacing, e.evt.altKey)
      setDrag((cur) => (cur ? { ...cur, dx: snapped.dx, dz: snapped.dz } : cur))
      return
    }
    if (panning.current) {
      const dx = p.x - panning.current.x
      const dy = p.y - panning.current.y
      panning.current = { x: p.x, y: p.y }
      setVp((v) => panBy(v, dx, dy))
      return
    }
    if (spacePan) {
      if (hover) setHover(null)
      return
    }
    if (marqueeStart.current) {
      setMarquee(normalizeRect(marqueeStart.current.x, marqueeStart.current.y, p.x, p.y))
      return
    }
    if (tool === 'point' || tool === 'line') {
      const tgt = resolveTarget(p.x, p.y, e.evt.altKey)
      const s = worldToScreen(vp, tgt.x, tgt.z)
      setHover({ sx: s.sx, sy: s.sy, x: tgt.x, z: tgt.z, existingId: tgt.existingId })
    } else if (hover) {
      setHover(null)
    }
  }

  const finishGesture = (e: Konva.KonvaEventObject<MouseEvent>) => {
    panning.current = null
    // End a move drag first (mouseup or leaving the stage). Commit once -> a
    // single undo entry; a sub-threshold press falls through to a normal click.
    if (dragStart.current) {
      const moved = dragStart.current.moved
      if (moved && drag && (drag.dx !== 0 || drag.dz !== 0)) {
        translateSelectionBy(drag.dx, drag.dz)
      }
      // Any threshold-crossing drag swallows the trailing click so the gesture
      // never doubles as a selection change (even if it snapped back to zero).
      if (moved) justDragged.current = true
      dragStart.current = null
      setDrag(null)
      return
    }
    const ms = marqueeStart.current
    if (!ms) return
    const p = e.target.getStage()?.getPointerPosition() ?? { x: ms.x, y: ms.y }
    const rect = normalizeRect(ms.x, ms.y, p.x, p.y)
    const moved = Math.abs(p.x - ms.x) > 3 || Math.abs(p.y - ms.y) > 3
    if (moved) {
      if (ms.target === 'point') selectMany('point', pointsInRect(points, vp, rect))
      else if (ms.target === 'line')
        selectMany('line', linesInRect(points, lines, vp, rect))
      else selectMany('face', facesInRect(faces, points, vp, rect))
      justMarqueed.current = true
    }
    marqueeStart.current = null
    setMarquee(null)
  }

  const onMouseUp = finishGesture

  const onMouseLeave = (e: Konva.KonvaEventObject<MouseEvent>) => {
    finishGesture(e)
    setHover(null)
    if (hudRef.current) hudRef.current.textContent = HUD_EMPTY
  }

  const onClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) return
    if (spacePan) return
    if (justMarqueed.current) {
      justMarqueed.current = false
      return
    }
    // A move-drag ends with a click event; swallow it so the selection is kept.
    if (justDragged.current) {
      justDragged.current = false
      return
    }
    // An image drag/resize also ends with a click; swallow it so the image stays selected.
    if (justImageDragged.current) {
      justImageDragged.current = false
      return
    }
    // A plain click on the background image keeps it selected (never clears).
    if (isBackgroundTarget(e.target)) return
    const stage = e.target.getStage()
    const p = stage?.getPointerPosition()
    if (!p) return
    const node = e.target
    const name = typeof node.name === 'function' ? node.name() : ''
    const id = typeof node.id === 'function' ? node.id() : ''

    if (tool === 'select') {
      const kind: SelectableKind | null =
        name === 'point'
          ? 'point'
          : name === 'line'
            ? 'line'
            : name === 'face'
              ? 'face'
              : null
      const additive = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey
      if (kind) {
        if (additive) toggleSelect(kind, id)
        else selectSingle(kind, id)
      } else if (!additive) {
        clearSelection()
      }
      return
    }
    if (tool === 'point') {
      const tgt = resolveTarget(p.x, p.y, e.evt.altKey)
      selectSingle('point', tgt.existingId ?? addPoint(tgt.x, tgt.z))
      return
    }
    if (tool === 'line') {
      const { id: endId, created } = resolveEndpointId(p.x, p.y, e.evt.altKey)
      if (!pendingLineStart) {
        setPendingLineStart(endId)
      } else if (endId !== pendingLineStart) {
        // Only advance the polyline chain when the new line was actually
        // created. addLine returns null on a duplicate edge (or self-loop);
        // in that case keep pendingLineStart so the hover preview stays at
        // the original start, signalling that the click was a no-op.
        const lineId = addLine(pendingLineStart, endId)
        if (lineId) {
          setPendingLineStart(endId)
        } else if (!created) {
          // Only warn on a true duplicate -- both endpoints pre-existed.
          // If this click added a new point on an existing line, renode
          // already split that line at the new point (legitimate noding),
          // so the "already exists" notice would be misleading.
          toast.warning('A line between these points already exists.')
        }
      }
    }
  }

  return {
    handlers: { onWheel, onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onClick },
    drag,
    marquee,
    hover,
    spacePan,
    dragStartRef: dragStart,
    panningRef: panning,
    setSpacePan,
    markBackgroundGestureEnd: () => {
      justImageDragged.current = true
    },
  }
}
