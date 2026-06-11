import { useMemo, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { EntityTable, type Column, type ColumnEditOption } from '../components/EntityTable'
import { AddRow, type AddRowField, type AddRowFieldOption } from '../components/AddRow'
import { SelectionBar } from '../components/SelectionBar'
import { ConfirmModal } from '../components/ConfirmModal'
import { InputModal } from '../components/InputModal'
import { Menu } from '../components/Menu'
import { useEditorStore } from '../store/editorStore'
import { useSettingsStore, type BoundaryFlagKey } from '../store/settingsStore'
import { BOUNDARY_OPTIONS_2D } from '../poly/boundary'
import { parseIntOrNull } from '../lib/parsers'
import { usePointIndex } from '../lib/usePointIndex'
import type { Line } from '../types'

/** Short label per boundary flag value. */
const BF_SHORT: Record<number, string> = { 0: 'I', 1: 'X0', 2: 'X1', 16: 'Z0', 32: 'Z1' }

function BfCell({ bf }: { bf: number }) {
  const styleByFlag = useSettingsStore((s) => s.line.styleByFlag)
  const label = BF_SHORT[bf] ?? String(bf)
  if (bf === 0) {
    return <span className="font-medium text-neutral-400 dark:text-neutral-500">{label}</span>
  }
  const style = styleByFlag[bf as BoundaryFlagKey]
  return (
    <span className="font-medium tabular-nums" style={{ color: style?.color }}>
      {label}
    </span>
  )
}

const BF_OPTIONS: ColumnEditOption[] = BOUNDARY_OPTIONS_2D.map((o) => ({
  label: o.value === 0 ? 'Internal (0)' : `${o.short} (${o.value})`,
  value: o.value,
}))

const ADD_BF_OPTIONS: AddRowFieldOption[] = BF_OPTIONS

export function LinesSection() {
  const lines = useEditorStore((s) => s.lines)
  const points = useEditorStore((s) => s.points)
  const lineIds = useEditorStore((s) => s.selection.lineIds)
  const selectedIds = useMemo(() => new Set(lineIds), [lineIds])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [bfModal, setBfModal] = useState(false)

  // P0/P1 are stored as point uids; render the *display* index (array slot).
  const pointIndex = usePointIndex(points)

  const indexToId = (idx: number): string | null => {
    if (!Number.isInteger(idx) || idx < 0 || idx >= points.length) return null
    return points[idx].id
  }

  const columns: Column<Line>[] = useMemo(() => {
    const parseIdx = (raw: string): number | null => {
      const n = parseIntOrNull(raw)
      if (n === null) return null
      return n >= 0 && n < points.length ? n : null
    }
    const idAt = (i: number): string | null =>
      Number.isInteger(i) && i >= 0 && i < points.length ? points[i].id : null
    return [
      {
        key: 'id',
        header: 'ID',
        render: (_l, idx) => idx,
        className: 'w-10 text-neutral-500',
        edit: {
          type: 'number',
          parse: parseIntOrNull,
          onCommit: (l, _idx, v) => useEditorStore.getState().moveLineToIndex(l.id, v),
        },
      },
      {
        key: 'p0',
        header: 'P0',
        render: (l) => pointIndex.get(l.p0) ?? '—',
        edit: {
          type: 'number',
          parse: parseIdx,
          onCommit: (l, _idx, v) => {
            const id = idAt(v)
            if (id !== null) useEditorStore.getState().updateLine(l.id, { p0: id })
          },
        },
      },
      {
        key: 'p1',
        header: 'P1',
        render: (l) => pointIndex.get(l.p1) ?? '—',
        edit: {
          type: 'number',
          parse: parseIdx,
          onCommit: (l, _idx, v) => {
            const id = idAt(v)
            if (id !== null) useEditorStore.getState().updateLine(l.id, { p1: id })
          },
        },
      },
      {
        key: 'bf',
        header: 'BF',
        render: (l) => <BfCell bf={l.bdryFlag} />,
        edit: {
          type: 'select',
          options: BF_OPTIONS,
          parse: (raw) => {
            const n = parseIntOrNull(raw)
            if (n === null) return null
            return BF_OPTIONS.some((o) => o.value === n) ? n : null
          },
          onCommit: (l, _idx, v) => useEditorStore.getState().updateLine(l.id, { bdryFlag: v }),
        },
      },
    ]
  }, [pointIndex, points])

  const onToggleRow = (id: string, additive: boolean) => {
    const store = useEditorStore.getState()
    if (additive) store.toggleSelect('line', id)
    else store.selectSingle('line', id)
  }

  const onToggleAll = () => {
    const store = useEditorStore.getState()
    if (selectedIds.size === lines.length && lines.length > 0) store.clearSelection()
    else store.selectMany('line', lines.map((l) => l.id))
  }

  const ADD_FIELDS: AddRowField[] = useMemo(() => {
    const parseIdx = (raw: string): number | null => {
      const n = parseIntOrNull(raw)
      if (n === null) return null
      return n >= 0 && n < points.length ? n : null
    }
    return [
      { key: 'id', placeholder: 'ID (blank = end)', type: 'number', parse: parseIntOrNull },
      { key: 'p0', placeholder: 'P0', type: 'number', parse: parseIdx, required: true },
      { key: 'p1', placeholder: 'P1', type: 'number', parse: parseIdx, required: true },
      {
        key: 'bf',
        placeholder: 'BF',
        type: 'select',
        options: ADD_BF_OPTIONS,
        parse: (raw) => {
          const n = parseIntOrNull(raw)
          if (n === null) return null
          return BF_OPTIONS.some((o) => o.value === n) ? n : null
        },
      },
    ]
  }, [points])

  const onAdd = (values: Record<string, number | null>) => {
    const p0 = values.p0
    const p1 = values.p1
    if (p0 === null || p1 === null) return { ok: false, error: 'P0 and P1 are required' }
    const id0 = indexToId(p0)
    const id1 = indexToId(p1)
    if (!id0 || !id1) return { ok: false, error: 'P0/P1 out of range' }
    if (id0 === id1) return { ok: false, error: 'Self-loops are not allowed' }
    const bf = values.bf ?? 0
    const result = useEditorStore.getState().insertLine(values.id, id0, id1, bf)
    if (result === null) return { ok: false, error: 'Duplicate or invalid line' }
    return { ok: true }
  }

  return (
    <CollapsibleSection
      title="Lines"
      count={lines.length}
      headerRight={
        <Menu
          align="right"
          trigger={
            <span
              aria-label="Line section menu"
              className="flex size-6 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <MoreHorizontal className="size-4" />
            </span>
          }
          items={[
            {
              key: 'auto-all',
              label: 'Auto-assign boundary flags (all)',
              onSelect: () => useEditorStore.getState().autoAssignBoundaryFlags(),
            },
            {
              key: 'remove-non-face',
              label: 'Remove non-face lines',
              destructive: true,
              onSelect: () => useEditorStore.getState().removeNonFaceLines(),
            },
            {
              key: 'remove-all',
              label: 'Remove all lines',
              destructive: true,
              onSelect: () => useEditorStore.getState().removeAllLines(),
            },
          ]}
        />
      }
    >
      <EntityTable
        columns={columns}
        rows={lines}
        selectedIds={selectedIds}
        onToggleRow={onToggleRow}
        onToggleAll={onToggleAll}
      />
      <AddRow fields={ADD_FIELDS} onAdd={onAdd} />
      <SelectionBar
        count={lineIds.length}
        noun="line"
        items={[
          {
            key: 'delete',
            label: 'Delete all selected',
            destructive: true,
            onSelect: () => setConfirmDelete(true),
          },
          {
            key: 'set-bf',
            label: 'Set boundary flag…',
            onSelect: () => setBfModal(true),
          },
          {
            key: 'auto-sel',
            label: 'Auto-assign BF (selected)',
            onSelect: () => useEditorStore.getState().autoAssignBoundaryFlags(lineIds),
          },
        ]}
      />
      <ConfirmModal
        open={confirmDelete}
        title="Delete lines"
        message={`Delete ${lineIds.length} selected line${lineIds.length === 1 ? '' : 's'}?`}
        destructive
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          useEditorStore.getState().removeLines(lineIds)
          setConfirmDelete(false)
        }}
      />
      <InputModal
        open={bfModal}
        title="Set boundary flag"
        fields={[
          {
            key: 'bf',
            label: 'Boundary flag',
            type: 'select',
            options: BF_OPTIONS,
            initialValue: 0,
          },
        ]}
        onCancel={() => setBfModal(false)}
        onConfirm={(values) => {
          const v = values.bf
          if (typeof v === 'number') useEditorStore.getState().setLineFlag(lineIds, v)
          setBfModal(false)
        }}
      />
    </CollapsibleSection>
  )
}
