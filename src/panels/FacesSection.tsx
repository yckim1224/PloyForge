import { useMemo, useState } from 'react'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { EntityTable, type Column } from '../components/EntityTable'
import { SelectionBar } from '../components/SelectionBar'
import { InputModal } from '../components/InputModal'
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

function parseIntOrNull(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

export function FacesSection() {
  const faces = useEditorStore((s) => s.faces)
  const points = useEditorStore((s) => s.points)
  const faceIds = useEditorStore((s) => s.selection.faceIds)
  const materials = useSettingsStore((s) => s.materials)
  const [setTypeModal, setSetTypeModal] = useState(false)

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
        edit: {
          type: 'number',
          allowEmpty: true,
          parse: parseIntOrNull,
          seed: (f) => (f.mattype === undefined ? '' : String(f.mattype)),
          onCommit: (f, _idx, v) => {
            const size = f.size ?? -1
            useEditorStore.getState().setFaceType(f.id, v, size)
          },
          onClear: (f) => {
            useEditorStore.getState().clearFaceType(f.id)
          },
        },
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
      <SelectionBar
        count={faceIds.length}
        noun="face"
        items={[
          {
            key: 'set-type',
            label: 'Set type…',
            onSelect: () => setSetTypeModal(true),
          },
          {
            key: 'clear-type',
            label: 'Clear type',
            onSelect: () => {
              const store = useEditorStore.getState()
              for (const fid of faceIds) store.clearFaceType(fid)
            },
          },
        ]}
      />
      <InputModal
        open={setTypeModal}
        title="Set face type"
        fields={[
          {
            key: 'mattype',
            label: 'Material type (mattype)',
            type: 'number',
            initialValue: 0,
            min: 0,
            step: 1,
            required: true,
          },
          {
            key: 'size',
            label: 'Max element size (-1 = unlimited)',
            type: 'number',
            initialValue: -1,
            step: 0.1,
          },
        ]}
        onCancel={() => setSetTypeModal(false)}
        onConfirm={(values) => {
          const mattype = values.mattype
          const size = values.size
          if (typeof mattype !== 'number') {
            setSetTypeModal(false)
            return
          }
          const store = useEditorStore.getState()
          const sizeNum = typeof size === 'number' ? size : -1
          for (const fid of faceIds) store.setFaceType(fid, mattype, sizeNum)
          setSetTypeModal(false)
        }}
      />
    </CollapsibleSection>
  )
}
