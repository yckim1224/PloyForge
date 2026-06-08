import { useEffect, useRef, useState } from 'react'
import { Button } from '@heroui/react'
import {
  CircleCheck,
  CircleX,
  Download,
  Eraser,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import { useImportStore } from '../store/importStore'
import { toast } from '../store/toastStore'
import { serializePoly } from '../poly/serialize'
import { validateDocument, type ValidationIssue } from '../poly/validate'
import { ConfirmModal } from '../components/ConfirmModal'
import { SettingsModal } from './SettingsModal'

export function AppActions() {
  const toDocument = useEditorStore((s) => s.toDocument)
  const requestImport = useImportStore((s) => s.requestImport)
  const fileRef = useRef<HTMLInputElement>(null)
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null)
  const [exportWarning, setExportWarning] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const onImportClick = () => fileRef.current?.click()

  // Both this button and the full-window DropZone route through importStore so
  // the unsaved-work guard and toast feedback stay identical across entry points.
  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void requestImport(file)
    // Reset so re-selecting the same file fires another change event.
    e.target.value = ''
  }

  const onExport = () => {
    // Validation folds into the export flow: errors abort, warnings inform.
    const doc = toDocument()
    const found = validateDocument(doc)
    const errors = found.filter((i) => i.level === 'error')
    if (errors.length > 0) {
      setIssues(found)
      setExportWarning(`Fix ${errors.length} error(s) before exporting.`)
      // Surface a toast too: the keyboard Save shortcut may run with the Actions
      // panel collapsed, where the inline message would be hidden.
      toast.error(`Fix ${errors.length} error(s) before exporting.`)
      return
    }
    setIssues(found.length > 0 ? found : null)
    const { text, untypedFaceCount } = serializePoly(doc)
    if (untypedFaceCount > 0) {
      setExportWarning(
        `${untypedFaceCount} face(s) have no Type assigned (defaulted to mattype 0).`,
      )
    } else {
      setExportWarning(null)
    }
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mesh.poly'
    a.click()
    URL.revokeObjectURL(url)
  }

  // The keyboard Save shortcut (Cmd/Ctrl+S) bumps exportNonce; run the same
  // export path. Keep the latest onExport in a ref (updated in an effect, not
  // during render) and subscribe to exportNonce changes just once.
  const onExportRef = useRef(onExport)
  useEffect(() => {
    onExportRef.current = onExport
  })
  useEffect(
    () =>
      useEditorStore.subscribe((s, prev) => {
        if (s.exportNonce !== prev.exportNonce) onExportRef.current()
      }),
    [],
  )

  const onValidate = () => {
    setIssues(validateDocument(toDocument()))
    setExportWarning(null)
  }

  const onSettings = () => setSettingsOpen(true)

  const onClear = () => setConfirmClear(true)

  const doClear = () => {
    useEditorStore.getState().reset()
    useEditorStore.temporal.getState().clear()
    setIssues(null)
    setExportWarning(null)
    setConfirmClear(false)
  }

  const errorCount = issues?.filter((i) => i.level === 'error').length ?? 0

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" onPress={onImportClick}>
          <Upload className="size-4" />
          Import .poly
        </Button>
        <Button size="sm" variant="secondary" onPress={onSettings}>
          <Settings2 className="size-4" />
          Settings
        </Button>
        <Button size="sm" variant="secondary" onPress={onExport}>
          <Download className="size-4" />
          Export .poly
        </Button>
        <Button size="sm" variant="secondary" onPress={onValidate}>
          <ShieldCheck className="size-4" />
          Validate
        </Button>
        <Button size="sm" variant="secondary" onPress={onClear}>
          <Eraser className="size-4" />
          Clear
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".poly,.smesh,text/plain"
        onChange={onImportFile}
        className="hidden"
      />

      {exportWarning && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {exportWarning}
        </p>
      )}

      <ConfirmModal
        open={confirmClear}
        title="Clear document"
        message="Clear the current document? This cannot be undone."
        destructive
        confirmLabel="Clear"
        onCancel={() => setConfirmClear(false)}
        onConfirm={doClear}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {issues && issues.length === 0 && (
        <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 p-2 text-xs text-emerald-700">
          <CircleCheck className="size-4 shrink-0" />
          <span className="flex-1">No issues found.</span>
          <button
            type="button"
            aria-label="Dismiss validation result"
            onClick={() => setIssues(null)}
            className="-m-1 rounded p-1 text-emerald-700/70 transition-colors hover:bg-emerald-100 hover:text-emerald-800"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {issues && issues.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs">
          <li className="font-medium text-neutral-600">
            {errorCount} error(s), {issues.length - errorCount} warning(s)
          </li>
          {issues.map((it, i) => (
            <li
              key={i}
              className={`flex items-start gap-1.5 rounded-md p-1.5 ${
                it.level === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {it.level === 'error' ? (
                <CircleX className="mt-0.5 size-3.5 shrink-0" />
              ) : (
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              )}
              {it.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
