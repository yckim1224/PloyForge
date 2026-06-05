import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Menu } from './Menu'

afterEach(cleanup)

describe('Menu', () => {
  test('opens on trigger click and shows items', () => {
    render(
      <Menu
        trigger={<span>Open</span>}
        items={[{ key: 'a', label: 'First', onSelect: () => {} }]}
      />,
    )
    expect(screen.queryByRole('menuitem')).toBeNull()
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByRole('menuitem', { name: 'First' })).toBeTruthy()
  })

  test('selecting an item closes the menu and calls onSelect', () => {
    const onSelect = vi.fn()
    render(
      <Menu
        trigger={<span>Open</span>}
        items={[{ key: 'a', label: 'Pick', onSelect }]}
      />,
    )
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pick' }))
    expect(onSelect).toHaveBeenCalled()
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  test('outside click closes the menu', () => {
    render(
      <div>
        <button>Outside</button>
        <Menu
          trigger={<span>Open</span>}
          items={[{ key: 'a', label: 'Item', onSelect: () => {} }]}
        />
      </div>,
    )
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByRole('menuitem')).toBeTruthy()
    fireEvent.mouseDown(screen.getByText('Outside'))
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  test('Esc key closes the menu', () => {
    render(
      <Menu
        trigger={<span>Open</span>}
        items={[{ key: 'a', label: 'Item', onSelect: () => {} }]}
      />,
    )
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByRole('menuitem')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  test('disabled items do not trigger onSelect', () => {
    const onSelect = vi.fn()
    render(
      <Menu
        trigger={<span>Open</span>}
        items={[{ key: 'a', label: 'Nope', onSelect, disabled: true }]}
      />,
    )
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Nope' }))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
