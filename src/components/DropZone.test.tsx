import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DropZone } from './DropZone'
import { useImportStore } from '../store/importStore'
import { useEditorStore } from '../store/editorStore'
import { useToastStore } from '../store/toastStore'

const realRequestImport = useImportStore.getState().requestImport
let importMock: ReturnType<typeof vi.fn<(file: File) => Promise<void>>>

/** Build a drag/drop event with a minimal DataTransfer stub (jsdom lacks one). */
function fileDragEvent(type: string, opts: { files?: File[]; isFile?: boolean } = {}): Event {
  const { files = [], isFile = true } = opts
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(e, 'dataTransfer', {
    value: { types: isFile ? ['Files'] : ['text/plain'], files, dropEffect: 'none' },
  })
  return e
}

function dispatch(e: Event): void {
  act(() => {
    window.dispatchEvent(e)
  })
}

beforeEach(() => {
  importMock = vi.fn<(file: File) => Promise<void>>(async () => {})
  useImportStore.setState({ requestImport: importMock, pending: null })
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  cleanup()
  useImportStore.setState({ requestImport: realRequestImport, pending: null })
})

describe('DropZone', () => {
  test('renders nothing until a file drag enters', () => {
    const { container } = render(<DropZone />)
    expect(container.firstChild).toBeNull()
  })

  test('shows the overlay on a file dragenter and hides it on dragleave', () => {
    render(<DropZone />)
    dispatch(fileDragEvent('dragenter'))
    expect(screen.getByText(/Drop a/)).toBeTruthy()
    dispatch(fileDragEvent('dragleave'))
    expect(screen.queryByText(/Drop a/)).toBeNull()
  })

  test('ignores non-file drags (no overlay)', () => {
    render(<DropZone />)
    dispatch(fileDragEvent('dragenter', { isFile: false }))
    expect(screen.queryByText(/Drop a/)).toBeNull()
  })

  test('dragover over a file drag is preventDefault-ed', () => {
    render(<DropZone />)
    const e = fileDragEvent('dragover')
    dispatch(e)
    expect(e.defaultPrevented).toBe(true)
  })

  test('drops a single file into requestImport and hides the overlay', () => {
    render(<DropZone />)
    const file = new File(['x'], 'mesh.poly')
    dispatch(fileDragEvent('dragenter'))
    dispatch(fileDragEvent('drop', { files: [file] }))
    expect(importMock).toHaveBeenCalledTimes(1)
    expect(importMock).toHaveBeenCalledWith(file)
    expect(screen.queryByText(/Drop a/)).toBeNull()
  })

  test('rejects multiple files with an error toast and no import', () => {
    render(<DropZone />)
    const a = new File(['a'], 'a.poly')
    const b = new File(['b'], 'b.poly')
    dispatch(fileDragEvent('drop', { files: [a, b] }))
    expect(importMock).not.toHaveBeenCalled()
    const errors = useToastStore.getState().toasts.filter((t) => t.level === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/Only one file/)
  })

  test('routes an image drop to the background loader, not the importer', () => {
    const bgMock = vi.fn()
    const prev = useEditorStore.getState().loadBackgroundFromFile
    useEditorStore.setState({ loadBackgroundFromFile: bgMock })
    render(<DropZone />)
    const img = new File(['x'], 'fig.png', { type: 'image/png' })
    dispatch(fileDragEvent('drop', { files: [img] }))
    expect(bgMock).toHaveBeenCalledTimes(1)
    expect(importMock).not.toHaveBeenCalled()
    useEditorStore.setState({ loadBackgroundFromFile: prev })
  })

  test('ignores a drop with no files', () => {
    render(<DropZone />)
    dispatch(fileDragEvent('drop', { files: [] }))
    expect(importMock).not.toHaveBeenCalled()
  })
})
