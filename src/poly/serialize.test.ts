import { describe, expect, test } from 'vitest'
import { serializePoly } from './serialize'
import { parsePoly } from './parse'
import { defaultDomain } from '../lib/defaults'
import { detectFaces } from './faces'
import { pointInPolygon } from '../lib/geometry'
import type { PolyDocument } from '../types'

function makeDoc(): PolyDocument {
  // A closed square (one face) plus an open polyline (no face).
  return {
    domain: defaultDomain(),
    points: [
      { id: 'pA', x: 0, z: 0 },
      { id: 'pB', x: 1000, z: 0 },
      { id: 'pC', x: 1000, z: -500 },
      { id: 'pD', x: 0, z: -500 },
    ],
    lines: [
      { id: 's1', p0: 'pA', p1: 'pB', bdryFlag: 32 },
      { id: 's2', p0: 'pB', p1: 'pC', bdryFlag: 2 },
      { id: 's3', p0: 'pC', p1: 'pD', bdryFlag: 16 },
      { id: 's4', p0: 'pD', p1: 'pA', bdryFlag: 1 },
    ],
    faceTypes: {},
  }
}

describe('serializePoly', () => {
  test('emits the four DES3D sections with correct headers', () => {
    const { text } = serializePoly(makeDoc())
    expect(text).toContain('4 2 0 0') // npoints ndims 0 0
    expect(text).toContain('4 1') // nsegments has_bdryflag
    expect(text).toMatch(/#### holes ####\n0/)
    expect(text).toContain('#### regions ####')
    expect(text.endsWith('\n')).toBe(true)
  })

  test('reindexes points to contiguous 0-based integers and remaps segments', () => {
    const { text } = serializePoly(makeDoc())
    const { doc } = parsePoly(text)
    expect(doc.points.length).toBe(4)
    expect(doc.lines.length).toBe(4)
    // pA->0, pB->1, ...; first segment endpoints become (0,1).
    const coordsOf = (id: string) => {
      const p = doc.points.find((x) => x.id === id)!
      return { x: p.x, z: p.z }
    }
    expect(coordsOf(doc.lines[0].p0)).toEqual({ x: 0, z: 0 })
    expect(coordsOf(doc.lines[0].p1)).toEqual({ x: 1000, z: 0 })
  })

  test('drops self-loops and segments with dangling endpoints', () => {
    const doc = makeDoc()
    doc.lines.push({ id: 'bad1', p0: 'pA', p1: 'pA', bdryFlag: 0 })
    doc.lines.push({ id: 'bad2', p0: 'pA', p1: 'ghost', bdryFlag: 0 })
    const { text } = serializePoly(doc)
    // Still only the 4 valid segments.
    expect(text).toContain('4 1')
  })

  test('formats integers cleanly and avoids negative zero', () => {
    const doc = makeDoc()
    doc.points[0] = { id: 'pA', x: -0, z: 0 }
    const { text } = serializePoly(doc)
    expect(text).not.toContain('-0 ')
    expect(text).toContain('0 0 0') // node 0 at x=0 z=0
  })

  test('emits one region per detected face (nregions == nFaces)', () => {
    const doc = makeDoc()
    const faces = detectFaces(doc.points, doc.lines)
    expect(faces.length).toBe(1)
    const { text } = serializePoly(doc)
    // Header "# nregions" followed by the count line.
    const lines = text.split('\n')
    const headerIdx = lines.findIndex((l) => l === '# nregions')
    expect(headerIdx).toBeGreaterThanOrEqual(0)
    expect(lines[headerIdx + 1]).toBe(String(faces.length))
  })

  test('untyped face defaults to mattype 0 and reports untypedFaceCount', () => {
    const doc = makeDoc()
    const { text, untypedFaceCount } = serializePoly(doc)
    expect(untypedFaceCount).toBe(1)
    // Format: "k xk zk mattype size" with mattype 0 (untyped face fallback).
    const lines = text.split('\n')
    const headerIdx = lines.findIndex((l) => l === '# k xk zk mattype size')
    expect(headerIdx).toBeGreaterThanOrEqual(0)
    const regionLine = lines[headerIdx + 1].split(/\s+/)
    expect(regionLine[3]).toBe('0')
    expect(regionLine[4]).toBe('-1')
  })

  test('uses faceTypes.mattype/size when assigned', () => {
    const doc = makeDoc()
    const faces = detectFaces(doc.points, doc.lines)
    const fid = faces[0].id
    doc.faceTypes[fid] = { mattype: 7, size: 42 }
    const { text, untypedFaceCount } = serializePoly(doc)
    expect(untypedFaceCount).toBe(0)
    const lines = text.split('\n')
    const headerIdx = lines.findIndex((l) => l === '# k xk zk mattype size')
    const regionLine = lines[headerIdx + 1].split(/\s+/)
    expect(regionLine[3]).toBe('7')
    expect(regionLine[4]).toBe('42')
  })

  test('region seed coordinates land inside their face', () => {
    const doc = makeDoc()
    const faces = detectFaces(doc.points, doc.lines)
    const { text } = serializePoly(doc)
    const lines = text.split('\n')
    const headerIdx = lines.findIndex((l) => l === '# k xk zk mattype size')
    const regionLine = lines[headerIdx + 1].split(/\s+/)
    const x = parseFloat(regionLine[1])
    const z = parseFloat(regionLine[2])
    const pointById = new Map(doc.points.map((p) => [p.id, p]))
    const verts = faces[0].pointIds
      .map((pid) => pointById.get(pid)!)
      .map((p) => ({ x: p.x, z: p.z }))
    expect(pointInPolygon({ x, z }, verts)).toBe(true)
  })

  test('emits nregions=0 when points exist but no face is detected', () => {
    const doc: PolyDocument = {
      domain: defaultDomain(),
      // Two-point open line cannot form a face.
      points: [
        { id: 'a', x: 0, z: 0 },
        { id: 'b', x: 100, z: 0 },
      ],
      lines: [{ id: 's0', p0: 'a', p1: 'b', bdryFlag: 0 }],
      faceTypes: {},
    }
    const { text, untypedFaceCount } = serializePoly(doc)
    expect(untypedFaceCount).toBe(0)
    const lines = text.split('\n')
    const headerIdx = lines.findIndex((l) => l === '# nregions')
    expect(lines[headerIdx + 1]).toBe('0')
  })
})
