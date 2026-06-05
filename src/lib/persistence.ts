import type { Line, Material, Point, PolyDocument } from '../types'
import { detectFaces } from '../poly/faces'
import { pointInPolygon, type Vec2 } from '../lib/geometry'
import { useSettingsStore } from '../store/settingsStore'

const KEY_V2 = 'poly-forge:doc:v2'
const KEY_V1 = 'poly-forge:doc:v1'
const KEY_V1_BACKUP = 'poly-forge:doc:v1.backup'
const KEY_V1_ORPHANS = 'poly-forge:doc:v1.orphans'

interface LegacyRegion {
  id?: string
  x: number
  z: number
  mattype: number
  size: number
}

function isValidV2Shape(doc: unknown): doc is PolyDocument {
  if (!doc || typeof doc !== 'object') return false
  const d = doc as Record<string, unknown>
  return (
    Array.isArray(d.points) &&
    Array.isArray(d.lines) &&
    typeof d.domain === 'object' &&
    d.domain !== null &&
    // Forward-compat: treat missing faceTypes as {}.
    (d.faceTypes === undefined ||
      (typeof d.faceTypes === 'object' && d.faceTypes !== null && !Array.isArray(d.faceTypes)))
  )
}

export function savePersisted(doc: PolyDocument): void {
  try {
    localStorage.setItem(KEY_V2, JSON.stringify(doc))
  } catch {
    /* storage may be unavailable (private mode, quota); ignore */
  }
}

export function loadPersisted(): PolyDocument | null {
  // Try v2 first.
  try {
    const rawV2 = localStorage.getItem(KEY_V2)
    if (rawV2) {
      const doc = JSON.parse(rawV2) as unknown
      if (!isValidV2Shape(doc)) return null
      const d = doc as PolyDocument & { faceTypes?: PolyDocument['faceTypes'] }
      return {
        domain: d.domain,
        points: d.points,
        lines: d.lines,
        faceTypes: d.faceTypes ?? {},
      }
    }
  } catch {
    return null
  }

  // Fall back to v1 with one-shot migration.
  const rawV1 = localStorage.getItem(KEY_V1)
  if (!rawV1) return null
  try {
    const v1 = JSON.parse(rawV1) as Record<string, unknown>
    if (
      !v1 ||
      typeof v1 !== 'object' ||
      !Array.isArray(v1.points) ||
      !Array.isArray(v1.segments) ||
      !Array.isArray(v1.regions) ||
      !Array.isArray(v1.materials) ||
      typeof v1.domain !== 'object' ||
      v1.domain === null
    ) {
      throw new Error('v1 document is missing required fields')
    }
    const points = v1.points as Point[]
    const lines = v1.segments as Line[]
    const regions = v1.regions as LegacyRegion[]
    const v1Materials = v1.materials as Material[]

    // Compute v1 faces and map each region onto a face by point-in-polygon.
    const faces = detectFaces(points, lines)
    const pointById = new Map(points.map((p) => [p.id, p]))
    const faceVerts: Vec2[][] = faces.map((f) =>
      f.pointIds
        .map((pid) => pointById.get(pid))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => ({ x: p.x, z: p.z })),
    )

    const faceTypes: PolyDocument['faceTypes'] = {}
    const orphans: LegacyRegion[] = []
    for (const r of regions) {
      let matched = -1
      for (let k = 0; k < faces.length; k++) {
        if (pointInPolygon({ x: r.x, z: r.z }, faceVerts[k])) {
          matched = k
          break
        }
      }
      if (matched < 0) {
        orphans.push(r)
        continue
      }
      faceTypes[faces[matched].id] = { mattype: r.mattype, size: r.size }
    }

    if (orphans.length > 0) {
      try {
        localStorage.setItem(KEY_V1_ORPHANS, JSON.stringify(orphans))
      } catch {
        /* stash failure is non-fatal */
      }
      console.warn(
        `poly-forge: v1 -> v2 migration: ${orphans.length} region(s) sit outside every detected face; stashed at localStorage["${KEY_V1_ORPHANS}"] for later recovery.`,
      )
    }

    // Merge v1 material color/label entries into settingsStore. Only mattypes
    // that did not already have a settings entry inherit v1's customization;
    // existing settings entries are never overwritten.
    const settings = useSettingsStore.getState()
    const preexisting = new Set(settings.materials.map((m) => m.mattype))
    for (const m of v1Materials) {
      settings.ensureMaterial(m.mattype)
      if (!preexisting.has(m.mattype)) {
        settings.setMaterial(m.mattype, { color: m.color, label: m.label })
      }
    }

    const migrated: PolyDocument = {
      domain: v1.domain as PolyDocument['domain'],
      points,
      lines,
      faceTypes,
    }
    try {
      localStorage.setItem(KEY_V2, JSON.stringify(migrated))
    } catch {
      /* persist failure is non-fatal; document still returns to caller */
    }
    return migrated
  } catch (err) {
    try {
      localStorage.setItem(KEY_V1_BACKUP, rawV1)
    } catch {
      /* backup may also fail (quota); nothing else we can do */
    }
    console.warn('poly-forge: v1 -> v2 migration failed; starting empty.', err)
    return null
  }
}
