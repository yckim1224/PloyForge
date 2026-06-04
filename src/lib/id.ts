// Monotonic id generator. Ids are app-internal handles (not persisted as meaningful
// values); serialization reindexes points to contiguous 0-based integers.
let counter = 0

export function uid(prefix = 'n'): string {
  counter += 1
  return `${prefix}${counter}`
}
