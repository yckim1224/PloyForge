// Shared numeric input parsers for the panel AddRow/Column edits.
// Empty input returns null (caller decides: required vs. optional).

export function parseFloatOrNull(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function parseIntOrNull(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isInteger(n)) return null
  return n
}

export function parseNonNegativeIntOrNull(raw: string): number | null {
  const n = parseIntOrNull(raw)
  return n !== null && n >= 0 ? n : null
}
