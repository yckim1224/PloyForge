import { beforeEach, describe, expect, test } from 'vitest'
import {
  defaultGrid,
  defaultLine,
  defaultPoint,
  defaultSettings,
  loadSettings,
  saveSettings,
  useSettingsStore,
} from './settingsStore'

beforeEach(() => {
  localStorage.clear()
  useSettingsStore.getState().hydrate(defaultSettings())
})

describe('settingsStore', () => {
  test('ensureMaterial(1) then customize then ensureMaterial(1) keeps customization (A-21)', () => {
    useSettingsStore.getState().ensureMaterial(1)
    const before = useSettingsStore.getState().materials.find((m) => m.mattype === 1)
    expect(before).toBeTruthy()
    // Customize: change color, add label.
    useSettingsStore.getState().setMaterial(1, { color: '#00ffff', label: 'cyan-custom' })
    expect(useSettingsStore.getState().materials.find((m) => m.mattype === 1)).toEqual({
      mattype: 1,
      color: '#00ffff',
      label: 'cyan-custom',
    })
    // Calling ensureMaterial again must NOT overwrite color/label.
    useSettingsStore.getState().ensureMaterial(1)
    expect(useSettingsStore.getState().materials.find((m) => m.mattype === 1)).toEqual({
      mattype: 1,
      color: '#00ffff',
      label: 'cyan-custom',
    })
  })

  test('ensureMaterial sorts new entries by mattype', () => {
    useSettingsStore.getState().ensureMaterial(3)
    useSettingsStore.getState().ensureMaterial(1)
    useSettingsStore.getState().ensureMaterial(2)
    const ms = useSettingsStore.getState().materials.map((m) => m.mattype)
    expect(ms).toEqual([1, 2, 3])
  })

  test('resetDisplaySettings restores grid/point/line defaults and leaves materials alone', () => {
    useSettingsStore.getState().ensureMaterial(0)
    useSettingsStore.getState().setMaterial(0, { color: '#ff00ff', label: 'magenta' })
    useSettingsStore.getState().setGrid({ show: false, spacing: 9999 })
    useSettingsStore.getState().setPoint({ radius: 42 })
    useSettingsStore.getState().setLine({ width: 99 })

    useSettingsStore.getState().resetDisplaySettings()

    const next = useSettingsStore.getState()
    expect(next.grid).toEqual(defaultGrid())
    expect(next.point).toEqual(defaultPoint())
    expect(next.line).toEqual(defaultLine())
    // Materials are untouched.
    expect(next.materials.find((m) => m.mattype === 0)).toEqual({
      mattype: 0,
      color: '#ff00ff',
      label: 'magenta',
    })
  })

  test('round-trip via localStorage produces identical settings', () => {
    useSettingsStore.getState().ensureMaterial(0)
    useSettingsStore.getState().setMaterial(0, { color: '#123456', label: 'first' })
    useSettingsStore.getState().ensureMaterial(2)
    useSettingsStore.getState().setGrid({ lineColor: '#deadbe', show: false })
    useSettingsStore.getState().setPoint({ radius: 7 })
    useSettingsStore.getState().setLine({ width: 4 })

    const snapshot = {
      grid: useSettingsStore.getState().grid,
      point: useSettingsStore.getState().point,
      line: useSettingsStore.getState().line,
      materials: useSettingsStore.getState().materials,
    }
    saveSettings(snapshot)

    // Reset the in-memory store, then load from localStorage.
    useSettingsStore.getState().hydrate(defaultSettings())
    const loaded = loadSettings()
    expect(loaded).not.toBeNull()
    expect(loaded).toEqual(snapshot)
  })

  test('loadSettings returns null when nothing is stored', () => {
    expect(loadSettings()).toBeNull()
  })

  test('loadSettings returns null on malformed JSON', () => {
    localStorage.setItem('poly-forge:settings:v1', 'not json{')
    expect(loadSettings()).toBeNull()
  })

  test('loadSettings returns null when shape is invalid', () => {
    localStorage.setItem('poly-forge:settings:v1', JSON.stringify({ grid: {} }))
    expect(loadSettings()).toBeNull()
  })
})
