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
    // Require the full document shape; a partial value would assign undefined into
    // store fields the UI maps over and crash on mount.
    if (
      !doc ||
      !Array.isArray(doc.points) ||
      !Array.isArray(doc.segments) ||
      !Array.isArray(doc.regions) ||
      !Array.isArray(doc.materials) ||
      typeof doc.domain !== 'object' ||
      doc.domain === null
    ) {
      return null
    }
    return doc
  } catch {
    return null
  }
}
