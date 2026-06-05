import type { Line, Material, Point, PolyDocument } from '../types'
import { detectFaces } from '../poly/faces'
import { pointInPolygon, type Vec2 } from '../lib/geometry'
import { useSettingsStore } from '../store/settingsStore'

const KEY_V3 = 'poly-forge:doc:v3'
const KEY_V2 = 'poly-forge:doc:v2'
const KEY_V2_BACKUP = 'poly-forge:doc:v2.backup'
const KEY_V1 = 'poly-forge:doc:v1'
const KEY_V1_ORPHANS = 'poly-forge:doc:v1.orphans'

interface LegacyRegion {
  id?: string
  x: number
  z: number
  mattype: number
  size: number
}

/** Intermediate v2 shape used while migrating v1 -> v2 -> v3 in a single pass. */
interface V2Document {
  domain?: Record<string, unknown> | null
  points: Point[]
  lines: Line[]
  faceTypes: Record<string, { mattype: number; size: number }>
}

function isValidV3Shape(doc: unknown): doc is PolyDocument {
  if (!doc || typeof doc !== 'object') return false
  const d = doc as Record<string, unknown>
  return (
    Array.isArray(d.points) &&
    Array.isArray(d.lines) &&
    // Forward-compat: treat missing faceTypes as {}.
    (d.faceTypes === undefined ||
      (typeof d.faceTypes === 'object' && d.faceTypes !== null && !Array.isArray(d.faceTypes)))
  )
}

function isValidV2Shape(doc: unknown): doc is V2Document {
  if (!doc || typeof doc !== 'object') return false
  const d = doc as Record<string, unknown>
  return (
    Array.isArray(d.points) &&
    Array.isArray(d.lines) &&
    typeof d.domain === 'object' &&
    d.domain !== null &&
    (d.faceTypes === undefined ||
      (typeof d.faceTypes === 'object' && d.faceTypes !== null && !Array.isArray(d.faceTypes)))
  )
}

/**
 * Convert an in-memory v2-shaped object to v3 (no `domain` field) and lift
 * `domain.gridSpacing` into `settingsStore.grid.spacing`. The lift only fires
 * when `settingsHydrated === false`: a returning user with their own persisted
 * settings already has the grid spacing they want, so we leave it alone.
 */
function migrateV2ToV3(v2: V2Document, settingsHydrated: boolean): PolyDocument {
  const domain = (v2.domain ?? {}) as Record<string, unknown>
  const gs = domain.gridSpacing
  if (!settingsHydrated && typeof gs === 'number' && Number.isFinite(gs) && gs > 0) {
    useSettingsStore.getState().setGrid({ spacing: gs })
  }
  return {
    points: v2.points,
    lines: v2.lines,
    faceTypes: v2.faceTypes ?? {},
  }
}

export function savePersisted(doc: PolyDocument): void {
  try {
    localStorage.setItem(KEY_V3, JSON.stringify(doc))
  } catch {
    /* storage may be unavailable (private mode, quota); ignore */
  }
}

export interface LoadOptions {
  /** True when the caller already restored persisted settings from storage.
   *  When true, v2->v3 migration leaves settings.grid.spacing alone instead of
   *  overwriting the user's customization with the legacy domain.gridSpacing. */
  settingsHydrated?: boolean
}

export function loadPersisted(opts: LoadOptions = {}): PolyDocument | null {
  const settingsHydrated = opts.settingsHydrated ?? false
  // Try v3 first.
  try {
    const rawV3 = localStorage.getItem(KEY_V3)
    if (rawV3) {
      const doc = JSON.parse(rawV3) as unknown
      if (!isValidV3Shape(doc)) return null
      const d = doc as PolyDocument & { faceTypes?: PolyDocument['faceTypes'] }
      return {
        points: d.points,
        lines: d.lines,
        faceTypes: d.faceTypes ?? {},
      }
    }
  } catch {
    return null
  }

  // Try v2 (one-shot migration to v3).
  const rawV2 = localStorage.getItem(KEY_V2)
  if (rawV2) {
    try {
      const parsed = JSON.parse(rawV2) as unknown
      if (!isValidV2Shape(parsed)) throw new Error('v2 document has an invalid shape')
      const migrated = migrateV2ToV3(parsed, settingsHydrated)
      try {
        localStorage.setItem(KEY_V3, JSON.stringify(migrated))
      } catch {
        /* persist failure is non-fatal; document still returns to caller */
      }
      return migrated
    } catch (err) {
      try {
        localStorage.setItem(KEY_V2_BACKUP, rawV2)
      } catch {
        /* backup may also fail (quota); nothing else we can do */
      }
      console.warn('poly-forge: v2 -> v3 migration failed; starting empty.', err)
      return null
    }
  }

  // Fall back to v1 with a chained migration (v1 -> v2-shaped intermediate -> v3).
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

    const intermediate: V2Document = {
      domain: v1.domain as Record<string, unknown>,
      points,
      lines,
      faceTypes,
    }
    const migrated = migrateV2ToV3(intermediate, settingsHydrated)
    try {
      localStorage.setItem(KEY_V3, JSON.stringify(migrated))
    } catch {
      /* persist failure is non-fatal; document still returns to caller */
    }
    return migrated
  } catch (err) {
    try {
      // Keep historical key for backwards compat with any external tooling
      // watching for the v1.backup key.
      localStorage.setItem('poly-forge:doc:v1.backup', rawV1)
    } catch {
      /* backup may also fail (quota); nothing else we can do */
    }
    console.warn('poly-forge: v1 -> v3 migration failed; starting empty.', err)
    return null
  }
}
