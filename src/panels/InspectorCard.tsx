import { Button } from '@heroui/react'
import { Wand2 } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import { NumberValue } from '../components/fields'
import { BOUNDARY_OPTIONS_2D, boundaryColor } from '../poly/boundary'
import { pointInPolygon, type Vec2 } from '../lib/geometry'
import { materialColor } from '../constants/materials'
import type { Region } from '../types'

const selectClass =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm focus:border-violet-500 focus:outline-none'

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-3 shrink-0 rounded-sm ring-1 ring-black/10"
      style={{ backgroundColor: color }}
    />
  )
}

function SizeControl({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const unlimited = value < 0
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-neutral-500">Max element size</span>
      <label className="flex items-center gap-2 text-xs text-neutral-600">
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(e) => onCommit(e.target.checked ? -1 : 1)}
          className="accent-violet-600"
        />
        Unlimited (-1)
      </label>
      {!unlimited && (
        <input
          type="number"
          step="any"
          defaultValue={value}
          key={value}
          onBlur={(e) => {
            const n = e.target.valueAsNumber
            if (Number.isFinite(n)) onCommit(n)
          }}
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm tabular-nums focus:border-violet-500 focus:outline-none"
        />
      )}
    </div>
  )
}

function PointInspector() {
  const pointIds = useEditorStore((s) => s.selection.pointIds)
  const points = useEditorStore((s) => s.points)
  const updatePoint = useEditorStore((s) => s.updatePoint)
  if (pointIds.length === 1) {
    const p = points.find((x) => x.id === pointIds[0])
    if (!p) return null
    return (
      <div className="grid grid-cols-2 gap-2">
        <NumberValue label="x (m)" value={p.x} onCommit={(v) => updatePoint(p.id, { x: v })} />
        <NumberValue label="z (m)" value={p.z} onCommit={(v) => updatePoint(p.id, { z: v })} />
      </div>
    )
  }
  return <p className="text-xs text-neutral-500">{pointIds.length} points selected.</p>
}

function SegmentInspector() {
  const segmentIds = useEditorStore((s) => s.selection.segmentIds)
  const segments = useEditorStore((s) => s.segments)
  const setSegmentFlag = useEditorStore((s) => s.setSegmentFlag)
  const autoAssign = useEditorStore((s) => s.autoAssignBoundaryFlags)

  const selected = segments.filter((s) => segmentIds.includes(s.id))
  const flags = new Set(selected.map((s) => s.bdryFlag))
  const shared = flags.size === 1 ? [...flags][0] : ''

  return (
    <div className="flex flex-col gap-2">
      {segmentIds.length > 1 && (
        <p className="text-xs text-neutral-500">{segmentIds.length} segments selected.</p>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500">Boundary flag</span>
        <div className="flex items-center gap-2">
          {shared !== '' && <Swatch color={boundaryColor(shared)} />}
          <select
            value={String(shared)}
            onChange={(e) => setSegmentFlag(segmentIds, Number(e.target.value))}
            className={selectClass}
          >
            {shared === '' && <option value="">— mixed —</option>}
            {BOUNDARY_OPTIONS_2D.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} ({o.value})
              </option>
            ))}
          </select>
        </div>
      </label>
      <Button size="sm" variant="secondary" onPress={() => autoAssign(segmentIds)}>
        <Wand2 className="size-4" />
        Auto-assign from extent
      </Button>
    </div>
  )
}

function regionForFace(verts: Vec2[], regions: Region[]): Region | undefined {
  return regions.find((r) => pointInPolygon({ x: r.x, z: r.z }, verts))
}

function FaceInspector() {
  const faceIds = useEditorStore((s) => s.selection.faceIds)
  const faces = useEditorStore((s) => s.faces)
  const points = useEditorStore((s) => s.points)
  const regions = useEditorStore((s) => s.regions)
  const applyFaceMaterial = useEditorStore((s) => s.applyFaceMaterial)

  const byId = new Map(points.map((p) => [p.id, p]))
  const single = faceIds.length === 1 ? faces.find((f) => f.id === faceIds[0]) : undefined
  let mattype = 0
  let size = -1
  if (single) {
    const verts = single.pointIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ x: p.x, z: p.z }))
    const region = regionForFace(verts, regions)
    if (region) {
      mattype = region.mattype
      size = region.size
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {faceIds.length > 1 && (
        <p className="text-xs text-neutral-500">{faceIds.length} faces selected.</p>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <NumberValue
            label="Material type (mattype)"
            value={mattype}
            step="1"
            onCommit={(v) => applyFaceMaterial(faceIds, { mattype: Math.max(0, Math.round(v)) })}
          />
        </div>
        <Swatch color={materialColor(mattype)} />
      </div>
      <SizeControl value={size} onCommit={(v) => applyFaceMaterial(faceIds, { size: v })} />
      <p className="text-xs text-neutral-400">
        Assigning a material places a region seed at the face center.
      </p>
    </div>
  )
}

function RegionInspector() {
  const regionIds = useEditorStore((s) => s.selection.regionIds)
  const regions = useEditorStore((s) => s.regions)
  const updateRegion = useEditorStore((s) => s.updateRegion)
  const applyAll = (patch: { mattype?: number; size?: number }) =>
    regionIds.forEach((id) => updateRegion(id, patch))

  const single = regionIds.length === 1 ? regions.find((r) => r.id === regionIds[0]) : undefined

  return (
    <div className="flex flex-col gap-2">
      {regionIds.length > 1 && (
        <p className="text-xs text-neutral-500">{regionIds.length} regions selected.</p>
      )}
      {single && (
        <div className="grid grid-cols-2 gap-2">
          <NumberValue label="x (m)" value={single.x} onCommit={(v) => updateRegion(single.id, { x: v })} />
          <NumberValue label="z (m)" value={single.z} onCommit={(v) => updateRegion(single.id, { z: v })} />
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <NumberValue
            label="Material type (mattype)"
            value={single ? single.mattype : 0}
            step="1"
            onCommit={(v) => applyAll({ mattype: Math.max(0, Math.round(v)) })}
          />
        </div>
        <Swatch color={materialColor(single ? single.mattype : 0)} />
      </div>
      <SizeControl value={single ? single.size : -1} onCommit={(v) => applyAll({ size: v })} />
    </div>
  )
}

export function InspectorCard() {
  const { pointIds, segmentIds, faceIds, regionIds } = useEditorStore((s) => s.selection)
  if (pointIds.length) return <PointInspector />
  if (segmentIds.length) return <SegmentInspector />
  if (faceIds.length) return <FaceInspector />
  if (regionIds.length) return <RegionInspector />
  return (
    <p className="text-xs text-neutral-400">
      Select a point, segment, face, or region to edit its properties.
    </p>
  )
}
