import { Button } from '@heroui/react'
import { Wand2 } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import { useSettingsStore } from '../store/settingsStore'
import { NumberValue } from '../components/fields'
import { BOUNDARY_OPTIONS_2D, boundaryColor } from '../poly/boundary'
import { materialColor } from '../constants/materials'

const selectClass =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'

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
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm tabular-nums focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
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

function LineInspector() {
  const lineIds = useEditorStore((s) => s.selection.lineIds)
  const lines = useEditorStore((s) => s.lines)
  const setLineFlag = useEditorStore((s) => s.setLineFlag)
  const autoAssign = useEditorStore((s) => s.autoAssignBoundaryFlags)

  const selected = lines.filter((s) => lineIds.includes(s.id))
  const flags = new Set(selected.map((s) => s.bdryFlag))
  const shared: number | '' = flags.size === 1 ? [...flags][0] : ''

  return (
    <div className="flex flex-col gap-2">
      {lineIds.length > 1 && (
        <p className="text-xs text-neutral-500">{lineIds.length} segments selected.</p>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500">Boundary flag</span>
        <div className="flex items-center gap-2">
          {shared !== '' && <Swatch color={boundaryColor(shared)} />}
          <select
            value={String(shared)}
            onChange={(e) => setLineFlag(lineIds, Number(e.target.value))}
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
      <Button size="sm" variant="secondary" onPress={() => autoAssign(lineIds)}>
        <Wand2 className="size-4" />
        Auto-assign from extent
      </Button>
    </div>
  )
}

function FaceInspector() {
  const faceIds = useEditorStore((s) => s.selection.faceIds)
  const faces = useEditorStore((s) => s.faces)
  const setFaceType = useEditorStore((s) => s.setFaceType)
  const materials = useSettingsStore((s) => s.materials)

  const single = faceIds.length === 1 ? faces.find((f) => f.id === faceIds[0]) : undefined
  const mattype = single?.mattype ?? 0
  const size = single?.size ?? -1

  const colorFor = (m: number) =>
    materials.find((entry) => entry.mattype === m)?.color ?? materialColor(m)

  const applyAll = (patch: { mattype?: number; size?: number }) => {
    for (const fid of faceIds) {
      const face = faces.find((f) => f.id === fid)
      const currentMattype = face?.mattype ?? 0
      const currentSize = face?.size ?? -1
      setFaceType(
        fid,
        patch.mattype ?? currentMattype,
        patch.size ?? currentSize,
      )
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
            onCommit={(v) => applyAll({ mattype: Math.max(0, Math.round(v)) })}
          />
        </div>
        <Swatch color={colorFor(mattype)} />
      </div>
      <SizeControl value={size} onCommit={(v) => applyAll({ size: v })} />
      <p className="text-xs text-neutral-400">
        Assigning a Type records the face's material in the document's face-keyed map.
      </p>
    </div>
  )
}

export function InspectorCard() {
  const { pointIds, lineIds, faceIds } = useEditorStore((s) => s.selection)
  if (pointIds.length) return <PointInspector />
  if (lineIds.length) return <LineInspector />
  if (faceIds.length) return <FaceInspector />
  return (
    <p className="text-xs text-neutral-400">
      Select a point, segment, or face to edit its properties.
    </p>
  )
}
