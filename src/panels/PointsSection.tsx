import { useMemo } from 'react'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { EntityTable, type Column } from '../components/EntityTable'
import { useEditorStore } from '../store/editorStore'
import type { Point } from '../types'

const COLUMNS: Column<Point>[] = [
  {
    key: 'id',
    header: 'ID',
    render: (_p, idx) => idx,
    className: 'w-10 text-neutral-500',
  },
  {
    key: 'x',
    header: 'X',
    render: (p) => p.x.toFixed(1),
  },
  {
    key: 'z',
    header: 'Z',
    render: (p) => p.z.toFixed(1),
  },
]

export function PointsSection() {
  const points = useEditorStore((s) => s.points)
  const pointIds = useEditorStore((s) => s.selection.pointIds)
  const selectedIds = useMemo(() => new Set(pointIds), [pointIds])

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

  return (
    <CollapsibleSection title="Points" count={points.length}>
      <EntityTable
        columns={COLUMNS}
        rows={points}
        selectedIds={selectedIds}
        onToggleRow={onToggleRow}
        onToggleAll={onToggleAll}
      />
    </CollapsibleSection>
  )
}
