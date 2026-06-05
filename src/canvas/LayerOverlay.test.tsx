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

  test('clicking a toggle flips its visibility', () => {
    render(<LayerOverlay />)
    const grid = screen.getByLabelText('Toggle Grid')
    fireEvent.click(grid)
    expect(grid.getAttribute('aria-pressed')).toBe('false')
    expect(useLayerStore.getState().grid).toBe(false)
    fireEvent.click(grid)
    expect(grid.getAttribute('aria-pressed')).toBe('true')
  })

  test('None hides everything and All restores it', () => {
    render(<LayerOverlay />)
    fireEvent.click(screen.getByText('None'))
    const s = useLayerStore.getState()
    expect(s.grid && s.points && s.lines && s.faces).toBe(false)
    fireEvent.click(screen.getByText('All'))
    const s2 = useLayerStore.getState()
    expect(s2.grid && s2.points && s2.lines && s2.faces).toBe(true)
  })
})
