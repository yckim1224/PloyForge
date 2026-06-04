// Default color palette for material types (mattype). Colors cycle for high indices.
export const MATERIAL_PALETTE = [
  '#60a5fa', // blue
  '#f87171', // red
  '#34d399', // emerald
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#f472b6', // pink
  '#22d3ee', // cyan
  '#fb923c', // orange
  '#a3e635', // lime
  '#94a3b8', // slate
] as const

export function materialColor(mattype: number): string {
  if (mattype < 0) return '#cbd5e1'
  return MATERIAL_PALETTE[mattype % MATERIAL_PALETTE.length]
}
