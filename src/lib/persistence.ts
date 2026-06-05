import type { PolyDocument } from '../types'

const KEY_V2 = 'poly-forge:doc:v2'
const KEY_V1 = 'poly-forge:doc:v1'
const KEY_V1_BACKUP = 'poly-forge:doc:v1.backup'

function isValidV2Shape(doc: unknown): doc is PolyDocument {
  if (!doc || typeof doc !== 'object') return false
  const d = doc as Record<string, unknown>
  return (
    Array.isArray(d.points) &&
    Array.isArray(d.lines) &&
    Array.isArray(d.regions) &&
    Array.isArray(d.materials) &&
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
      return { ...d, faceTypes: d.faceTypes ?? {} }
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
    const migrated: PolyDocument = {
      domain: v1.domain as PolyDocument['domain'],
      points: v1.points as PolyDocument['points'],
      lines: v1.segments as PolyDocument['lines'],
      regions: v1.regions as PolyDocument['regions'],
      materials: v1.materials as PolyDocument['materials'],
      faceTypes: {},
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
