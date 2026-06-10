/** Image extensions accepted as a background (browser-decodable formats). */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif', '.svg'] as const

/**
 * True when a dropped/selected file should be treated as a background image
 * rather than a `.poly` document. MIME type wins; the extension list is a
 * fallback for files the OS reported without an `image/*` type.
 */
export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  const lower = file.name.toLowerCase()
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}
