import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AddRow } from './AddRow'

afterEach(cleanup)

function parseFloatOrNull(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function parseIntOrNull(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isInteger(n) ? n : null
}

describe('AddRow', () => {
  test('blank id, two required floats submits successfully', () => {
    const onAdd = vi.fn().mockReturnValue({ ok: true })
    render(
      <AddRow
        fields={[
          { key: 'id', placeholder: 'ID', type: 'number', parse: parseIntOrNull },
          { key: 'x', placeholder: 'X', type: 'number', parse: parseFloatOrNull, required: true },
          { key: 'z', placeholder: 'Z', type: 'number', parse: parseFloatOrNull, required: true },
        ]}
        onAdd={onAdd}
      />,
    )
    fireEvent.change(screen.getByLabelText('X'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Z'), { target: { value: '-5' } })
    fireEvent.click(screen.getByLabelText('Add'))
    expect(onAdd).toHaveBeenCalledWith({ id: null, x: 10, z: -5 })
  })

  test('inputs clear after a successful add', () => {
    const onAdd = vi.fn().mockReturnValue({ ok: true })
    render(
      <AddRow
        fields={[
          { key: 'x', placeholder: 'X', type: 'number', parse: parseFloatOrNull, required: true },
        ]}
        onAdd={onAdd}
      />,
    )
    const input = screen.getByLabelText('X') as HTMLInputElement
    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.click(screen.getByLabelText('Add'))
    expect(input.value).toBe('')
  })

  test('failure response shows inline error and keeps values', () => {
    const onAdd = vi.fn().mockReturnValue({ ok: false, error: 'duplicate' })
    render(
      <AddRow
        fields={[
          { key: 'x', placeholder: 'X', type: 'number', parse: parseFloatOrNull, required: true },
        ]}
        onAdd={onAdd}
      />,
    )
    fireEvent.change(screen.getByLabelText('X'), { target: { value: '7' } })
    fireEvent.click(screen.getByLabelText('Add'))
    expect(screen.getByText('duplicate')).toBeTruthy()
    expect((screen.getByLabelText('X') as HTMLInputElement).value).toBe('7')
  })

  test('Enter inside an input submits the row', () => {
    const onAdd = vi.fn().mockReturnValue({ ok: true })
    render(
      <AddRow
        fields={[
          { key: 'x', placeholder: 'X', type: 'number', parse: parseFloatOrNull, required: true },
        ]}
        onAdd={onAdd}
      />,
    )
    const input = screen.getByLabelText('X')
    fireEvent.change(input, { target: { value: '4' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAdd).toHaveBeenCalled()
  })
})
