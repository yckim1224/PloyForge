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
  test('default visibility has all layers on', () => {
    const s = useLayerStore.getState()
    expect(s.grid && s.points && s.lines && s.faces).toBe(true)
  })

  test('toggle flips a single layer', () => {
    useLayerStore.getState().toggle('points')
    expect(useLayerStore.getState().points).toBe(false)
    useLayerStore.getState().toggle('points')
    expect(useLayerStore.getState().points).toBe(true)
  })

  test('setAll sets every layer', () => {
    useLayerStore.getState().setAll(false)
    const s = useLayerStore.getState()
    expect(s.grid).toBe(false)
    expect(s.points).toBe(false)
    expect(s.lines).toBe(false)
    expect(s.faces).toBe(false)
  })

  test('round-trips through localStorage', () => {
    saveLayerVisibility({ grid: false, points: true, lines: false, faces: true })
    const v = loadLayerVisibility()
    expect(v).toEqual({ grid: false, points: true, lines: false, faces: true })
  })

  test('rejects malformed persisted values', () => {
    localStorage.setItem('poly-forge:layers:v1', '"not an object"')
    expect(loadLayerVisibility()).toBeNull()
    localStorage.setItem('poly-forge:layers:v1', '{"grid":true}')
    expect(loadLayerVisibility()).toBeNull()
  })
})
