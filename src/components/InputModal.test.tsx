import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InputModal } from './InputModal'

afterEach(cleanup)

describe('InputModal', () => {
  test('confirms with parsed number values', () => {
    const onConfirm = vi.fn()
    render(
      <InputModal
        open
        title="Set value"
        fields={[
          { key: 'n', label: 'Number', type: 'number', initialValue: 5 },
        ]}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onConfirm).toHaveBeenCalledWith({ n: 5 })
  })

  test('select field passes the chosen numeric value', () => {
    const onConfirm = vi.fn()
    render(
      <InputModal
        open
        title="Pick"
        fields={[
          {
            key: 'flag',
            label: 'Flag',
            type: 'select',
            options: [
              { label: 'A', value: 0 },
              { label: 'B', value: 16 },
            ],
            initialValue: 0,
          },
        ]}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    )
    fireEvent.change(screen.getByLabelText('Flag'), { target: { value: '16' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onConfirm).toHaveBeenCalledWith({ flag: 16 })
  })

  test('cancel button calls onCancel', () => {
    const onCancel = vi.fn()
    render(
      <InputModal
        open
        title="Cancel test"
        fields={[{ key: 'n', label: 'n', type: 'number', initialValue: 0 }]}
        onCancel={onCancel}
        onConfirm={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
