import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  defaultLayerVisibility,
  loadLayerVisibility,
  saveLayerVisibility,
  useLayerStore,
} from './layerStore'

afterEach(() => {
  localStorage.clear()
  useLayerStore.setState(defaultLayerVisibility())
})

beforeEach(() => {
  localStorage.clear()
  useLayerStore.setState(defaultLayerVisibility())
})

describe('layerStore', () => {
  test("default visibility is grid on and points/lines/faces 'on'", () => {
    const s = useLayerStore.getState()
    expect(s.grid).toBe(true)
    expect(s.points).toBe('on')
    expect(s.lines).toBe('on')
    expect(s.faces).toBe('on')
  })

  test('toggle on grid flips the boolean', () => {
    useLayerStore.getState().toggle('grid')
    expect(useLayerStore.getState().grid).toBe(false)
    useLayerStore.getState().toggle('grid')
    expect(useLayerStore.getState().grid).toBe(true)
  })

  test('toggle on a tri-state layer cycles on -> labeled -> off -> on', () => {
    expect(useLayerStore.getState().points).toBe('on')
    useLayerStore.getState().toggle('points')
    expect(useLayerStore.getState().points).toBe('labeled')
    useLayerStore.getState().toggle('points')
    expect(useLayerStore.getState().points).toBe('off')
    useLayerStore.getState().toggle('points')
    expect(useLayerStore.getState().points).toBe('on')
  })

  test('setAll(false) hides everything; setAll(true) restores to on', () => {
    useLayerStore.getState().setAll(false)
    const s = useLayerStore.getState()
    expect(s.grid).toBe(false)
    expect(s.points).toBe('off')
    expect(s.lines).toBe('off')
    expect(s.faces).toBe('off')
    useLayerStore.getState().setAll(true)
    const t = useLayerStore.getState()
    expect(t.grid).toBe(true)
    expect(t.points).toBe('on')
    expect(t.lines).toBe('on')
    expect(t.faces).toBe('on')
  })

  test('setLayer accepts boolean for grid and LayerMode for the rest', () => {
    useLayerStore.getState().setLayer('grid', false)
    expect(useLayerStore.getState().grid).toBe(false)
    useLayerStore.getState().setLayer('points', 'labeled')
    expect(useLayerStore.getState().points).toBe('labeled')
  })

  test('round-trips a tri-state shape through localStorage', () => {
    saveLayerVisibility({ grid: false, points: 'labeled', lines: 'off', faces: 'on' })
    const v = loadLayerVisibility()
    expect(v).toEqual({ grid: false, points: 'labeled', lines: 'off', faces: 'on' })
  })

  test('migrates the pre-tri-state all-boolean shape on load', () => {
    localStorage.setItem(
      'poly-forge:layers:v1',
      JSON.stringify({ grid: false, points: true, lines: false, faces: true }),
    )
    expect(loadLayerVisibility()).toEqual({
      grid: false,
      points: 'on',
      lines: 'off',
      faces: 'on',
    })
  })

  test('rejects malformed persisted values', () => {
    localStorage.setItem('poly-forge:layers:v1', '"not an object"')
    expect(loadLayerVisibility()).toBeNull()
    localStorage.setItem('poly-forge:layers:v1', '{"grid":true}')
    expect(loadLayerVisibility()).toBeNull()
    localStorage.setItem(
      'poly-forge:layers:v1',
      JSON.stringify({ grid: true, points: 'sometimes', lines: 'on', faces: 'on' }),
    )
    expect(loadLayerVisibility()).toBeNull()
  })
})
