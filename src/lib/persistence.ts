import type { PolyDocument } from '../types'

const KEY = 'poly-forge:doc:v1'

export function savePersisted(doc: PolyDocument): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(doc))
  } catch {
    /* storage may be unavailable (private mode, quota); ignore */
  }
}

export function loadPersisted(): PolyDocument | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const doc = JSON.parse(raw) as PolyDocument
    if (!doc || !Array.isArray(doc.points) || !Array.isArray(doc.segments)) return null
    return doc
  } catch {
    return null
  }
}

export function clearPersisted(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
