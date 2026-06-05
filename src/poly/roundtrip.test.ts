import { beforeEach, describe, expect, test } from 'vitest'
import { parsePoly } from './parse'
import { serializePoly } from './serialize'
import { detectFaces } from './faces'
import type { PolyDocument } from '../types'
import { SAMPLES } from '../samples'
import { useEditorStore } from '../store/editorStore'

/**
 * A structural fingerprint that is independent of internal ids/point ordering.
 * Equality is checked per-face by canonical face id (face:${sorted-pointIds}),
 * with `pointInPolygon` coordinate equality emulated via sorted point/line sets.
 */
function signature(doc: PolyDocument) {
  // Compare points by sorted coordinate strings (internal ids are uid-generated).
  const coords = doc.points.map((p) => `${p.x},${p.z}`).sort()
  // Lines: endpoint coordinate pairs (order-independent within a line), each
  // tagged with the boundary flag so the round-trip preserves both.
  const edges = doc.lines
    .map((s) => {
      const p0 = doc.points.find((p) => p.id === s.p0)!
      const p1 = doc.points.find((p) => p.id === s.p1)!
      const a = `${p0.x},${p0.z}`
      const b = `${p1.x},${p1.z}`
      return `${[a, b].sort().join('|')}@${s.bdryFlag}`
    })
    .sort()
  // Faces: map each detected face's id to its (input-side) mattype; untyped
  // faces collapse to 0 because serialize emits mattype 0 in that case.
  const faces = detectFaces(doc.points, doc.lines)
  const faceTypeByCanonicalId: Record<string, number> = {}
  for (const f of faces) {
    const spec = doc.faceTypes[f.id]
    faceTypeByCanonicalId[f.id] = spec?.mattype ?? 0
  }
  // Canonicalize the face-id keys by remapping pointIds -> coord strings so
  // that two docs with different uids but identical geometry compare equal.
  const ptCoord = new Map(doc.points.map((p) => [p.id, `${p.x},${p.z}`]))
  const canonicalFaces: Record<string, number> = {}
  for (const f of faces) {
    const key = [...f.pointIds.map((pid) => ptCoord.get(pid)!)].sort().join('|')
    canonicalFaces[key] = faceTypeByCanonicalId[f.id]
  }
  return {
    nPoints: doc.points.length,
    nLines: doc.lines.length,
    nFaces: faces.length,
    coords,
    edges,
    faces: canonicalFaces,
  }
}

describe('parse <-> serialize roundtrip on all sample files', () => {
  for (const s of SAMPLES) {
    test(`${s.id} is structurally preserved (per-face equality)`, () => {
      const first = parsePoly(s.content)
      const out = serializePoly(first.doc)
      const second = parsePoly(out.text)

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
        useEditorStore.getState().loadDocument(imported.doc, imported.discoveredMaterials)
        const exported = serializePoly(useEditorStore.getState().toDocument())
        const reparsed = parsePoly(exported.text)
        expect(signature(reparsed.doc)).toEqual(signature(imported.doc))
      })
    }
  })

  test('serialized output uses contiguous 0-based node indexing', () => {
    const { doc } = parsePoly(SAMPLES[0].content)
    const out = serializePoly(doc)
    // The node section lists ids 0..N-1 in order.
    const lines = out.text.split('\n')
    const headerIdx = lines.findIndex((l) => /^\d+ 2 0 0$/.test(l))
    expect(headerIdx).toBeGreaterThanOrEqual(0)
    const firstNode = lines[headerIdx + 2] // skip "# i x z" comment
    expect(firstNode.startsWith('0 ')).toBe(true)
  })
})
