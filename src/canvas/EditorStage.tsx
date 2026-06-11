import { useEffect, useRef, useState } from 'react'
import { Circle, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from 'react-konva'
import type { BackgroundImage } from '../types'
import { useEditorStore } from '../store/editorStore'
import { useSettingsStore } from '../store/settingsStore'
import { useLayerStore } from '../store/layerStore'
import { materialColor } from '../constants/materials'
import { facePointsToVecs, type Vec2 } from '../lib/geometry'
import { Toolbar } from '../components/Toolbar'
import { Tooltip } from '../components/Tooltip'
import { LayerOverlay } from './LayerOverlay'
import { HelpContent } from './HelpContent'
import { Crosshair, HelpCircle } from 'lucide-react'
import { computeGridLabels, computeGridLines } from './grid'
import { fitPoints, worldToScreen, type Viewport } from './viewport'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useCanvasGesture } from './useCanvasGesture'
import { BackgroundImageEditor } from './BackgroundImageEditor'

const HUD_EMPTY = 'x —   z —'
/** Grid-axis label styling (used when the grid layer is in 'labeled' mode). */
const GRID_LABEL_FONT_SIZE = 11
const GRID_LABEL_PAD_PX = 4
const GRID_LABEL_COLOR = '#475569'
/** Bottom-left x-coordinate below which we skip x-labels to avoid the HUD chip. */
const GRID_LABEL_HUD_RESERVE_PX = 140

function StageActions({ onFit }: { onFit: () => void }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white/95 p-1 shadow-sm backdrop-blur">
      <Tooltip content={<HelpContent />} placement="bottom">
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

/** Two opposite world corners of the background image's bounding box (or none). */
function backgroundCorners(bg: BackgroundImage | null): { x: number; z: number }[] {
  if (!bg) return []
  return [
    { x: bg.x, z: bg.z },
    { x: bg.x + bg.naturalWidth * bg.scaleX, z: bg.z - bg.naturalHeight * bg.scaleZ },
  ]
}

export function EditorStage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [vp, setVp] = useState<Viewport>({ scale: 1, originX: 0, originY: 0 })
  const didInit = useRef(false)
  const sizeRef = useRef({ w: 0, h: 0 })
  const hudRef = useRef<HTMLDivElement>(null)

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
  const translateSelectionBy = useEditorStore((s) => s.translateSelectionBy)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const setTool = useEditorStore((s) => s.setTool)
  const setPendingLineStart = useEditorStore((s) => s.setPendingLineStart)
  const deleteSelection = useEditorStore((s) => s.deleteSelection)

  const background = useEditorStore((s) => s.background)
  const backgroundSelected = useEditorStore((s) => s.backgroundSelected)
  const updateBackground = useEditorStore((s) => s.updateBackground)
  const nudgeBackground = useEditorStore((s) => s.nudgeBackground)
  const removeBackground = useEditorStore((s) => s.removeBackground)
  const backgroundVisible = useEditorStore((s) => s.backgroundVisible)
  const backgroundLockAspect = useEditorStore((s) => s.backgroundLockAspect)
  // Selected image with the select tool active -> lift to the top and make it
  // mouse-editable (drag to move, Transformer handles to resize).
  const bgEditMode =
    background !== null && backgroundVisible && backgroundSelected && tool === 'select'
  // The image's top-left in screen space, used by the beneath-grid view layer.
  // (The edit-mode layer recomputes its own screen position inside the editor.)
  const bgScreen = background ? worldToScreen(vp, background.x, background.z) : null

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
        const st = useEditorStore.getState()
        setVp(fitPoints(st.points, w, h, undefined, backgroundCorners(st.background)))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    return useEditorStore.subscribe((state, prev) => {
      if (state.fitNonce === prev.fitNonce) return
      const { w, h } = sizeRef.current
      if (w > 0 && h > 0)
        setVp(fitPoints(state.points, w, h, undefined, backgroundCorners(state.background)))
    })
  }, [])

  const gesture = useCanvasGesture({
    tool,
    selection,
    marqueeTarget,
    pendingLineStart,
    points,
    lines,
    faces,
    vp,
    gridSpacing: gridSettings.spacing,
    bgEditMode,
    hudRef,
    setVp,
    actions: {
      addPoint,
      addLine,
      selectSingle,
      selectMany,
      toggleSelect,
      clearSelection,
      setPendingLineStart,
      translateSelectionBy,
    },
  })
  const { drag, marquee, hover, spacePan } = gesture

  useKeyboardShortcuts({
    sizeRef,
    dragStartRef: gesture.dragStartRef,
    panningRef: gesture.panningRef,
    setVp,
    setSpacePan: gesture.setSpacePan,
    actions: {
      deleteSelection,
      clearSelection,
      setTool,
      setPendingLineStart,
      nudgeSelection,
      nudgeBackground,
      removeBackground,
    },
  })

  // Seed the coordinate HUD until the cursor first moves.
  useEffect(() => {
    if (hudRef.current) hudRef.current.textContent = HUD_EMPTY
  }, [])

  // Auto-show a hidden layer when items of that kind become selected
  // (e.g. checked from the panel) so ghost selections never linger.
  useEffect(() => {
    if (selection.pointIds.length > 0 && layerPoints === 'off') setLayer('points', 'on')
    if (selection.lineIds.length > 0 && layerLines === 'off') setLayer('lines', 'on')
    if (selection.faceIds.length > 0 && layerFaces === 'off') setLayer('faces', 'on')
  }, [
    selection.pointIds,
    selection.lineIds,
    selection.faceIds,
    layerPoints,
    layerLines,
    layerFaces,
    setLayer,
  ])

  // During a move drag, render the moved points (and the lines/faces that
  // reference them) offset by the live delta -- no store mutation until drop.
  const activeDrag = drag && (drag.dx !== 0 || drag.dz !== 0) ? drag : null
  const renderPoints = activeDrag
    ? points.map((p) =>
        activeDrag.ids.has(p.id) ? { ...p, x: p.x + activeDrag.dx, z: p.z + activeDrag.dz } : p,
      )
    : points
  const byId = new Map(renderPoints.map((p) => [p.id, p]))

  const gridLines = computeGridLines(vp, size.w, size.h, gridSettings.spacing)
  const gridLabels =
    layerGrid === 'labeled'
      ? computeGridLabels(vp, size.w, size.h, gridSettings.spacing)
      : []
  const colorOf = (mattype: number) =>
    materials.find((m) => m.mattype === mattype)?.color ?? materialColor(mattype)

  const selPoints = new Set(selection.pointIds)
  const selLines = new Set(selection.lineIds)
  const selFaces = new Set(selection.faceIds)

  const faceVerts = (pointIds: string[]): Vec2[] => facePointsToVecs(pointIds, byId)

  const lineStyleFor = (flag: number) => {
    const key = flag as 0 | 1 | 2 | 16 | 32
    return lineSettings.styleByFlag[key] ?? { color: '#a855f7', dash: [] }
  }

  const startPt = pendingLineStart ? byId.get(pendingLineStart) : undefined
  const startScreen = startPt ? worldToScreen(vp, startPt.x, startPt.z) : null

  const cursor = drag
    ? 'grabbing'
    : spacePan
      ? 'grab'
      : tool === 'pan'
        ? 'grab'
        : tool === 'point' || tool === 'line'
          ? 'crosshair'
          : 'default'

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-neutral-100">
      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-2">
        <StageActions onFit={requestFit} />
        <Toolbar />
        <LayerOverlay />
      </div>
      <div
        ref={hudRef}
        className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-md border border-neutral-200 bg-white/85 px-2 py-1 font-mono text-xs tabular-nums text-neutral-600 shadow-sm"
      />
      {size.w > 0 && size.h > 0 && (
        <Stage
          width={size.w}
          height={size.h}
          style={{ cursor }}
          {...gesture.handlers}
        >
          {background && bgScreen && backgroundVisible && !bgEditMode && (
            <Layer listening={false}>
              <KonvaImage
                image={background.img}
                x={bgScreen.sx}
                y={bgScreen.sy}
                width={background.naturalWidth * background.scaleX * vp.scale}
                height={background.naturalHeight * background.scaleZ * vp.scale}
                opacity={background.opacity}
              />
            </Layer>
          )}

          {gridSettings.show && layerGrid !== 'off' && (
            <Layer listening={false}>
              {gridLines.map((l, i) => {
                const stroke = l.axis
                  ? '#9ca3af'
                  : l.major
                    ? gridSettings.majorColor
                    : gridSettings.lineColor
                const strokeWidth = l.axis
                  ? Math.max(1.2, gridSettings.lineWidth)
                  : l.major
                    ? gridSettings.majorWidth
                    : gridSettings.lineWidth
                return <Line key={i} points={l.points} stroke={stroke} strokeWidth={strokeWidth} />
              })}
            </Layer>
          )}
          {gridSettings.show && layerGrid === 'labeled' && gridLabels.length > 0 && (
            <Layer listening={false}>
              {gridLabels.map((lb, i) => {
                if (lb.kind === 'x') {
                  // Bottom-pinned X-axis label; skip if it would collide with the HUD chip.
                  if (lb.screenPos < GRID_LABEL_HUD_RESERVE_PX) return null
                  return (
                    <Text
                      key={`gx-${i}`}
                      x={lb.screenPos - lb.text.length * 3}
                      y={size.h - GRID_LABEL_FONT_SIZE - GRID_LABEL_PAD_PX}
                      text={lb.text}
                      fontSize={GRID_LABEL_FONT_SIZE}
                      fill={GRID_LABEL_COLOR}
                    />
                  )
                }
                return (
                  <Text
                    key={`gz-${i}`}
                    x={GRID_LABEL_PAD_PX}
                    y={lb.screenPos - GRID_LABEL_FONT_SIZE / 2}
                    text={lb.text}
                    fontSize={GRID_LABEL_FONT_SIZE}
                    fill={GRID_LABEL_COLOR}
                  />
                )
              })}
            </Layer>
          )}

          {/* Faces, filled by the Type from `faceTypes` (gray when unassigned). */}
          {layerFaces !== 'off' && (
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

          {layerLines !== 'off' && (
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

          {layerPoints !== 'off' && (
          <Layer>
            {renderPoints.map((p) => {
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

          {(layerPoints === 'labeled' || layerLines === 'labeled' || layerFaces === 'labeled') && (
            <Layer listening={false}>
              {layerFaces === 'labeled' &&
                faces.map((f, i) => {
                  const s = worldToScreen(vp, f.centroid.x, f.centroid.z)
                  return (
                    <Text
                      key={`fl-${f.id}`}
                      x={s.sx - 12}
                      y={s.sy - 6}
                      text={`F${i}`}
                      fontSize={11}
                      fontStyle="bold"
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      fill="#1f2937"
                      shadowColor="#ffffff"
                      shadowBlur={3}
                      shadowOpacity={0.9}
                    />
                  )
                })}
              {layerLines === 'labeled' &&
                lines.map((seg, i) => {
                  const p0 = byId.get(seg.p0)
                  const p1 = byId.get(seg.p1)
                  if (!p0 || !p1) return null
                  const mx = (p0.x + p1.x) / 2
                  const mz = (p0.z + p1.z) / 2
                  const s = worldToScreen(vp, mx, mz)
                  return (
                    <Text
                      key={`ll-${seg.id}`}
                      x={s.sx + 4}
                      y={s.sy - 14}
                      text={`L${i}`}
                      fontSize={10}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      fill="#1f2937"
                      shadowColor="#ffffff"
                      shadowBlur={2}
                      shadowOpacity={0.9}
                    />
                  )
                })}
              {layerPoints === 'labeled' &&
                renderPoints.map((p, i) => {
                  const s = worldToScreen(vp, p.x, p.z)
                  return (
                    <Text
                      key={`pl-${p.id}`}
                      x={s.sx + pointSettings.radius + 3}
                      y={s.sy - pointSettings.radius - 8}
                      text={`P${i}`}
                      fontSize={10}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      fill="#1f2937"
                      shadowColor="#ffffff"
                      shadowBlur={2}
                      shadowOpacity={0.9}
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

          {/* Selected image rides on top so it can be freely dragged/resized. */}
          {background && bgEditMode && (
            <BackgroundImageEditor
              background={background}
              vp={vp}
              gridSpacing={gridSettings.spacing}
              lockAspect={backgroundLockAspect}
              onChange={updateBackground}
              onGestureEnd={gesture.markBackgroundGestureEnd}
            />
          )}
        </Stage>
      )}
    </div>
  )
}
