import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'

export interface ColumnEditOption {
  label: string
  value: number
}

export interface ColumnEdit<T> {
  type: 'number' | 'select'
  options?: ColumnEditOption[]
  min?: number
  /** Parse the raw input string. Return null when invalid (cell goes red). */
  parse: (raw: string) => number | null
  /** Commit a valid number for this row. */
  onCommit: (row: T, idx: number, value: number) => void
  /** When true, an empty value commits via onClear instead of being rejected. */
  allowEmpty?: boolean
  /** Called when an empty value commits and allowEmpty is true. */
  onClear?: (row: T, idx: number) => void
  /**
   * Initial draft string when entering edit mode. Defaults to the column's
   * rendered output (when it is a string or number). Provide this when the
   * cell renders complex JSX so the editor still starts from the raw value.
   */
  seed?: (row: T, idx: number) => string
}

export interface Column<T> {
  /** Stable column key (used for React keys). */
  key: string
  /** Header cell text. */
  header: string
  /** Renders the cell body for a given row. */
  render: (row: T, idx: number) => ReactNode
  /** When set, double-clicking the cell starts an inline edit. */
  edit?: ColumnEdit<T>
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

interface EditState {
  rowId: string
  colKey: string
  draft: string
  invalid: boolean
}

const editInputClass =
  'w-full rounded-sm border bg-white px-1 py-0.5 text-xs tabular-nums focus:outline-none dark:bg-neutral-800 dark:text-neutral-100'

/**
 * Entity table with optional per-column inline editing. Double-click an
 * editable cell to start editing; Enter or blur-with-valid commits; Esc or
 * blur-with-invalid reverts. Single click still selects the row, so users
 * don't fight the selection model.
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

  const [edit, setEdit] = useState<EditState | null>(null)

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = indeterminate
  }, [indeterminate])

  const startEdit = (row: T, col: Column<T>, idx: number) => {
    if (!col.edit) return
    let seed = ''
    if (col.edit.seed) {
      seed = col.edit.seed(row, idx)
    } else {
      const current = col.render(row, idx)
      if (typeof current === 'string' || typeof current === 'number') seed = String(current)
    }
    setEdit({ rowId: row.id, colKey: col.key, draft: seed, invalid: false })
  }

  const cancelEdit = () => setEdit(null)

  const commitEdit = (row: T, col: Column<T>, idx: number) => {
    if (!col.edit) {
      cancelEdit()
      return
    }
    const raw = (edit?.draft ?? '').trim()
    if (raw === '' && col.edit.allowEmpty) {
      col.edit.onClear?.(row, idx)
      cancelEdit()
      return
    }
    const parsed = col.edit.parse(raw)
    if (parsed === null) {
      // Treat blur-with-invalid as revert (the user backed out by clicking away).
      cancelEdit()
      return
    }
    col.edit.onCommit(row, idx, parsed)
    cancelEdit()
  }

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
            if (target.closest('input,select,button')) return
            // Skip the first/second click of a dblclick on an editable cell —
            // otherwise entering edit mode toggles the row selection mid-gesture.
            const targetCell = target.closest('td')
            const colIdx = targetCell?.cellIndex
            const onEditable =
              typeof colIdx === 'number' && colIdx > 0 && !!columns[colIdx - 1]?.edit
            if (e.detail >= 2 && onEditable) return
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
              {columns.map((c) => {
                const editing =
                  edit && edit.rowId === row.id && edit.colKey === c.key && c.edit
                if (editing) {
                  const draft = edit?.draft ?? ''
                  const trimmed = draft.trim()
                  const invalid =
                    trimmed !== ''
                      ? c.edit!.parse(trimmed) === null
                      : !c.edit!.allowEmpty
                  const borderClass = invalid
                    ? 'border-red-500'
                    : 'border-neutral-300 focus:border-violet-500 dark:border-neutral-600'
                  if (c.edit!.type === 'select') {
                    return (
                      <td key={c.key} className={`px-1 py-1 ${c.className ?? ''}`}>
                        <select
                          autoFocus
                          value={draft}
                          onChange={(e) =>
                            setEdit((prev) =>
                              prev ? { ...prev, draft: e.target.value, invalid: false } : prev,
                            )
                          }
                          onBlur={() => commitEdit(row, c, idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') cancelEdit()
                            else if (e.key === 'Enter') commitEdit(row, c, idx)
                          }}
                          className={`${editInputClass} ${borderClass}`}
                        >
                          {c.edit!.options?.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    )
                  }
                  return (
                    <td key={c.key} className={`px-1 py-1 ${c.className ?? ''}`}>
                      <input
                        autoFocus
                        type="text"
                        inputMode="decimal"
                        value={draft}
                        onChange={(e) =>
                          setEdit((prev) =>
                            prev ? { ...prev, draft: e.target.value, invalid: false } : prev,
                          )
                        }
                        onBlur={() => commitEdit(row, c, idx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') cancelEdit()
                          else if (e.key === 'Enter') commitEdit(row, c, idx)
                        }}
                        className={`${editInputClass} ${borderClass}`}
                      />
                    </td>
                  )
                }
                return (
                  <td
                    key={c.key}
                    onDoubleClick={c.edit ? () => startEdit(row, c, idx) : undefined}
                    className={`px-1 py-1 ${c.className ?? ''}`}
                  >
                    {c.render(row, idx)}
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
