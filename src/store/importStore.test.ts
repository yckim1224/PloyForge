import { beforeEach, describe, expect, test } from 'vitest'
import { useImportStore } from './importStore'
import { useEditorStore } from './editorStore'
import { useToastStore, type ToastLevel } from './toastStore'
import { useSettingsStore, defaultSettings } from './settingsStore'

const editor = () => useEditorStore.getState()
const imports = () => useImportStore.getState()

/** A minimal valid 2D .poly: a single triangle, no holes, no regions. */
const TRIANGLE = `3 2 0 0
1 0 0
2 100 0
3 50 -50
3 1
1 1 2 0
2 2 3 0
3 3 1 0
0
0
`

/** Same triangle but with 6 regions that fall outside it -> 6 parse warnings. */
const TRIANGLE_WITH_STRAY_REGIONS = `3 2 0 0
1 0 0
2 100 0
3 50 -50
3 1
1 1 2 0
2 2 3 0
3 3 1 0
0
6
1 1000 1000 1 -1
2 1001 1000 1 -1
3 1002 1000 1 -1
4 1003 1000 1 -1
5 1004 1000 1 -1
6 1005 1000 1 -1
`

function polyFile(text: string, name = 'mesh.poly'): File {
  return new File([text], name, { type: 'text/plain' })
}

function toastsOf(level: ToastLevel): string[] {
  return useToastStore
    .getState()
    .toasts.filter((t) => t.level === level)
    .map((t) => t.message)
}

beforeEach(() => {
  editor().reset()
  useEditorStore.temporal.getState().clear()
  useImportStore.setState({ pending: null })
  useToastStore.setState({ toasts: [] })
  useSettingsStore.getState().hydrate(defaultSettings())
})

describe('importStore.requestImport', () => {
  test('parses by content regardless of file extension', async () => {
    // Image routing happens in DropZone; any file reaching requestImport is
    // parsed as a .poly, so the extension no longer gates the import.
    await imports().requestImport(polyFile(TRIANGLE, 'mesh.txt'))
    expect(editor().points.length).toBe(3)
    expect(editor().lines.length).toBe(3)
    expect(imports().pending).toBeNull()
    expect(toastsOf('success')).toHaveLength(1)
  })

  test('reports a parse failure and leaves the document unchanged', async () => {
    await imports().requestImport(polyFile('not a poly file at all', 'broken.poly'))
    expect(editor().points.length).toBe(0)
    expect(imports().pending).toBeNull()
    expect(toastsOf('error')).toHaveLength(1)
    expect(toastsOf('error')[0]).toMatch(/^Import failed:/)
  })

  test('applies immediately when the editor is empty', async () => {
    await imports().requestImport(polyFile(TRIANGLE))
    expect(editor().points.length).toBe(3)
    expect(editor().lines.length).toBe(3)
    expect(imports().pending).toBeNull()
    expect(toastsOf('success')).toHaveLength(1)
    expect(toastsOf('success')[0]).toBe('Imported "mesh.poly".')
  })

  test('clears the undo history on apply', async () => {
    editor().addPoint(0, 0) // seeds an undo entry
    await imports().requestImport(polyFile(TRIANGLE))
    // editor was non-empty -> staged; confirm to apply.
    imports().confirm()
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(0)
  })

  test('stages a confirmation when the editor already has geometry', async () => {
    editor().addPoint(10, 10)
    await imports().requestImport(polyFile(TRIANGLE))
    // Not applied yet: still the single seeded point.
    expect(editor().points.length).toBe(1)
    expect(imports().pending).not.toBeNull()
    expect(imports().pending?.fileName).toBe('mesh.poly')
    expect(toastsOf('success')).toHaveLength(0)
  })

  test('confirm applies the staged import', async () => {
    editor().addPoint(10, 10)
    await imports().requestImport(polyFile(TRIANGLE))
    imports().confirm()
    expect(editor().points.length).toBe(3)
    expect(imports().pending).toBeNull()
    expect(toastsOf('success')).toHaveLength(1)
  })

  test('cancel discards the staged import and keeps current work', async () => {
    editor().addPoint(10, 10)
    await imports().requestImport(polyFile(TRIANGLE))
    imports().cancel()
    expect(editor().points.length).toBe(1)
    expect(imports().pending).toBeNull()
    expect(toastsOf('success')).toHaveLength(0)
  })

  test('caps warning toasts at 5 with a summary for the rest', async () => {
    await imports().requestImport(polyFile(TRIANGLE_WITH_STRAY_REGIONS))
    const warnings = toastsOf('warning')
    // 6 underlying warnings -> 5 shown + 1 summary line.
    expect(warnings).toHaveLength(6)
    expect(warnings[5]).toBe('1 more warning(s).')
  })
})
