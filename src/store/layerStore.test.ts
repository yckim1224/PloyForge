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
  test("default visibility is all 'on'", () => {
    const s = useLayerStore.getState()
    expect(s.grid).toBe('on')
    expect(s.points).toBe('on')
    expect(s.lines).toBe('on')
    expect(s.faces).toBe('on')
  })

  test('toggle cycles every layer through on -> labeled -> off -> on, including grid', () => {
    expect(useLayerStore.getState().grid).toBe('on')
    useLayerStore.getState().toggle('grid')
    expect(useLayerStore.getState().grid).toBe('labeled')
    useLayerStore.getState().toggle('grid')
    expect(useLayerStore.getState().grid).toBe('off')
    useLayerStore.getState().toggle('grid')
    expect(useLayerStore.getState().grid).toBe('on')

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
    expect(s.grid).toBe('off')
    expect(s.points).toBe('off')
    expect(s.lines).toBe('off')
    expect(s.faces).toBe('off')
    useLayerStore.getState().setAll(true)
    const t = useLayerStore.getState()
    expect(t.grid).toBe('on')
    expect(t.points).toBe('on')
    expect(t.lines).toBe('on')
    expect(t.faces).toBe('on')
  })

  test('setLayer accepts a LayerMode for every layer including grid', () => {
    useLayerStore.getState().setLayer('grid', 'labeled')
    expect(useLayerStore.getState().grid).toBe('labeled')
    useLayerStore.getState().setLayer('grid', 'off')
    expect(useLayerStore.getState().grid).toBe('off')
    useLayerStore.getState().setLayer('points', 'labeled')
    expect(useLayerStore.getState().points).toBe('labeled')
  })

  test('round-trips a tri-state shape through localStorage', () => {
    saveLayerVisibility({ grid: 'labeled', points: 'labeled', lines: 'off', faces: 'on' })
    const v = loadLayerVisibility()
    expect(v).toEqual({ grid: 'labeled', points: 'labeled', lines: 'off', faces: 'on' })
  })

  test('migrates the pre-tri-state all-boolean shape on load, including grid', () => {
    localStorage.setItem(
      'poly-forge:layers:v1',
      JSON.stringify({ grid: false, points: true, lines: false, faces: true }),
    )
    expect(loadLayerVisibility()).toEqual({
      grid: 'off',
      points: 'on',
      lines: 'off',
      faces: 'on',
    })
  })

  test('rejects malformed persisted values', () => {
    localStorage.setItem('poly-forge:layers:v1', '"not an object"')
    expect(loadLayerVisibility()).toBeNull()
    localStorage.setItem('poly-forge:layers:v1', '{"grid":"on"}')
    expect(loadLayerVisibility()).toBeNull()
    localStorage.setItem(
      'poly-forge:layers:v1',
      JSON.stringify({ grid: 'on', points: 'sometimes', lines: 'on', faces: 'on' }),
    )
    expect(loadLayerVisibility()).toBeNull()
  })
})
