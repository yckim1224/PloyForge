import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SettingsModal } from './SettingsModal'
import { useSettingsStore, defaultSettings } from '../store/settingsStore'
import { useEditorStore } from '../store/editorStore'
import { defaultDomain } from '../lib/defaults'
// `defaultDomain` is used in setup to restore baseline state between tests.

afterEach(() => {
  cleanup()
  useSettingsStore.setState({ ...defaultSettings() })
  useEditorStore.setState({ domain: defaultDomain() })
})

beforeEach(() => {
  useSettingsStore.setState({ ...defaultSettings() })
  useEditorStore.setState({ domain: defaultDomain() })
})

describe('SettingsModal', () => {
  test('does not render body when closed', () => {
    render(<SettingsModal open={false} onClose={() => {}} />)
    expect(screen.queryByText('Grid')).toBeNull()
  })

  test('renders all five groups when open', () => {
    render(<SettingsModal open onClose={() => {}} />)
    expect(screen.getByText('Grid')).toBeTruthy()
    expect(screen.getByText('Domain & Meshing')).toBeTruthy()
    expect(screen.getByText('Point')).toBeTruthy()
    expect(screen.getByText('Line')).toBeTruthy()
    expect(screen.getByText('Materials')).toBeTruthy()
  })

  test('Done button invokes onClose', () => {
    const onClose = vi.fn()
    render(<SettingsModal open onClose={onClose} />)
    fireEvent.click(screen.getByText('Done'))
    expect(onClose).toHaveBeenCalled()
  })

  test('Grid spacing edits the document (not settings)', () => {
    render(<SettingsModal open onClose={() => {}} />)
    // Grid spacing lives on editorStore.domain so it round-trips through the
    // .poly file; settingsStore is reserved for purely cosmetic display state.
    const label = screen.getByText('Grid spacing (m)')
    const input = label.parentElement?.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '999' } })
    fireEvent.blur(input)
    expect(useEditorStore.getState().domain.gridSpacing).toBe(999)
  })

  test('rejects inverted Domain bounds (xmin >= xmax)', () => {
    useEditorStore.getState().setDomain({ xmin: 0, xmax: 100, zmin: -100, zmax: 0 })
    render(<SettingsModal open onClose={() => {}} />)
    const label = screen.getByText('xmin')
    const input = label.parentElement?.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '500' } })
    fireEvent.blur(input)
    // Bounds remain valid; the invalid edit was silently dropped.
    expect(useEditorStore.getState().domain.xmin).toBe(0)
  })

  test('Domain & Meshing edits go to editorStore.domain, not settings', () => {
    render(<SettingsModal open onClose={() => {}} />)
    // Locate the xmin field by its label, which is unique within the modal.
    const xmaxLabel = screen.getByText('xmax')
    const xmaxInput = xmaxLabel.parentElement?.querySelector('input') as HTMLInputElement
    fireEvent.change(xmaxInput, { target: { value: '777777' } })
    fireEvent.blur(xmaxInput)
    expect(useEditorStore.getState().domain.xmax).toBe(777777)
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
})
