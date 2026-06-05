import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EntityTable, type Column } from './EntityTable'

interface Row {
  id: string
  label: string
}

const COLUMNS: Column<Row>[] = [
  { key: 'label', header: 'Label', render: (r) => r.label },
]

const ROWS: Row[] = [
  { id: 'a', label: 'alpha' },
  { id: 'b', label: 'beta' },
  { id: 'c', label: 'gamma' },
]

afterEach(cleanup)

describe('EntityTable', () => {
  test('renders rows', () => {
    render(
      <EntityTable
        columns={COLUMNS}
        rows={ROWS}
        selectedIds={new Set()}
        onToggleRow={() => {}}
        onToggleAll={() => {}}
      />,
    )
    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.getByText('beta')).toBeTruthy()
    expect(screen.getByText('gamma')).toBeTruthy()
  })

  test('empty rows render "No items"', () => {
    render(
      <EntityTable
        columns={COLUMNS}
        rows={[]}
        selectedIds={new Set()}
        onToggleRow={() => {}}
        onToggleAll={() => {}}
      />,
    )
    expect(screen.getByText('No items')).toBeTruthy()
  })

  test('row checkbox toggle is always additive (standard multi-select)', () => {
    const onToggleRow = vi.fn()
    render(
      <EntityTable
        columns={COLUMNS}
        rows={ROWS}
        selectedIds={new Set(['a'])}
        onToggleRow={onToggleRow}
        onToggleAll={() => {}}
      />,
    )
    // Plain click on an unchecked checkbox should add the row without
    // dropping the row already in the selection ('a').
    fireEvent.click(screen.getByLabelText('Select row 1'))
    expect(onToggleRow).toHaveBeenLastCalledWith('b', true)
    // Plain click on a checked checkbox should remove the row (same path,
    // since toggleSelect handles add-or-remove for the same id).
    fireEvent.click(screen.getByLabelText('Select row 0'))
    expect(onToggleRow).toHaveBeenLastCalledWith('a', true)
  })

  test('row body click calls onToggleRow with additive=true when shift held', () => {
    const onToggleRow = vi.fn()
    render(
      <EntityTable
        columns={COLUMNS}
        rows={ROWS}
        selectedIds={new Set()}
        onToggleRow={onToggleRow}
        onToggleAll={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('gamma'), { shiftKey: true })
    expect(onToggleRow).toHaveBeenCalledWith('c', true)
  })

  test('select-all header checkbox calls onToggleAll', () => {
    const onToggleAll = vi.fn()
    render(
      <EntityTable
        columns={COLUMNS}
        rows={ROWS}
        selectedIds={new Set()}
        onToggleRow={() => {}}
        onToggleAll={onToggleAll}
      />,
    )
    fireEvent.click(screen.getByLabelText('Select all'))
    expect(onToggleAll).toHaveBeenCalledTimes(1)
  })

  test('header checkbox is indeterminate when only some rows selected', () => {
    render(
      <EntityTable
        columns={COLUMNS}
        rows={ROWS}
        selectedIds={new Set(['a'])}
        onToggleRow={() => {}}
        onToggleAll={() => {}}
      />,
    )
    const header = screen.getByLabelText('Select all') as HTMLInputElement
    expect(header.indeterminate).toBe(true)
    expect(header.checked).toBe(false)
  })

  test('header checkbox is checked when all rows selected', () => {
    render(
      <EntityTable
        columns={COLUMNS}
        rows={ROWS}
        selectedIds={new Set(['a', 'b', 'c'])}
        onToggleRow={() => {}}
        onToggleAll={() => {}}
      />,
    )
    const header = screen.getByLabelText('Select all') as HTMLInputElement
    expect(header.checked).toBe(true)
    expect(header.indeterminate).toBe(false)
  })

  test('row toggle is suppressed on the click that initiates a dblclick on an editable cell', () => {
    const onToggleRow = vi.fn()
    const EDITABLE: Column<Row>[] = [
      {
        key: 'label',
        header: 'Label',
        render: (r) => r.label,
        edit: {
          type: 'number',
          parse: (raw) => {
            const n = Number(raw)
            return Number.isFinite(n) ? n : null
          },
          onCommit: () => {},
        },
      },
    ]
    render(
      <EntityTable
        columns={EDITABLE}
        rows={ROWS}
        selectedIds={new Set()}
        onToggleRow={onToggleRow}
        onToggleAll={() => {}}
      />,
    )
    // detail >= 2 marks the click as part of a double-click; an editable cell
    // entering edit mode must not also toggle the row selection.
    fireEvent.click(screen.getByText('alpha'), { detail: 2 })
    expect(onToggleRow).not.toHaveBeenCalled()
  })
})
