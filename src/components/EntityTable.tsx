import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'

export interface Column<T> {
  /** Stable column key (used for React keys). */
  key: string
  /** Header cell text. */
  header: string
  /** Renders the cell body for a given row. */
  render: (row: T, idx: number) => ReactNode
  /** Optional className applied to both th and td (for width/alignment). */
  className?: string
}

interface EntityTableProps<T extends { id: string }> {
  columns: Column<T>[]
  rows: T[]
  selectedIds: Set<string>
  /**
   * Toggle a single row. `additive` is true when the user used a modifier
   * (Shift / Ctrl / Meta) to extend the selection; false for a plain click.
   */
  onToggleRow: (id: string, additive: boolean) => void
  /** Toggle the entire visible set on/off (header checkbox). */
  onToggleAll: () => void
}

/**
 * Read-only entity table: a leading checkbox column plus caller-defined data
 * columns. The header checkbox shows an indeterminate state when only some
 * rows are selected. No inline editing, no delete-row affordances (those
 * arrive in Phase 2b).
 */
export function EntityTable<T extends { id: string }>({
  columns,
  rows,
  selectedIds,
  onToggleRow,
  onToggleAll,
}: EntityTableProps<T>) {
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const total = rows.length
  const selectedCount = rows.reduce((n, r) => (selectedIds.has(r.id) ? n + 1 : n), 0)
  const allChecked = total > 0 && selectedCount === total
  const indeterminate = selectedCount > 0 && selectedCount < total

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = indeterminate
  }, [indeterminate])

  if (total === 0) {
    return (
      <p className="py-3 text-center text-xs text-neutral-400 dark:text-neutral-500">No items</p>
    )
  }

  return (
    <table className="w-full table-auto text-xs tabular-nums">
      <thead>
        <tr className="text-left text-neutral-500 dark:text-neutral-400">
          <th className="w-6 px-1 py-1 font-medium">
            <input
              ref={headerCheckboxRef}
              type="checkbox"
              aria-label="Select all"
              checked={allChecked}
              onChange={onToggleAll}
              className="accent-violet-600"
            />
          </th>
          {columns.map((c) => (
            <th key={c.key} className={`px-1 py-1 font-medium ${c.className ?? ''}`}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          const selected = selectedIds.has(row.id)
          const onRowClick = (e: ReactMouseEvent<HTMLTableRowElement>) => {
            // Skip when the click landed in the checkbox cell — its onChange
            // already handles the toggle and we'd otherwise double-fire.
            const target = e.target as HTMLElement
            if (target.closest('input[type="checkbox"]')) return
            const additive = e.shiftKey || e.ctrlKey || e.metaKey
            onToggleRow(row.id, additive)
          }
          return (
            <tr
              key={row.id}
              onClick={onRowClick}
              className={`cursor-pointer transition-colors ${
                selected
                  ? 'bg-violet-50 dark:bg-violet-950/30'
                  : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
              }`}
            >
              <td className="w-6 px-1 py-1">
                <input
                  type="checkbox"
                  aria-label={`Select row ${idx}`}
                  checked={selected}
                  onChange={(e) => {
                    const ne = e.nativeEvent
                    const additive =
                      ne instanceof MouseEvent &&
                      (ne.shiftKey || ne.ctrlKey || ne.metaKey)
                    onToggleRow(row.id, additive)
                  }}
                  className="accent-violet-600"
                />
              </td>
              {columns.map((c) => (
                <td key={c.key} className={`px-1 py-1 ${c.className ?? ''}`}>
                  {c.render(row, idx)}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
