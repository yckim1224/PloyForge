import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LayerOverlay } from './LayerOverlay'
import { defaultLayerVisibility, useLayerStore } from '../store/layerStore'

afterEach(() => {
  cleanup()
  useLayerStore.setState(defaultLayerVisibility())
  localStorage.clear()
})

beforeEach(() => {
  localStorage.clear()
  useLayerStore.setState(defaultLayerVisibility())
})

describe('LayerOverlay', () => {
  test('renders an aria-pressed toggle for each of the four layers', () => {
    render(<LayerOverlay />)
    expect(screen.getByLabelText('Toggle Grid').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText('Toggle Points').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText('Toggle Lines').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText('Toggle Faces').getAttribute('aria-pressed')).toBe('true')
  })

  test('clicking the grid toggle cycles on -> labeled -> off and shows an A badge in labeled mode', () => {
    render(<LayerOverlay />)
    const grid = screen.getByLabelText('Toggle Grid')
    // on -> labeled
    fireEvent.click(grid)
    expect(useLayerStore.getState().grid).toBe('labeled')
    expect(grid.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('label-badge-grid')).toBeTruthy()
    // labeled -> off
    fireEvent.click(grid)
    expect(useLayerStore.getState().grid).toBe('off')
    expect(grid.getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByTestId('label-badge-grid')).toBeNull()
    // off -> on
    fireEvent.click(grid)
    expect(useLayerStore.getState().grid).toBe('on')
    expect(grid.getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByTestId('label-badge-grid')).toBeNull()
  })

  test('clicking a tri-state toggle cycles on -> labeled -> off and shows an A badge in labeled mode', () => {
    render(<LayerOverlay />)
    const pts = screen.getByLabelText('Toggle Points')
    // on -> labeled
    fireEvent.click(pts)
    expect(useLayerStore.getState().points).toBe('labeled')
    expect(pts.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('label-badge-points')).toBeTruthy()
    // labeled -> off
    fireEvent.click(pts)
    expect(useLayerStore.getState().points).toBe('off')
    expect(pts.getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByTestId('label-badge-points')).toBeNull()
    // off -> on
    fireEvent.click(pts)
    expect(useLayerStore.getState().points).toBe('on')
    expect(pts.getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByTestId('label-badge-points')).toBeNull()
  })

  test('Hide all hides everything and Show all restores it', () => {
    render(<LayerOverlay />)
    fireEvent.click(screen.getByLabelText('Hide all layers'))
    const s = useLayerStore.getState()
    expect(s.grid).toBe('off')
    expect(s.points).toBe('off')
    expect(s.lines).toBe('off')
    expect(s.faces).toBe('off')
    fireEvent.click(screen.getByLabelText('Show all layers'))
    const s2 = useLayerStore.getState()
    expect(s2.grid).toBe('on')
    expect(s2.points).toBe('on')
    expect(s2.lines).toBe('on')
    expect(s2.faces).toBe('on')
  })
})
