import { useMemo } from 'react'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { EntityTable, type Column } from '../components/EntityTable'
import { useEditorStore } from '../store/editorStore'
import type { Line } from '../types'

export function LinesSection() {
  const lines = useEditorStore((s) => s.lines)
  const points = useEditorStore((s) => s.points)
  const lineIds = useEditorStore((s) => s.selection.lineIds)
  const selectedIds = useMemo(() => new Set(lineIds), [lineIds])
  // P0/P1 are stored as point uids; render the *display* index (array slot).
  const pointIndex = useMemo(() => {
    const m = new Map<string, number>()
    points.forEach((p, i) => m.set(p.id, i))
    return m
  }, [points])

  const columns: Column<Line>[] = useMemo(
    () => [
      {
        key: 'id',
        header: 'ID',
        render: (_l, idx) => idx,
        className: 'w-10 text-neutral-500',
      },
      {
        key: 'p0',
        header: 'P0',
        render: (l) => pointIndex.get(l.p0) ?? '—',
      },
      {
        key: 'p1',
        header: 'P1',
        render: (l) => pointIndex.get(l.p1) ?? '—',
      },
      {
        key: 'bf',
        header: 'BF',
        render: (l) => l.bdryFlag,
      },
    ],
    [pointIndex],
  )

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

  return (
    <CollapsibleSection title="Lines" count={lines.length}>
      <EntityTable
        columns={columns}
        rows={lines}
        selectedIds={selectedIds}
        onToggleRow={onToggleRow}
        onToggleAll={onToggleAll}
      />
    </CollapsibleSection>
  )
}
