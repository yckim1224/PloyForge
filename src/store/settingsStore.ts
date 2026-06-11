import { create } from 'zustand'
import type { Material } from '../types'
import { materialColor } from '../constants/materials'

/** Per-flag visual style for a line (color + dash pattern). */
export interface LineStyle {
  color: string
  dash: number[]
}

export type BoundaryFlagKey = 0 | 1 | 2 | 16 | 32

export interface GridSettings {
  lineColor: string
  /** Color for the major (every 10th) grid lines. Slightly darker than `lineColor`. */
  majorColor: string
  lineWidth: number
  /** Major (every 10th) line width in pixels. Independent of `lineWidth`. */
  majorWidth: number
  show: boolean
  /** Snap-grid spacing in meters (also used for arrow-key nudge step). */
  spacing: number
}

export interface PointSettings {
  radius: number
  color: string
  selectedColor: string
}

export interface LineSettings {
  width: number
  styleByFlag: Record<BoundaryFlagKey, LineStyle>
}

/**
 * App-wide display preferences. The `.poly` document is unaffected by these.
 * `materials` is the color/label palette used to render face Types.
 */
export interface AppSettings {
  grid: GridSettings
  point: PointSettings
  line: LineSettings
  materials: Material[]
}

export interface SettingsState extends AppSettings {
  setGrid: (patch: Partial<GridSettings>) => void
  setPoint: (patch: Partial<PointSettings>) => void
  setLine: (patch: Partial<LineSettings>) => void
  /** Ensure a material entry exists for `mattype`. Never overwrites an existing entry. */
  ensureMaterial: (mattype: number) => void
  /** Explicit overwrite for a material entry (used by Settings UI). */
  setMaterial: (mattype: number, patch: Partial<Omit<Material, 'mattype'>>) => void
  /** Restore default display settings (grid/point/line). Does NOT touch materials. */
  resetDisplaySettings: () => void
  /** Replace the whole settings shape (used to hydrate from persistence). */
  hydrate: (s: AppSettings) => void
}

const STORAGE_KEY = 'poly-forge:settings:v1'

export function defaultGrid(): GridSettings {
  return {
    lineColor: '#e5e7eb',
    majorColor: '#cbd5e1',
    lineWidth: 1,
    majorWidth: 1.5,
    show: true,
    spacing: 25_000,
  }
}

export function defaultPoint(): PointSettings {
  return {
    radius: 4,
    color: '#1f2937',
    selectedColor: '#7c3aed',
  }
}

export function defaultLine(): LineSettings {
  return {
    width: 2,
    styleByFlag: {
      0: { color: '#94a3b8', dash: [8, 6] },
      1: { color: '#3b82f6', dash: [] },
      2: { color: '#ef4444', dash: [] },
      16: { color: '#f59e0b', dash: [] },
      32: { color: '#10b981', dash: [] },
    },
  }
}

export function defaultSettings(): AppSettings {
  return {
    grid: defaultGrid(),
    point: defaultPoint(),
    line: defaultLine(),
    materials: [],
  }
}

function isLineStyle(v: unknown): v is LineStyle {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return typeof s.color === 'string' && Array.isArray(s.dash)
}

function isValidSettings(v: unknown): v is AppSettings {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  if (!s.grid || typeof s.grid !== 'object') return false
  if (!s.point || typeof s.point !== 'object') return false
  if (!s.line || typeof s.line !== 'object') return false
  if (!Array.isArray(s.materials)) return false
  const lineRec = s.line as Record<string, unknown>
  if (!lineRec.styleByFlag || typeof lineRec.styleByFlag !== 'object') return false
  const styles = lineRec.styleByFlag as Record<string, unknown>
  for (const key of ['0', '1', '2', '16', '32']) {
    if (!isLineStyle(styles[key])) return false
  }
  return true
}

export function loadSettings(): AppSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isValidSettings(parsed)) return null
    // Backfill any field added after the v1 shape was minted (e.g. grid.spacing)
    // so legacy persisted settings still hydrate to a complete shape.
    const defaults = defaultSettings()
    return {
      ...parsed,
      grid: { ...defaults.grid, ...parsed.grid },
      point: { ...defaults.point, ...parsed.point },
      line: { ...defaults.line, ...parsed.line },
    }
  } catch {
    return null
  }
}

export function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* storage may be unavailable (private mode, quota); ignore */
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings(),

  setGrid: (patch) => set((s) => ({ grid: { ...s.grid, ...patch } })),
  setPoint: (patch) => set((s) => ({ point: { ...s.point, ...patch } })),
  setLine: (patch) => set((s) => ({ line: { ...s.line, ...patch } })),

  ensureMaterial: (mattype) => {
    if (get().materials.some((m) => m.mattype === mattype)) return
    set((s) => ({
      materials: [...s.materials, { mattype, color: materialColor(mattype) }].sort(
        (a, b) => a.mattype - b.mattype,
      ),
    }))
  },

  setMaterial: (mattype, patch) => {
    set((s) => ({
      materials: s.materials.map((m) => (m.mattype === mattype ? { ...m, ...patch } : m)),
    }))
  },

  resetDisplaySettings: () =>
    set({
      grid: defaultGrid(),
      point: defaultPoint(),
      line: defaultLine(),
    }),

  hydrate: (s) =>
    set({
      grid: s.grid,
      point: s.point,
      line: s.line,
      materials: s.materials,
    }),
}))
