import { describe, expect, test } from 'vitest'
import { isImageFile } from './imageFile'

function file(name: string, type = ''): File {
  return new File(['x'], name, { type })
}

describe('isImageFile', () => {
  test('accepts files with an image/* MIME type', () => {
    expect(isImageFile(file('photo', 'image/png'))).toBe(true)
    expect(isImageFile(file('fig.bin', 'image/jpeg'))).toBe(true)
  })

  test('accepts known image extensions without a MIME type', () => {
    for (const name of ['a.jpg', 'a.JPEG', 'b.png', 'c.webp', 'd.gif', 'e.bmp', 'f.svg']) {
      expect(isImageFile(file(name))).toBe(true)
    }
  })

  test('rejects .poly and other non-image files', () => {
    expect(isImageFile(file('mesh.poly'))).toBe(false)
    expect(isImageFile(file('mesh.smesh'))).toBe(false)
    expect(isImageFile(file('notes.txt', 'text/plain'))).toBe(false)
  })
})
