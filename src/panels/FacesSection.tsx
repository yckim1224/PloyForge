import { useMemo } from 'react'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { EntityTable, type Column } from '../components/EntityTable'
import { useEditorStore } from '../store/editorStore'
import { useSettingsStore } from '../store/settingsStore'
import { materialColor } from '../constants/materials'
import type { Face } from '../types'

const PATHS_MAX = 8

function formatPaths(face: Face, pointIndex: Map<string, number>): string {
  const indices = face.pointIds.map((pid) => pointIndex.get(pid) ?? '?')
  if (indices.length <= PATHS_MAX) return indices.join('→')
  return `${indices.slice(0, PATHS_MAX).join('→')}…`
}

export function FacesSection() {
  const faces = useEditorStore((s) => s.faces)
  const points = useEditorStore((s) => s.points)
  const faceIds = useEditorStore((s) => s.selection.faceIds)
  const materials = useSettingsStore((s) => s.materials)

  const selectedIds = useMemo(() => new Set(faceIds), [faceIds])
  const pointIndex = useMemo(() => {
    const m = new Map<string, number>()
    points.forEach((p, i) => m.set(p.id, i))
    return m
  }, [points])

  const columns: Column<Face>[] = useMemo(() => {
    const colorFor = (m: number | undefined): string => {
      if (m === undefined) return '#cbd5e1'
      return materials.find((entry) => entry.mattype === m)?.color ?? materialColor(m)
    }
    return [
      {
        key: 'id',
        header: 'ID',
        render: (_f, idx) => idx,
        className: 'w-10 text-neutral-500',
      },
      {
        key: 'paths',
        header: 'Paths',
        render: (f) => (
          <span title={f.pointIds.map((pid) => pointIndex.get(pid) ?? '?').join('→')}>
            {formatPaths(f, pointIndex)}
          </span>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        render: (f) => (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-3 shrink-0 rounded-sm ring-1 ring-black/10"
              style={{ backgroundColor: colorFor(f.mattype) }}
            />
            <span>{f.mattype ?? '—'}</span>
          </span>
        ),
      },
    ]
  }, [pointIndex, materials])

  const onToggleRow = (id: string, additive: boolean) => {
    const store = useEditorStore.getState()
    if (additive) store.toggleSelect('face', id)
    else store.selectSingle('face', id)
  }

  const onToggleAll = () => {
    const store = useEditorStore.getState()
    if (selectedIds.size === faces.length && faces.length > 0) store.clearSelection()
    else store.selectMany('face', faces.map((f) => f.id))
  }

  return (
    <CollapsibleSection title="Faces" count={faces.length}>
      <EntityTable
        columns={columns}
        rows={faces}
        selectedIds={selectedIds}
        onToggleRow={onToggleRow}
        onToggleAll={onToggleAll}
      />
    </CollapsibleSection>
  )
}
