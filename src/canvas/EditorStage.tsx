import { useEffect, useRef, useState } from 'react'
import { Circle, Layer, Line, Rect, Stage } from 'react-konva'
import type Konva from 'konva'
import { useEditorStore } from '../store/editorStore'
import { materialColor } from '../constants/materials'
import { boundaryColor, boundaryDash } from '../poly/boundary'
import { computeGridLines } from './grid'
import { fitDomain, panBy, worldToScreen, zoomAt, type Viewport } from './viewport'

const POINT_RADIUS = 4
const SEGMENT_WIDTH = 2

export function EditorStage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [vp, setVp] = useState<Viewport>({ scale: 1, originX: 0, originY: 0 })
  const didInit = useRef(false)

  const domain = useEditorStore((s) => s.domain)
  const points = useEditorStore((s) => s.points)
  const segments = useEditorStore((s) => s.segments)
  const regions = useEditorStore((s) => s.regions)
  const materials = useEditorStore((s) => s.materials)
  const sizeRef = useRef({ w: 0, h: 0 })

  // Measure the container (guarded for non-DOM test environments).
  // The initial fit happens here, in the observer callback, rather than in an
  // effect body (which would trip react-hooks/set-state-in-effect).
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

  // Refit whenever a fit is requested (Load sample, Fit button).
  useEffect(() => {
    return useEditorStore.subscribe((state, prev) => {
      if (state.fitNonce === prev.fitNonce) return
      const { w, h } = sizeRef.current
      if (w > 0 && h > 0) setVp(fitDomain(state.domain, w, h))
    })
  }, [])

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    const pointer = stage?.getPointerPosition()
    if (!pointer) return
    const factor = e.evt.deltaY < 0 ? 1.1 : 1 / 1.1
    setVp((v) => zoomAt(v, factor, pointer.x, pointer.y))
  }

  // Drag-to-pan on empty canvas.
  const panning = useRef<{ x: number; y: number } | null>(null)
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    const p = stage?.getPointerPosition()
    if (p) panning.current = { x: p.x, y: p.y }
  }
  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!panning.current) return
    const stage = e.target.getStage()
    const p = stage?.getPointerPosition()
    if (!p) return
    const dx = p.x - panning.current.x
    const dy = p.y - panning.current.y
    panning.current = { x: p.x, y: p.y }
    setVp((v) => panBy(v, dx, dy))
  }
  const endPan = () => {
    panning.current = null
  }

  const gridLines = computeGridLines(vp, size.w, size.h, domain.gridSpacing)
  const colorOf = (mattype: number) =>
    materials.find((m) => m.mattype === mattype)?.color ?? materialColor(mattype)

  // Domain rectangle (top-left at xmin, zmax; z=0 surface is up).
  const domTL = worldToScreen(vp, domain.xmin, domain.zmax)
  const domBR = worldToScreen(vp, domain.xmax, domain.zmin)

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-neutral-100">
      {size.w > 0 && size.h > 0 && (
        <Stage
          width={size.w}
          height={size.h}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={endPan}
          onMouseLeave={endPan}
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

          <Layer listening={false}>
            {regions.map((r) => {
              const s = worldToScreen(vp, r.x, r.z)
              return (
                <Circle
                  key={r.id}
                  x={s.sx}
                  y={s.sy}
                  radius={POINT_RADIUS + 2}
                  fill={colorOf(r.mattype)}
                  opacity={0.35}
                  stroke={colorOf(r.mattype)}
                  strokeWidth={1.5}
                />
              )
            })}
            {segments.map((seg) => {
              const p0 = points.find((p) => p.id === seg.p0)
              const p1 = points.find((p) => p.id === seg.p1)
              if (!p0 || !p1) return null
              const a = worldToScreen(vp, p0.x, p0.z)
              const b = worldToScreen(vp, p1.x, p1.z)
              return (
                <Line
                  key={seg.id}
                  points={[a.sx, a.sy, b.sx, b.sy]}
                  stroke={boundaryColor(seg.bdryFlag)}
                  strokeWidth={SEGMENT_WIDTH}
                  dash={boundaryDash(seg.bdryFlag)}
                />
              )
            })}
            {points.map((p) => {
              const s = worldToScreen(vp, p.x, p.z)
              return (
                <Circle
                  key={p.id}
                  x={s.sx}
                  y={s.sy}
                  radius={POINT_RADIUS}
                  fill="#1f2937"
                  stroke="#ffffff"
                  strokeWidth={1}
                />
              )
            })}
          </Layer>
        </Stage>
      )}
    </div>
  )
}
