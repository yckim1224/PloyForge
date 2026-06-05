// Core domain types for the poly-forge 2D PSLG editor.
// Coordinate convention: x is horizontal, z is depth (z <= 0, increasing downward).

/** Cross-section domain extent and meshing parameters (not stored in the .poly file itself). */
export interface Domain {
  xmin: number
  xmax: number
  zmin: number
  zmax: number
  /** Snap-grid spacing in meters. */
  gridSpacing: number
  /** DES3D meshing_option: 90 = absolute element sizes, 91 = size as ratio to resolution. */
  meshingOption: 90 | 91
  /** Reference resolution in meters (used by meshing_option 91). */
  resolution: number
}

export interface Point {
  id: string
  x: number
  z: number
}

/**
 * Boundary flag for a line. DES3D requires a single bit:
 * 0 = internal, 1 = left (X0), 2 = right (X1), 16 = bottom (Z0), 32 = top (Z1).
 * (3D adds 4/8 for Y0/Y1 and 64..512 for slanted faces.)
 */
export interface Line {
  id: string
  p0: string
  p1: string
  bdryFlag: number
}

/**
 * A derived closed face (computed via polygonize); not serialized directly.
 * `mattype` / `size` are resolved by `recomputeFaces` from the document's
 * `faceTypes` map (undefined when the face has no Type assigned).
 */
export interface Face {
  id: string
  pointIds: string[]
  lineIds: string[]
  centroid: { x: number; z: number }
  area: number
  mattype?: number
  size?: number
}

/** Display-only material color/label (lives in settingsStore, never in .poly). */
export interface Material {
  mattype: number
  color: string
  label?: string
}

/**
 * The serializable editor document. Faces are derived (excluded) and material
 * Types are stored as a face-keyed map (`faceId -> { mattype, size }`).
 * `faceId` follows `face:${sorted-pointIds}` so it survives translations.
 */
export interface PolyDocument {
  domain: Domain
  points: Point[]
  lines: Line[]
  faceTypes: Record<string, { mattype: number; size: number }>
}
