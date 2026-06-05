import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SettingsModal } from './SettingsModal'
import { useSettingsStore, defaultSettings } from '../store/settingsStore'

afterEach(() => {
  cleanup()
  useSettingsStore.setState({ ...defaultSettings() })
})

beforeEach(() => {
  useSettingsStore.setState({ ...defaultSettings() })
})

describe('SettingsModal', () => {
  test('does not render body when closed', () => {
    render(<SettingsModal open={false} onClose={() => {}} />)
    expect(screen.queryByText('Grid')).toBeNull()
  })

  test('renders the four display-only groups when open', () => {
    render(<SettingsModal open onClose={() => {}} />)
    expect(screen.getByText('Grid')).toBeTruthy()
    expect(screen.getByText('Point')).toBeTruthy()
    expect(screen.getByText('Line')).toBeTruthy()
    expect(screen.getByText('Materials')).toBeTruthy()
    // The Domain section was removed entirely; no Domain controls anywhere.
    expect(screen.queryByText(/Domain/)).toBeNull()
  })

  test('Done button invokes onClose', () => {
    const onClose = vi.fn()
    render(<SettingsModal open onClose={onClose} />)
    fireEvent.click(screen.getByText('Done'))
    expect(onClose).toHaveBeenCalled()
  })

  test('Add material appends to settingsStore.materials', () => {
    render(<SettingsModal open onClose={() => {}} />)
    expect(useSettingsStore.getState().materials.length).toBe(0)
    fireEvent.click(screen.getByText('Add material'))
    expect(useSettingsStore.getState().materials.length).toBe(1)
    expect(useSettingsStore.getState().materials[0].mattype).toBe(0)
  })

  test('Restore display settings resets grid/point/line but not materials', () => {
    useSettingsStore.getState().setGrid({ lineWidth: 9 })
    useSettingsStore.getState().ensureMaterial(7)
    render(<SettingsModal open onClose={() => {}} />)
    fireEvent.click(screen.getByText('Restore display settings'))
    expect(useSettingsStore.getState().grid.lineWidth).toBe(defaultSettings().grid.lineWidth)
    // Materials are preserved.
    expect(useSettingsStore.getState().materials.some((m) => m.mattype === 7)).toBe(true)
  })

  test('Grid spacing field commits a positive value to settingsStore.grid.spacing', () => {
    render(<SettingsModal open onClose={() => {}} />)
    const label = screen.getByText('Grid spacing (m)')
    const input = label.parentElement?.querySelector('input') as HTMLInputElement
    expect(input).toBeTruthy()
    fireEvent.change(input, { target: { value: '4321' } })
    fireEvent.blur(input)
    expect(useSettingsStore.getState().grid.spacing).toBe(4321)
  })

  test('Grid spacing field rejects non-positive values', () => {
    useSettingsStore.getState().setGrid({ spacing: 100 })
    render(<SettingsModal open onClose={() => {}} />)
    const label = screen.getByText('Grid spacing (m)')
    const input = label.parentElement?.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.blur(input)
    expect(useSettingsStore.getState().grid.spacing).toBe(100)
  })
})
