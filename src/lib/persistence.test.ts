import { beforeEach, describe, expect, test, vi } from 'vitest'
import { loadPersisted, savePersisted } from './persistence'
import { defaultDomain } from './defaults'

const KEY_V1 = 'poly-forge:doc:v1'
const KEY_V2 = 'poly-forge:doc:v2'
const KEY_V1_BACKUP = 'poly-forge:doc:v1.backup'

describe('persistence', () => {
  beforeEach(() => localStorage.clear())

  test('round-trips a complete document', () => {
    const doc = {
      domain: defaultDomain(),
      points: [{ id: 'p1', x: 0, z: 0 }],
      lines: [],
      regions: [],
      materials: [],
      faceTypes: {},
    }
    savePersisted(doc)
    expect(loadPersisted()).toEqual(doc)
  })

  test('rejects a partial document missing regions/materials/domain', () => {
    // Old-schema or hand-edited value that would assign undefined into store fields.
    localStorage.setItem(KEY_V2, JSON.stringify({ points: [], lines: [] }))
    expect(loadPersisted()).toBeNull()
  })

  test('rejects a non-object / malformed value', () => {
    localStorage.setItem(KEY_V2, 'not json{')
    expect(loadPersisted()).toBeNull()
    localStorage.setItem(KEY_V2, JSON.stringify(null))
    expect(loadPersisted()).toBeNull()
  })

  test('returns null when nothing is stored', () => {
    expect(loadPersisted()).toBeNull()
  })

  test('migrates v1 (segments) to v2 (lines + empty faceTypes)', () => {
    const v1Doc = {
      domain: defaultDomain(),
      points: [{ id: 'p1', x: 10, z: -5 }],
      segments: [{ id: 's1', p0: 'p1', p1: 'p1', bdryFlag: 0 }],
      regions: [{ id: 'r1', x: 5, z: -2, mattype: 0, size: -1 }],
      materials: [{ mattype: 0, color: '#60a5fa' }],
    }
    localStorage.setItem(KEY_V1, JSON.stringify(v1Doc))
    const loaded = loadPersisted()
    expect(loaded).not.toBeNull()
    expect(loaded!.lines).toEqual(v1Doc.segments)
    expect(loaded!.regions).toEqual(v1Doc.regions)
    expect(loaded!.materials).toEqual(v1Doc.materials)
    expect(loaded!.faceTypes).toEqual({})
    // Migrated document is persisted under the v2 key.
    expect(localStorage.getItem(KEY_V2)).not.toBeNull()
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

})
