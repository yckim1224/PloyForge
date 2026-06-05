import { useEffect, useRef, useState } from 'react'
import { Circle, Layer, Line, Rect, Stage } from 'react-konva'
import type Konva from 'konva'
import { redoEdit, undoEdit, useEditorStore } from '../store/editorStore'
import { materialColor } from '../constants/materials'
import { boundaryColor, boundaryDash } from '../poly/boundary'
import { pointInPolygon, type Vec2 } from '../lib/geometry'
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
import { nearestPoint, nearestSegmentPoint, snapWorld } from './snapping'
import {
  facesInRect,
  normalizeRect,
  pointsInRect,
  segmentsInRect,
  type ScreenRect,
} from './selection'

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
  const [marquee, setMarquee] = useState<ScreenRect | null>(null)
  const didInit = useRef(false)
  const sizeRef = useRef({ w: 0, h: 0 })
  const panning = useRef<{ x: number; y: number } | null>(null)
  const marqueeStart = useRef<{ x: number; y: number; target: 'point' | 'segment' | 'face' } | null>(
    null,
  )
  const justMarqueed = useRef(false)

  const domain = useEditorStore((s) => s.domain)
  const points = useEditorStore((s) => s.points)
  const segments = useEditorStore((s) => s.segments)
  const regions = useEditorStore((s) => s.regions)
  const faces = useEditorStore((s) => s.faces)
  const materials = useEditorStore((s) => s.materials)
  const selection = useEditorStore((s) => s.selection)
  const tool = useEditorStore((s) => s.tool)
  const marqueeTarget = useEditorStore((s) => s.marqueeTarget)
  const pendingLineStart = useEditorStore((s) => s.pendingLineStart)

  const addPoint = useEditorStore((s) => s.addPoint)
  const addSegment = useEditorStore((s) => s.addSegment)
  const selectSingle = useEditorStore((s) => s.selectSingle)
  const selectMany = useEditorStore((s) => s.selectMany)
  const toggleSelect = useEditorStore((s) => s.toggleSelect)
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
        setVp(fitDomain(useEditorStore.getState().domain, w, h))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    return useEditorStore.subscribe((state, prev) => {
      if (state.fitNonce === prev.fitNonce) return
      const { w, h } = sizeRef.current
      if (w > 0 && h > 0) setVp(fitDomain(state.domain, w, h))
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return
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
        default:
          return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteSelection, clearSelection, setTool, setPendingLineStart])

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
    if (tool === 'pan' || e.evt.button === 1) {
      panning.current = { x: p.x, y: p.y }
      return
    }
    if (tool === 'select' && e.evt.button === 0) {
      const target = e.evt.shiftKey
        ? 'segment'
        : e.evt.ctrlKey || e.evt.metaKey
          ? 'face'
          : marqueeTarget
      marqueeStart.current = { x: p.x, y: p.y, target }
      setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
    }
  }

  // Snap priority for placing a point: existing vertex -> point on an edge -> grid.
  const resolveTarget = (
    px: number,
    py: number,
  ): { x: number; z: number; existingId?: string } => {
    const existing = nearestPoint(points, vp, px, py, HIT_PX)
    if (existing) return { x: existing.x, z: existing.z, existingId: existing.id }
    const onSeg = nearestSegmentPoint(segments, points, vp, px, py, HIT_PX)
    if (onSeg) return onSeg
    const w = screenToWorld(vp, px, py)
    return snapWorld(w.x, w.z, domain.gridSpacing)
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
    if (marqueeStart.current) {
      setMarquee(normalizeRect(marqueeStart.current.x, marqueeStart.current.y, p.x, p.y))
      return
    }
    if (tool === 'point' || tool === 'line') {
      const tgt = resolveTarget(p.x, p.y)
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
      else if (ms.target === 'segment')
        selectMany('segment', segmentsInRect(points, segments, vp, rect))
      else selectMany('face', facesInRect(faces, points, vp, rect))
      justMarqueed.current = true
    }
    marqueeStart.current = null
    setMarquee(null)
  }

  const resolveEndpointId = (px: number, py: number): string => {
    const tgt = resolveTarget(px, py)
    return tgt.existingId ?? addPoint(tgt.x, tgt.z)
  }

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) return
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
          : name === 'segment'
            ? 'segment'
            : name === 'region'
              ? 'region'
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
      const tgt = resolveTarget(p.x, p.y)
      selectSingle('point', tgt.existingId ?? addPoint(tgt.x, tgt.z))
      return
    }
    if (tool === 'line') {
      const endId = resolveEndpointId(p.x, p.y)
      if (!pendingLineStart) {
        setPendingLineStart(endId)
      } else {
        if (endId !== pendingLineStart) addSegment(pendingLineStart, endId)
        setPendingLineStart(endId)
      }
    }
  }

  const gridLines = computeGridLines(vp, size.w, size.h, domain.gridSpacing)
  const colorOf = (mattype: number) =>
    materials.find((m) => m.mattype === mattype)?.color ?? materialColor(mattype)

  const selPoints = new Set(selection.pointIds)
  const selSegments = new Set(selection.segmentIds)
  const selRegions = new Set(selection.regionIds)
  const selFaces = new Set(selection.faceIds)

  const faceVerts = (pointIds: string[]): Vec2[] =>
    pointIds
      .map((pid) => byId.get(pid))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ x: p.x, z: p.z }))

  const faceVertsList = faces.map((f) => faceVerts(f.pointIds))
  const isOrphanRegion = (r: { x: number; z: number }) =>
    !faceVertsList.some((verts) => pointInPolygon({ x: r.x, z: r.z }, verts))

  const domTL = worldToScreen(vp, domain.xmin, domain.zmax)
  const domBR = worldToScreen(vp, domain.xmax, domain.zmin)

  const startPt = pendingLineStart ? byId.get(pendingLineStart) : undefined
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
          onMouseUp={finishMarquee}
          onMouseLeave={(e) => {
            finishMarquee(e)
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

          {/* Faces, filled by the material of the region seed inside them. */}
          <Layer>
            {faces.map((f) => {
              const verts = faceVerts(f.pointIds)
              if (verts.length < 3) return null
              const flat = verts.flatMap((v) => {
                const s = worldToScreen(vp, v.x, v.z)
                return [s.sx, s.sy]
              })
              const region = regions.find((r) => pointInPolygon({ x: r.x, z: r.z }, verts))
              const selected = selFaces.has(f.id)
              const fill = region ? colorOf(region.mattype) : '#cbd5e1'
              return (
                <Line
                  key={f.id}
                  id={f.id}
                  name="face"
                  points={flat}
                  closed
                  fill={fill}
                  opacity={selected ? 0.5 : 0.22}
                  stroke={selected ? SELECT : 'transparent'}
                  strokeWidth={selected ? 2 : 0}
                />
              )
            })}
          </Layer>

          <Layer>
            {regions.map((r) => {
              const s = worldToScreen(vp, r.x, r.z)
              const selected = selRegions.has(r.id)
              const orphan = isOrphanRegion(r)
              return (
                <Circle
                  key={r.id}
                  id={r.id}
                  name="region"
                  x={s.sx}
                  y={s.sy}
                  radius={POINT_RADIUS + (selected ? 4 : 2)}
                  fill={colorOf(r.mattype)}
                  opacity={orphan ? 0.3 : selected ? 0.85 : 0.5}
                  stroke={selected ? SELECT : orphan ? '#ef4444' : '#ffffff'}
                  strokeWidth={selected ? 2 : orphan ? 2 : 1}
                  dash={orphan ? [3, 2] : undefined}
                  hitStrokeWidth={10}
                />
              )
            })}
            {segments.map((seg) => {
              const p0 = byId.get(seg.p0)
              const p1 = byId.get(seg.p1)
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
            {marquee && (
              <Rect
                x={marquee.x0}
                y={marquee.y0}
                width={marquee.x1 - marquee.x0}
                height={marquee.y1 - marquee.y0}
                fill="rgba(124,58,237,0.1)"
                stroke={SELECT}
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
