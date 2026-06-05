import { useEffect, useRef, useState } from 'react'
import { Circle, Layer, Line, Rect, Stage } from 'react-konva'
import type Konva from 'konva'
import { redoEdit, undoEdit, useEditorStore } from '../store/editorStore'
import { useSettingsStore } from '../store/settingsStore'
import { useLayerStore } from '../store/layerStore'
import { toast } from '../store/toastStore'
import { materialColor } from '../constants/materials'
import { type Vec2 } from '../lib/geometry'
import { Toolbar } from '../components/Toolbar'
import { Tooltip } from '../components/Tooltip'
import { LayerOverlay } from './LayerOverlay'
import { Crosshair, HelpCircle } from 'lucide-react'
import { computeGridLines } from './grid'
import {
  fitPoints,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Viewport,
} from './viewport'
import { nearestGridIntersection, nearestLinePoint, nearestPoint, snapWorld } from './snapping'
import {
  facesInRect,
  linesInRect,
  normalizeRect,
  pointsInRect,
  type ScreenRect,
} from './selection'

const HIT_PX = 12
const HUD_EMPTY = 'x —   z —'

const HELP_HINT = [
  'V: Select  P: Point  L: Line  H: Pan',
  'Del: Delete  ⌘Z: Undo  ⇧⌘Z: Redo',
  'Space: Pan (hold)  Arrows: Nudge',
].join('\n')

function StageActions({ onFit }: { onFit: () => void }) {
  return (
    <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-lg border border-neutral-200 bg-white/95 p-1 shadow-sm backdrop-blur">
      <Tooltip content={HELP_HINT} placement="bottom">
        <button
          type="button"
          aria-label="Keyboard shortcuts"
          className="flex size-9 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100"
        >
          <HelpCircle className="size-4" />
        </button>
      </Tooltip>
      <button
        type="button"
        title="Fit view"
        aria-label="Fit view"
        onClick={onFit}
        className="flex size-9 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100"
      >
        <Crosshair className="size-4" />
      </button>
    </div>
  )
}

function fmtMeters(v: number): string {
  return Math.round(v).toLocaleString('en-US')
}
function fmtScale(scale: number): string {
  const mpp = scale > 0 ? 1 / scale : 0
  return mpp >= 1 ? `${Math.round(mpp).toLocaleString('en-US')} m/px` : `${mpp.toFixed(2)} m/px`
}
function formatHud(x: number, z: number, scale: number): string {
  return `x ${fmtMeters(x)}   z ${fmtMeters(z)}   ·   ${fmtScale(scale)}`
}

interface Hover {
  sx: number
  sy: number
  x: number
  z: number
  existingId?: string
}

export function EditorStage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [vp, setVp] = useState<Viewport>({ scale: 1, originX: 0, originY: 0 })
  const [hover, setHover] = useState<Hover | null>(null)
  const [marquee, setMarquee] = useState<ScreenRect | null>(null)
  const [spacePan, setSpacePan] = useState(false)
  const didInit = useRef(false)
  const sizeRef = useRef({ w: 0, h: 0 })
  const panning = useRef<{ x: number; y: number } | null>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const marqueeStart = useRef<{ x: number; y: number; target: 'point' | 'line' | 'face' } | null>(
    null,
  )
  const justMarqueed = useRef(false)

  const points = useEditorStore((s) => s.points)
  const lines = useEditorStore((s) => s.lines)
  const faces = useEditorStore((s) => s.faces)
  const selection = useEditorStore((s) => s.selection)
  const tool = useEditorStore((s) => s.tool)
  const marqueeTarget = useEditorStore((s) => s.marqueeTarget)
  const pendingLineStart = useEditorStore((s) => s.pendingLineStart)

  const gridSettings = useSettingsStore((s) => s.grid)
  const pointSettings = useSettingsStore((s) => s.point)
  const lineSettings = useSettingsStore((s) => s.line)
  const materials = useSettingsStore((s) => s.materials)

  const layerGrid = useLayerStore((s) => s.grid)
  const layerPoints = useLayerStore((s) => s.points)
  const layerLines = useLayerStore((s) => s.lines)
  const layerFaces = useLayerStore((s) => s.faces)
  const setLayer = useLayerStore((s) => s.setLayer)

  const addPoint = useEditorStore((s) => s.addPoint)
  const addLine = useEditorStore((s) => s.addLine)
  const requestFit = useEditorStore((s) => s.requestFit)
  const selectSingle = useEditorStore((s) => s.selectSingle)
  const selectMany = useEditorStore((s) => s.selectMany)
  const toggleSelect = useEditorStore((s) => s.toggleSelect)
  const nudgeSelection = useEditorStore((s) => s.nudgeSelection)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const setTool = useEditorStore((s) => s.setTool)
  const setPendingLineStart = useEditorStore((s) => s.setPendingLineStart)
  const deleteSelection = useEditorStore((s) => s.deleteSelection)

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      const w = Math.floor(r.width)
      const h = Math.floor(r.height)
      sizeRef.current = { w, h }
      setSize({ w, h })
      if (!didInit.current && w > 0 && h > 0) {
        didInit.current = true
        setVp(fitPoints(useEditorStore.getState().points, w, h))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    return useEditorStore.subscribe((state, prev) => {
      if (state.fitNonce === prev.fitNonce) return
      const { w, h } = sizeRef.current
      if (w > 0 && h > 0) setVp(fitPoints(state.points, w, h))
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return
      // Hold Space to temporarily pan from any tool (standard editor convention).
      if (e.code === 'Space') {
        e.preventDefault()
        setSpacePan(true)
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) redoEdit()
        else undoEdit()
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        redoEdit()
        return
      }
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          deleteSelection()
          break
        case 'Escape':
          setPendingLineStart(null)
          clearSelection()
          break
        case 'v':
        case 'V':
          setTool('select')
          break
        case 'p':
        case 'P':
          setTool('point')
          break
        case 'l':
        case 'L':
          setTool('line')
          break
        case 'h':
        case 'H':
          setTool('pan')
          break
        case 'ArrowRight':
          e.preventDefault()
          nudgeSelection(1, 0, e.shiftKey)
          break
        case 'ArrowLeft':
          e.preventDefault()
          nudgeSelection(-1, 0, e.shiftKey)
          break
        case 'ArrowUp':
          e.preventDefault()
          nudgeSelection(0, 1, e.shiftKey)
          break
        case 'ArrowDown':
          e.preventDefault()
          nudgeSelection(0, -1, e.shiftKey)
          break
        default:
          return
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePan(false)
        panning.current = null
      }
    }
    // Reset if focus is lost while Space is held (e.g. alt-tab) so pan can't stick.
    const onBlur = () => {
      setSpacePan(false)
      panning.current = null
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [deleteSelection, clearSelection, setTool, setPendingLineStart, nudgeSelection])

  // Seed the coordinate HUD until the cursor first moves.
  useEffect(() => {
    if (hudRef.current) hudRef.current.textContent = HUD_EMPTY
  }, [])

  // Auto-show a hidden layer when items of that kind become selected
  // (e.g. checked from the panel) so ghost selections never linger.
  useEffect(() => {
    if (selection.pointIds.length > 0 && !layerPoints) setLayer('points', true)
    if (selection.lineIds.length > 0 && !layerLines) setLayer('lines', true)
    if (selection.faceIds.length > 0 && !layerFaces) setLayer('faces', true)
  }, [
    selection.pointIds,
    selection.lineIds,
    selection.faceIds,
    layerPoints,
    layerLines,
    layerFaces,
    setLayer,
  ])

  const byId = new Map(points.map((p) => [p.id, p]))

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const p = e.target.getStage()?.getPointerPosition()
    if (!p) return
    const factor = e.evt.deltaY < 0 ? 1.1 : 1 / 1.1
    setVp((v) => zoomAt(v, factor, p.x, p.y))
  }

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    const p = stage?.getPointerPosition()
    if (!p) return
    // Clear any stale suppress flag from a marquee that ended off-stage (mouseleave
    // fires no follow-up click to clear it), so this gesture's click isn't swallowed.
    justMarqueed.current = false
    if (spacePan || tool === 'pan' || e.evt.button === 1) {
      panning.current = { x: p.x, y: p.y }
      return
    }
    if (tool === 'select' && e.evt.button === 0) {
      const target = e.evt.shiftKey
        ? 'line'
        : e.evt.ctrlKey || e.evt.metaKey
          ? 'face'
          : marqueeTarget
      marqueeStart.current = { x: p.x, y: p.y, target }
      setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
    }
  }

  // Snap priority for placing a point:
  //   1. existing vertex (always wins)
  //   2. grid intersection within HIT_PX (beats line snap so a user trying to
  //      drop a node at a grid+line crossing actually lands on the grid point)
  //   3. point on an edge
  //   4. free grid snap (always rounds to nearest intersection)
  // Holding Alt bypasses every snap so the user can place at the exact cursor.
  const resolveTarget = (
    px: number,
    py: number,
    altKey: boolean,
  ): { x: number; z: number; existingId?: string } => {
    if (altKey) {
      const w = screenToWorld(vp, px, py)
      return { x: w.x, z: w.z }
    }
    const existing = nearestPoint(points, vp, px, py, HIT_PX)
    if (existing) return { x: existing.x, z: existing.z, existingId: existing.id }
    const onGrid = nearestGridIntersection(vp, px, py, gridSettings.spacing, HIT_PX)
    if (onGrid) return onGrid
    const onSeg = nearestLinePoint(lines, points, vp, px, py, HIT_PX)
    if (onSeg) return onSeg
    const w = screenToWorld(vp, px, py)
    return snapWorld(w.x, w.z, gridSettings.spacing)
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const p = e.target.getStage()?.getPointerPosition()
    if (!p) return
    if (hudRef.current) {
      const w = screenToWorld(vp, p.x, p.y)
      hudRef.current.textContent = formatHud(w.x, w.z, vp.scale)
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

  const finishMarquee = (e: Konva.KonvaEventObject<MouseEvent>) => {
    panning.current = null
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

  const resolveEndpointId = (
    px: number,
    py: number,
    altKey: boolean,
  ): { id: string; created: boolean } => {
    const tgt = resolveTarget(px, py, altKey)
    if (tgt.existingId) return { id: tgt.existingId, created: false }
    return { id: addPoint(tgt.x, tgt.z), created: true }
  }

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) return
    if (spacePan) return
    if (justMarqueed.current) {
      justMarqueed.current = false
      return
    }
    const stage = e.target.getStage()
    const p = stage?.getPointerPosition()
    if (!p) return
    const node = e.target
    const name = typeof node.name === 'function' ? node.name() : ''
    const id = typeof node.id === 'function' ? node.id() : ''

    if (tool === 'select') {
      const kind =
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

  const gridLines = computeGridLines(vp, size.w, size.h, gridSettings.spacing)
  const colorOf = (mattype: number) =>
    materials.find((m) => m.mattype === mattype)?.color ?? materialColor(mattype)

  const selPoints = new Set(selection.pointIds)
  const selLines = new Set(selection.lineIds)
  const selFaces = new Set(selection.faceIds)

  const faceVerts = (pointIds: string[]): Vec2[] =>
    pointIds
      .map((pid) => byId.get(pid))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ x: p.x, z: p.z }))

  const lineStyleFor = (flag: number) => {
    const key = flag as 0 | 1 | 2 | 16 | 32
    return lineSettings.styleByFlag[key] ?? { color: '#a855f7', dash: [] }
  }

  const startPt = pendingLineStart ? byId.get(pendingLineStart) : undefined
  const startScreen = startPt ? worldToScreen(vp, startPt.x, startPt.z) : null

  const cursor = spacePan
    ? 'grab'
    : tool === 'pan'
      ? 'grab'
      : tool === 'point' || tool === 'line'
        ? 'crosshair'
        : 'default'

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-neutral-100">
      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-2">
        <Toolbar />
        <LayerOverlay />
      </div>
      <StageActions onFit={requestFit} />
      <div
        ref={hudRef}
        className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-md border border-neutral-200 bg-white/85 px-2 py-1 font-mono text-xs tabular-nums text-neutral-600 shadow-sm"
      />
      {size.w > 0 && size.h > 0 && (
        <Stage
          width={size.w}
          height={size.h}
          style={{ cursor }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={finishMarquee}
          onMouseLeave={(e) => {
            finishMarquee(e)
            setHover(null)
            if (hudRef.current) hudRef.current.textContent = HUD_EMPTY
          }}
          onClick={handleClick}
        >
          {gridSettings.show && layerGrid && (
            <Layer listening={false}>
              {gridLines.map((l, i) => (
                <Line
                  key={i}
                  points={l.points}
                  stroke={l.axis ? '#9ca3af' : gridSettings.lineColor}
                  strokeWidth={l.axis ? Math.max(1.2, gridSettings.lineWidth) : gridSettings.lineWidth}
                />
              ))}
            </Layer>
          )}

          {/* Faces, filled by the Type from `faceTypes` (gray when unassigned). */}
          {layerFaces && (
          <Layer>
            {faces.map((f) => {
              const verts = faceVerts(f.pointIds)
              if (verts.length < 3) return null
              const flat = verts.flatMap((v) => {
                const s = worldToScreen(vp, v.x, v.z)
                return [s.sx, s.sy]
              })
              const selected = selFaces.has(f.id)
              const fill = f.mattype !== undefined ? colorOf(f.mattype) : '#cbd5e1'
              return (
                <Line
                  key={f.id}
                  id={f.id}
                  name="face"
                  points={flat}
                  closed
                  fill={fill}
                  opacity={selected ? 0.5 : 0.22}
                  stroke={selected ? pointSettings.selectedColor : 'transparent'}
                  strokeWidth={selected ? 2 : 0}
                />
              )
            })}
          </Layer>
          )}

          {layerLines && (
          <Layer>
            {lines.map((seg) => {
              const p0 = byId.get(seg.p0)
              const p1 = byId.get(seg.p1)
              if (!p0 || !p1) return null
              const a = worldToScreen(vp, p0.x, p0.z)
              const b = worldToScreen(vp, p1.x, p1.z)
              const selected = selLines.has(seg.id)
              const style = lineStyleFor(seg.bdryFlag)
              return (
                <Line
                  key={seg.id}
                  id={seg.id}
                  name="line"
                  points={[a.sx, a.sy, b.sx, b.sy]}
                  stroke={selected ? pointSettings.selectedColor : style.color}
                  strokeWidth={selected ? lineSettings.width + 2 : lineSettings.width}
                  dash={style.dash.length > 0 ? style.dash : undefined}
                  hitStrokeWidth={12}
                />
              )
            })}
          </Layer>
          )}

          {layerPoints && (
          <Layer>
            {points.map((p) => {
              const s = worldToScreen(vp, p.x, p.z)
              const selected = selPoints.has(p.id)
              return (
                <Circle
                  key={p.id}
                  id={p.id}
                  name="point"
                  x={s.sx}
                  y={s.sy}
                  radius={selected ? pointSettings.radius + 2 : pointSettings.radius}
                  fill={selected ? pointSettings.selectedColor : pointSettings.color}
                  stroke="#ffffff"
                  strokeWidth={1}
                  hitStrokeWidth={8}
                />
              )
            })}
          </Layer>
          )}

          <Layer listening={false}>
            {startScreen && hover && (
              <Line
                points={[startScreen.sx, startScreen.sy, hover.sx, hover.sy]}
                stroke={pointSettings.selectedColor}
                strokeWidth={1.5}
                dash={[6, 4]}
              />
            )}
            {hover && (tool === 'point' || tool === 'line') && (
              <Circle
                x={hover.sx}
                y={hover.sy}
                radius={6}
                stroke={hover.existingId ? pointSettings.selectedColor : '#a855f7'}
                strokeWidth={2}
                fill={hover.existingId ? 'rgba(124,58,237,0.15)' : 'rgba(168,85,247,0.1)'}
              />
            )}
            {marquee && (
              <Rect
                x={marquee.x0}
                y={marquee.y0}
                width={marquee.x1 - marquee.x0}
                height={marquee.y1 - marquee.y0}
                fill="rgba(124,58,237,0.1)"
                stroke={pointSettings.selectedColor}
                strokeWidth={1}
                dash={[4, 2]}
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  )
}
