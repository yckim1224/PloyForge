import { beforeEach, describe, expect, test, vi } from 'vitest'
import { loadPersisted, savePersisted } from './persistence'
import { useSettingsStore, defaultGrid, defaultSettings } from '../store/settingsStore'

const KEY_V1 = 'poly-forge:doc:v1'
const KEY_V2 = 'poly-forge:doc:v2'
const KEY_V3 = 'poly-forge:doc:v3'
const KEY_V2_BACKUP = 'poly-forge:doc:v2.backup'
const KEY_V1_BACKUP = 'poly-forge:doc:v1.backup'
const KEY_V1_ORPHANS = 'poly-forge:doc:v1.orphans'

beforeEach(() => {
  localStorage.clear()
  // Reset settings between tests so material-merge / grid-spacing assertions start clean.
  useSettingsStore.getState().hydrate(defaultSettings())
})

describe('persistence', () => {
  test('round-trips a complete document', () => {
    const doc = {
      points: [{ id: 'p1', x: 0, z: 0 }],
      lines: [],
      faceTypes: {},
    }
    savePersisted(doc)
    expect(loadPersisted()).toEqual(doc)
  })

  test('rejects a partial document missing fields', () => {
    localStorage.setItem(KEY_V3, JSON.stringify({ points: [] }))
    expect(loadPersisted()).toBeNull()
  })

  test('rejects a non-object / malformed value', () => {
    localStorage.setItem(KEY_V3, 'not json{')
    expect(loadPersisted()).toBeNull()
    localStorage.setItem(KEY_V3, JSON.stringify(null))
    expect(loadPersisted()).toBeNull()
  })

  test('returns null when nothing is stored', () => {
    expect(loadPersisted()).toBeNull()
  })

  test('v2 -> v3 migration drops domain and lifts gridSpacing into settings.grid.spacing', () => {
    const v2 = {
      domain: {
        xmin: 0,
        xmax: 1000,
        zmin: -1000,
        zmax: 0,
        gridSpacing: 12345,
        meshingOption: 90,
        resolution: 500,
      },
      points: [{ id: 'p1', x: 0, z: 0 }],
      lines: [],
      faceTypes: {},
    }
    localStorage.setItem(KEY_V2, JSON.stringify(v2))
    const loaded = loadPersisted()
    expect(loaded).not.toBeNull()
    expect(loaded).toEqual({ points: v2.points, lines: [], faceTypes: {} })
    // No `domain` field on the loaded doc.
    expect((loaded as unknown as Record<string, unknown>).domain).toBeUndefined()
    // grid.spacing now carries the migrated v2 value.
    expect(useSettingsStore.getState().grid.spacing).toBe(12345)
    // The migrated document is persisted under the v3 key.
    expect(localStorage.getItem(KEY_V3)).not.toBeNull()
  })

  test('v2 -> v3 migration preserves grid.spacing when settings were already hydrated', () => {
    // Simulate the real-world flow: App.tsx restored persisted settings first
    // (whatever their value), so the loader is told `settingsHydrated: true`.
    useSettingsStore.getState().setGrid({ spacing: 999 })

    const v2 = {
      domain: { xmin: 0, xmax: 10, zmin: -10, zmax: 0, gridSpacing: 7777, meshingOption: 90, resolution: 1 },
      points: [],
      lines: [],
      faceTypes: {},
    }
    localStorage.setItem(KEY_V2, JSON.stringify(v2))
    loadPersisted({ settingsHydrated: true })
    // User customization wins; v2 gridSpacing is dropped.
    expect(useSettingsStore.getState().grid.spacing).toBe(999)
  })

  test('v2 -> v3 migration leaves untouched defaults alone when settings were hydrated', () => {
    // A returning user with persisted settings still at the default 25000 must
    // NOT be silently overwritten -- the previous heuristic conflated
    // "default" with "untouched" and would have clobbered.
    useSettingsStore.getState().setGrid({ spacing: 25_000 })

    const v2 = {
      domain: { xmin: 0, xmax: 1, zmin: -1, zmax: 0, gridSpacing: 12345 },
      points: [],
      lines: [],
      faceTypes: {},
    }
    localStorage.setItem(KEY_V2, JSON.stringify(v2))
    loadPersisted({ settingsHydrated: true })
    expect(useSettingsStore.getState().grid.spacing).toBe(25_000)
  })

  test('migrates v1 (segments + regions inside faces) into faceTypes, then v3', () => {
    // Closed unit-square -> one face containing seed (50, -50).
    const v1Doc = {
      domain: { xmin: 0, xmax: 100, zmin: -100, zmax: 0, gridSpacing: 50, meshingOption: 90, resolution: 25 },
      points: [
        { id: 'a', x: 0, z: 0 },
        { id: 'b', x: 100, z: 0 },
        { id: 'c', x: 100, z: -100 },
        { id: 'd', x: 0, z: -100 },
      ],
      segments: [
        { id: 's0', p0: 'a', p1: 'b', bdryFlag: 32 },
        { id: 's1', p0: 'b', p1: 'c', bdryFlag: 2 },
        { id: 's2', p0: 'c', p1: 'd', bdryFlag: 16 },
        { id: 's3', p0: 'd', p1: 'a', bdryFlag: 1 },
      ],
      regions: [{ id: 'r1', x: 50, z: -50, mattype: 4, size: -1 }],
      materials: [{ mattype: 4, color: '#abcdef', label: 'sediment' }],
    }
    localStorage.setItem(KEY_V1, JSON.stringify(v1Doc))
    const loaded = loadPersisted()
    expect(loaded).not.toBeNull()
    expect(loaded!.lines).toEqual(v1Doc.segments)
    expect(Object.keys(loaded!.faceTypes).length).toBe(1)
    const [spec] = Object.values(loaded!.faceTypes)
    expect(spec).toEqual({ mattype: 4, size: -1 })
    // The migrated document is persisted under the v3 key.
    expect(localStorage.getItem(KEY_V3)).not.toBeNull()
    // v1.domain.gridSpacing flowed through the v2 intermediate into settings.
    expect(useSettingsStore.getState().grid.spacing).toBe(50)
    // Materials moved into the settings store with their v1 color/label.
    const settings = useSettingsStore.getState()
    const m = settings.materials.find((x) => x.mattype === 4)
    expect(m).toBeTruthy()
    expect(m!.color).toBe('#abcdef')
    expect(m!.label).toBe('sediment')
  })

  test('v1 orphan region: stashed to localStorage v1.orphans + warning', () => {
    const v1Doc = {
      domain: { xmin: 0, xmax: 100, zmin: -100, zmax: 0, gridSpacing: 25, meshingOption: 90, resolution: 10 },
      points: [
        { id: 'a', x: 0, z: 0 },
        { id: 'b', x: 100, z: 0 },
        { id: 'c', x: 100, z: -100 },
        { id: 'd', x: 0, z: -100 },
      ],
      segments: [
        { id: 's0', p0: 'a', p1: 'b', bdryFlag: 32 },
        { id: 's1', p0: 'b', p1: 'c', bdryFlag: 2 },
        { id: 's2', p0: 'c', p1: 'd', bdryFlag: 16 },
        { id: 's3', p0: 'd', p1: 'a', bdryFlag: 1 },
      ],
      regions: [
        { id: 'r1', x: 50, z: -50, mattype: 0, size: -1 }, // inside the face
        { id: 'r2', x: 999, z: 999, mattype: 1, size: -1 }, // orphan
      ],
      materials: [],
    }
    localStorage.setItem(KEY_V1, JSON.stringify(v1Doc))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const loaded = loadPersisted()
      expect(loaded).not.toBeNull()
      expect(Object.keys(loaded!.faceTypes).length).toBe(1)
      const stash = localStorage.getItem(KEY_V1_ORPHANS)
      expect(stash).not.toBeNull()
      const parsed = JSON.parse(stash!)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(1)
      expect(parsed[0]).toMatchObject({ x: 999, z: 999, mattype: 1 })
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  test('v1 material entries seed settings only for new mattypes (no overwrite)', () => {
    // Pre-customize a settings color for mattype 1 before importing v1.
    const settings = useSettingsStore.getState()
    settings.ensureMaterial(1)
    settings.setMaterial(1, { color: '#00ffff', label: 'preexisting' })

    const v1Doc = {
      domain: { xmin: 0, xmax: 1, zmin: -1, zmax: 0, gridSpacing: defaultGrid().spacing, meshingOption: 90, resolution: 1 },
      points: [{ id: 'p', x: 0, z: 0 }],
      segments: [],
      regions: [],
      materials: [
        { mattype: 1, color: '#ff0000', label: 'v1-red' }, // should NOT overwrite cyan
        { mattype: 2, color: '#00ff00', label: 'v1-green' }, // new -> inherits v1 color
      ],
    }
    localStorage.setItem(KEY_V1, JSON.stringify(v1Doc))
    loadPersisted()
    const mats = useSettingsStore.getState().materials
    const m1 = mats.find((x) => x.mattype === 1)!
    const m2 = mats.find((x) => x.mattype === 2)!
    expect(m1.color).toBe('#00ffff') // preserved
    expect(m1.label).toBe('preexisting')
    expect(m2.color).toBe('#00ff00')
    expect(m2.label).toBe('v1-green')
  })

  test('on v1 corruption: backs up the raw v1 value and returns null', () => {
    const corrupt = JSON.stringify({ points: [], segments: [] }) // missing regions/materials/domain
    localStorage.setItem(KEY_V1, corrupt)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(loadPersisted()).toBeNull()
      expect(localStorage.getItem(KEY_V1_BACKUP)).toBe(corrupt)
    } finally {
      warn.mockRestore()
    }
  })

  test('on v2 corruption: backs up the raw v2 value and returns null', () => {
    const corrupt = JSON.stringify({ points: [], lines: [] }) // missing domain
    localStorage.setItem(KEY_V2, corrupt)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(loadPersisted()).toBeNull()
      expect(localStorage.getItem(KEY_V2_BACKUP)).toBe(corrupt)
    } finally {
      warn.mockRestore()
    }
  })
})
