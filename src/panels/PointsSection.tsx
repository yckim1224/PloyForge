import { useMemo, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { EntityTable, type Column } from '../components/EntityTable'
import { AddRow, type AddRowField } from '../components/AddRow'
import { SelectionBar } from '../components/SelectionBar'
import { ConfirmModal } from '../components/ConfirmModal'
import { Menu } from '../components/Menu'
import { useEditorStore } from '../store/editorStore'
import { parseFloatOrNull, parseIntOrNull } from '../lib/parsers'
import type { Point } from '../types'

const ADD_FIELDS: AddRowField[] = [
  {
    key: 'id',
    placeholder: 'ID (blank = end)',
    type: 'number',
    parse: parseIntOrNull,
  },
  { key: 'x', placeholder: 'X', type: 'number', parse: parseFloatOrNull, required: true },
  { key: 'z', placeholder: 'Z', type: 'number', parse: parseFloatOrNull, required: true },
]

export function PointsSection() {
  const points = useEditorStore((s) => s.points)
  const pointIds = useEditorStore((s) => s.selection.pointIds)
  const selectedIds = useMemo(() => new Set(pointIds), [pointIds])
  const [confirmDelete, setConfirmDelete] = useState(false)

  const onToggleRow = (id: string, additive: boolean) => {
    const store = useEditorStore.getState()
    if (additive) store.toggleSelect('point', id)
    else store.selectSingle('point', id)
  }

  const onToggleAll = () => {
    const store = useEditorStore.getState()
    if (selectedIds.size === points.length && points.length > 0) store.clearSelection()
    else store.selectMany('point', points.map((p) => p.id))
  }

  const columns: Column<Point>[] = useMemo(
    () => [
      {
        key: 'id',
        header: 'ID',
        render: (_p, idx) => idx,
        className: 'w-10 text-neutral-500',
        edit: {
          type: 'number',
          parse: parseIntOrNull,
          onCommit: (p, _idx, v) => useEditorStore.getState().movePointToIndex(p.id, v),
        },
      },
      {
        key: 'x',
        header: 'X',
        render: (p) => p.x.toFixed(1),
        edit: {
          type: 'number',
          parse: parseFloatOrNull,
          onCommit: (p, _idx, v) => useEditorStore.getState().updatePoint(p.id, { x: v }),
        },
      },
      {
        key: 'z',
        header: 'Z',
        render: (p) => p.z.toFixed(1),
        edit: {
          type: 'number',
          parse: parseFloatOrNull,
          onCommit: (p, _idx, v) => useEditorStore.getState().updatePoint(p.id, { z: v }),
        },
      },
    ],
    [],
  )

  const onAdd = (values: Record<string, number | null>) => {
    const x = values.x
    const z = values.z
    if (x === null || z === null) return { ok: false, error: 'X and Z are required' }
    const idx = values.id
    useEditorStore.getState().insertPoint(idx, x, z)
    return { ok: true }
  }

  const headerMenu = (
    <Menu
      align="right"
      trigger={
        <button
          type="button"
          aria-label="Points actions"
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <MoreHorizontal className="size-4" />
        </button>
      }
      items={[
        {
          key: 'sort-lr',
          label: 'Sort left → right',
          onSelect: () => useEditorStore.getState().sortPointsBy('x', 'asc'),
        },
        {
          key: 'sort-tb',
          label: 'Sort top → bottom',
          onSelect: () => useEditorStore.getState().sortPointsBy('z', 'desc'),
        },
        {
          key: 'remove-isolated',
          label: 'Remove isolated points',
          destructive: true,
          onSelect: () => useEditorStore.getState().removeIsolatedPoints(),
        },
        {
          key: 'remove-all',
          label: 'Remove all points',
          destructive: true,
          onSelect: () => useEditorStore.getState().removeAllPoints(),
        },
      ]}
    />
  )

  return (
    <CollapsibleSection title="Points" count={points.length} headerRight={headerMenu}>
      <EntityTable
        columns={columns}
        rows={points}
        selectedIds={selectedIds}
        onToggleRow={onToggleRow}
        onToggleAll={onToggleAll}
      />
      <AddRow fields={ADD_FIELDS} onAdd={onAdd} />
      <SelectionBar
        count={pointIds.length}
        noun="point"
        items={[
          {
            key: 'delete',
            label: 'Delete all selected',
            destructive: true,
            onSelect: () => setConfirmDelete(true),
          },
        ]}
      />
      <ConfirmModal
        open={confirmDelete}
        title="Delete points"
        message={`Delete ${pointIds.length} selected point${pointIds.length === 1 ? '' : 's'}? Incident lines will be removed as well.`}
        destructive
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          useEditorStore.getState().removePoints(pointIds)
          setConfirmDelete(false)
        }}
      />
    </CollapsibleSection>
  )
}
