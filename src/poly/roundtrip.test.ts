import { beforeEach, describe, expect, test } from 'vitest'
import { parsePoly } from './parse'
import { serializePoly } from './serialize'
import type { PolyDocument } from '../types'
import { SAMPLES } from '../samples'
import { useEditorStore } from '../store/editorStore'

/** A structural fingerprint that is independent of internal ids and point ordering. */
function signature(doc: PolyDocument) {
  return {
    nPoints: doc.points.length,
    nLines: doc.lines.length,
    nRegions: doc.regions.length,
    flags: doc.lines.map((s) => s.bdryFlag).sort((a, b) => a - b),
    coords: doc.points.map((p) => `${p.x},${p.z}`).sort(),
    regions: doc.regions
      .map((r) => `${r.x},${r.z},${r.mattype},${r.size}`)
      .sort(),
    // Line endpoints as coordinate pairs (order-independent within a line).
    edges: doc.lines
      .map((s) => {
        const p0 = doc.points.find((p) => p.id === s.p0)!
        const p1 = doc.points.find((p) => p.id === s.p1)!
        const a = `${p0.x},${p0.z}`
        const b = `${p1.x},${p1.z}`
        return [a, b].sort().join('|')
      })
      .sort(),
  }
}

describe('parse <-> serialize roundtrip on all sample files', () => {
  for (const s of SAMPLES) {
    test(`${s.id} is structurally preserved`, () => {
      const first = parsePoly(s.content)
      const out = serializePoly(first.doc)
      const second = parsePoly(out)

      // Re-serializing produces a clean file (no structural warnings).
      expect(second.warnings).toEqual([])
      // Structure is preserved across the roundtrip.
      expect(signature(second.doc)).toEqual(signature(first.doc))
    })
  }

  describe('import -> store -> export reproduces an equivalent file', () => {
    beforeEach(() => useEditorStore.getState().reset())
    for (const s of SAMPLES) {
      test(`${s.id} survives the store round-trip`, () => {
        const imported = parsePoly(s.content)
        useEditorStore.getState().loadDocument(imported.doc)
        const exported = serializePoly(useEditorStore.getState().toDocument())
        const reparsed = parsePoly(exported)
        expect(signature(reparsed.doc)).toEqual(signature(imported.doc))
      })
    }
  })

  test('serialized output uses contiguous 0-based node indexing', () => {
    const { doc } = parsePoly(SAMPLES[0].content)
    const out = serializePoly(doc)
    // The node section lists ids 0..N-1 in order.
    const lines = out.split('\n')
    const headerIdx = lines.findIndex((l) => /^\d+ 2 0 0$/.test(l))
    expect(headerIdx).toBeGreaterThanOrEqual(0)
    const firstNode = lines[headerIdx + 2] // skip "# i x z" comment
    expect(firstNode.startsWith('0 ')).toBe(true)
  })
})
