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
 * Boundary flag for a segment. DES3D requires a single bit:
 * 0 = internal, 1 = left (X0), 2 = right (X1), 16 = bottom (Z0), 32 = top (Z1).
 * (3D adds 4/8 for Y0/Y1 and 64..512 for slanted faces.)
 */
export interface Segment {
  id: string
  p0: string
  p1: string
  bdryFlag: number
}

/** A region is a seed point inside a closed area plus its material/size attributes. */
export interface Region {
  id: string
  x: number
  z: number
  /** Material type, 0-based. */
  mattype: number
  /** Max element area; -1 means unlimited. */
  size: number
  /** Optional link to the detected face the seed sits inside. */
  faceId?: string
}

/** A derived closed face (computed via polygonize); not serialized directly. */
export interface Face {
  id: string
  pointIds: string[]
  segmentIds: string[]
  centroid: { x: number; z: number }
  area: number
  regionId?: string
}

export interface Material {
  mattype: number
  color: string
  label?: string
}

/** The serializable editor document (derived faces excluded). */
export interface PolyDocument {
  domain: Domain
  points: Point[]
  segments: Segment[]
  regions: Region[]
  materials: Material[]
}
