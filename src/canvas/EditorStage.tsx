import { useEffect, useRef, useState } from 'react'
import { Circle, Layer, Line, Rect, Stage } from 'react-konva'
import type Konva from 'konva'
import { useEditorStore } from '../store/editorStore'
import { materialColor } from '../constants/materials'
import { boundaryColor, boundaryDash } from '../poly/boundary'
import { Toolbar } from '../components/Toolbar'
import { computeGridLines } from './grid'
import {
  fitDomain,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Viewport,
} from './viewport'
import { nearestPoint, snapWorld } from './snapping'

const POINT_RADIUS = 4
const SEGMENT_WIDTH = 2
const HIT_PX = 12
const SELECT = '#7c3aed' // violet-600

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
  const didInit = useRef(false)
  const sizeRef = useRef({ w: 0, h: 0 })
  const panning = useRef<{ x: number; y: number } | null>(null)

  const domain = useEditorStore((s) => s.domain)
  const points = useEditorStore((s) => s.points)
  const segments = useEditorStore((s) => s.segments)
  const regions = useEditorStore((s) => s.regions)
  const materials = useEditorStore((s) => s.materials)
  const selection = useEditorStore((s) => s.selection)
  const tool = useEditorStore((s) => s.tool)
  const pendingLineStart = useEditorStore((s) => s.pendingLineStart)

  const addPoint = useEditorStore((s) => s.addPoint)
  const addSegment = useEditorStore((s) => s.addSegment)
  const selectSingle = useEditorStore((s) => s.selectSingle)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const setTool = useEditorStore((s) => s.setTool)
  const setPendingLineStart = useEditorStore((s) => s.setPendingLineStart)
  const deleteSelection = useEditorStore((s) => s.deleteSelection)

  // Measure container; perform the initial fit inside the observer callback.
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
        setVp(fitDomain(useEditorStore.getState().domain, w, h))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Refit on request (Load sample, Fit button).
  useEffect(() => {
    return useEditorStore.subscribe((state, prev) => {
      if (state.fitNonce === prev.fitNonce) return
      const { w, h } = sizeRef.current
      if (w > 0 && h > 0) setVp(fitDomain(state.domain, w, h))
    })
  }, [])

  // Keyboard shortcuts (ignored while typing in form controls).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return
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
        default:
          return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteSelection, clearSelection, setTool, setPendingLineStart])

  /** Resolve the point under the cursor (existing) or create a snapped new one. */
  const resolveEndpointId = (px: number, py: number): string => {
    const existing = nearestPoint(points, vp, px, py, HIT_PX)
    if (existing) return existing.id
    const w = screenToWorld(vp, px, py)
    const sn = snapWorld(w.x, w.z, domain.gridSpacing)
    return addPoint(sn.x, sn.z)
  }

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const p = e.target.getStage()?.getPointerPosition()
    if (!p) return
    const factor = e.evt.deltaY < 0 ? 1.1 : 1 / 1.1
    setVp((v) => zoomAt(v, factor, p.x, p.y))
  }

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const p = e.target.getStage()?.getPointerPosition()
    if (!p) return
    if (tool === 'pan' || e.evt.button === 1) panning.current = { x: p.x, y: p.y }
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const p = e.target.getStage()?.getPointerPosition()
    if (!p) return
    if (panning.current) {
      const dx = p.x - panning.current.x
      const dy = p.y - panning.current.y
      panning.current = { x: p.x, y: p.y }
      setVp((v) => panBy(v, dx, dy))
      return
    }
    if (tool === 'point' || tool === 'line') {
      const existing = nearestPoint(points, vp, p.x, p.y, HIT_PX)
      if (existing) {
        const s = worldToScreen(vp, existing.x, existing.z)
        setHover({ sx: s.sx, sy: s.sy, x: existing.x, z: existing.z, existingId: existing.id })
      } else {
        const w = screenToWorld(vp, p.x, p.y)
        const sn = snapWorld(w.x, w.z, domain.gridSpacing)
        const s = worldToScreen(vp, sn.x, sn.z)
        setHover({ sx: s.sx, sy: s.sy, x: sn.x, z: sn.z })
      }
    } else if (hover) {
      setHover(null)
    }
  }

  const endPan = () => {
    panning.current = null
  }

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) return // middle button is reserved for panning
    const stage = e.target.getStage()
    const p = stage?.getPointerPosition()
    if (!p) return
    const node = e.target
    const name = typeof node.name === 'function' ? node.name() : ''
    const id = typeof node.id === 'function' ? node.id() : ''

    if (tool === 'select') {
      if (name === 'point') selectSingle('point', id)
      else if (name === 'segment') selectSingle('segment', id)
      else if (name === 'region') selectSingle('region', id)
      else clearSelection()
      return
    }
    if (tool === 'point') {
      const existing = nearestPoint(points, vp, p.x, p.y, HIT_PX)
      if (existing) {
        selectSingle('point', existing.id)
      } else {
        const w = screenToWorld(vp, p.x, p.y)
        const sn = snapWorld(w.x, w.z, domain.gridSpacing)
        selectSingle('point', addPoint(sn.x, sn.z))
      }
      return
    }
    if (tool === 'line') {
      const endId = resolveEndpointId(p.x, p.y)
      if (!pendingLineStart) {
        setPendingLineStart(endId)
      } else {
        if (endId !== pendingLineStart) addSegment(pendingLineStart, endId)
        setPendingLineStart(endId) // chain into a polyline
      }
    }
  }

  const gridLines = computeGridLines(vp, size.w, size.h, domain.gridSpacing)
  const colorOf = (mattype: number) =>
    materials.find((m) => m.mattype === mattype)?.color ?? materialColor(mattype)

  const selPoints = new Set(selection.pointIds)
  const selSegments = new Set(selection.segmentIds)
  const selRegions = new Set(selection.regionIds)

  const domTL = worldToScreen(vp, domain.xmin, domain.zmax)
  const domBR = worldToScreen(vp, domain.xmax, domain.zmin)

  const startPt = pendingLineStart ? points.find((p) => p.id === pendingLineStart) : undefined
  const startScreen = startPt ? worldToScreen(vp, startPt.x, startPt.z) : null

  const cursor =
    tool === 'pan' ? 'grab' : tool === 'point' || tool === 'line' ? 'crosshair' : 'default'

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-neutral-100">
      <Toolbar />
      {size.w > 0 && size.h > 0 && (
        <Stage
          width={size.w}
          height={size.h}
          style={{ cursor }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={endPan}
          onMouseLeave={() => {
            endPan()
            setHover(null)
          }}
          onClick={handleClick}
        >
          <Layer listening={false}>
            {gridLines.map((l, i) => (
              <Line
                key={i}
                points={l.points}
                stroke={l.axis ? '#9ca3af' : '#e5e7eb'}
                strokeWidth={l.axis ? 1.2 : 1}
              />
            ))}
            <Rect
              x={domTL.sx}
              y={domTL.sy}
              width={domBR.sx - domTL.sx}
              height={domBR.sy - domTL.sy}
              stroke="#a855f7"
              strokeWidth={1.5}
              dash={[4, 4]}
            />
          </Layer>

          <Layer>
            {regions.map((r) => {
              const s = worldToScreen(vp, r.x, r.z)
              const selected = selRegions.has(r.id)
              return (
                <Circle
                  key={r.id}
                  id={r.id}
                  name="region"
                  x={s.sx}
                  y={s.sy}
                  radius={POINT_RADIUS + (selected ? 4 : 2)}
                  fill={colorOf(r.mattype)}
                  opacity={selected ? 0.7 : 0.35}
                  stroke={selected ? SELECT : colorOf(r.mattype)}
                  strokeWidth={selected ? 2 : 1.5}
                  hitStrokeWidth={10}
                />
              )
            })}
            {segments.map((seg) => {
              const p0 = points.find((p) => p.id === seg.p0)
              const p1 = points.find((p) => p.id === seg.p1)
              if (!p0 || !p1) return null
              const a = worldToScreen(vp, p0.x, p0.z)
              const b = worldToScreen(vp, p1.x, p1.z)
              const selected = selSegments.has(seg.id)
              return (
                <Line
                  key={seg.id}
                  id={seg.id}
                  name="segment"
                  points={[a.sx, a.sy, b.sx, b.sy]}
                  stroke={selected ? SELECT : boundaryColor(seg.bdryFlag)}
                  strokeWidth={selected ? SEGMENT_WIDTH + 2 : SEGMENT_WIDTH}
                  dash={boundaryDash(seg.bdryFlag)}
                  hitStrokeWidth={12}
                />
              )
            })}
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
                  radius={selected ? POINT_RADIUS + 2 : POINT_RADIUS}
                  fill={selected ? SELECT : '#1f2937'}
                  stroke="#ffffff"
                  strokeWidth={1}
                  hitStrokeWidth={8}
                />
              )
            })}
          </Layer>

          <Layer listening={false}>
            {startScreen && hover && (
              <Line
                points={[startScreen.sx, startScreen.sy, hover.sx, hover.sy]}
                stroke={SELECT}
                strokeWidth={1.5}
                dash={[6, 4]}
              />
            )}
            {hover && (tool === 'point' || tool === 'line') && (
              <Circle
                x={hover.sx}
                y={hover.sy}
                radius={6}
                stroke={hover.existingId ? SELECT : '#a855f7'}
                strokeWidth={2}
                fill={hover.existingId ? 'rgba(124,58,237,0.15)' : 'rgba(168,85,247,0.1)'}
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  )
}
