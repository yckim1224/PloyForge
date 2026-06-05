import { beforeEach, describe, expect, test } from 'vitest'
import { loadPersisted, savePersisted } from './persistence'
import { defaultDomain } from './defaults'

const KEY = 'poly-forge:doc:v1'

describe('persistence', () => {
  beforeEach(() => localStorage.clear())

  test('round-trips a complete document', () => {
    const doc = {
      domain: defaultDomain(),
      points: [{ id: 'p1', x: 0, z: 0 }],
      segments: [],
      regions: [],
      materials: [],
    }
    savePersisted(doc)
    expect(loadPersisted()).toEqual(doc)
  })

  test('rejects a partial document missing regions/materials/domain', () => {
    // Old-schema or hand-edited value that would assign undefined into store fields.
    localStorage.setItem(KEY, JSON.stringify({ points: [], segments: [] }))
    expect(loadPersisted()).toBeNull()
  })

  test('rejects a non-object / malformed value', () => {
    localStorage.setItem(KEY, 'not json{')
    expect(loadPersisted()).toBeNull()
    localStorage.setItem(KEY, JSON.stringify(null))
    expect(loadPersisted()).toBeNull()
  })

  test('returns null when nothing is stored', () => {
    expect(loadPersisted()).toBeNull()
  })
})
