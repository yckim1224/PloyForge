import { useRef, useState } from 'react'
import { Button } from '@heroui/react'
import {
  CircleCheck,
  Copy,
  Download,
  ShieldCheck,
  TriangleAlert,
  Upload,
  CircleX,
} from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import { serializePoly } from '../poly/serialize'
import { parsePoly } from '../poly/parse'
import { validateDocument, type ValidationIssue } from '../poly/validate'

export function ImportExportCard() {
  const toDocument = useEditorStore((s) => s.toDocument)
  const loadDocument = useEditorStore((s) => s.loadDocument)
  const nFaces = useEditorStore((s) => s.faces.length)
  const fileRef = useRef<HTMLInputElement>(null)
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [importError, setImportError] = useState<string | null>(null)
  const [exportWarning, setExportWarning] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const onExport = () => {
    const { text, untypedFaceCount } = serializePoly(toDocument())
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

  const onCopy = async () => {
    try {
      const { text, untypedFaceCount } = serializePoly(toDocument())
      if (untypedFaceCount > 0) {
        setExportWarning(
          `${untypedFaceCount} face(s) have no Type assigned (defaulted to mattype 0).`,
        )
      } else {
        setExportWarning(null)
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  }

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const result = parsePoly(text)
      loadDocument(result.doc, result.discoveredMaterials)
      // File import replaces the entire document; undoing into a half-imported
      // state would surprise users, so it sits outside the undo history.
      useEditorStore.temporal.getState().clear()
      setWarnings(result.warnings)
      setImportError(null)
      setIssues(null)
      setExportWarning(null)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not parse the .poly file.')
      setWarnings([])
    } finally {
      // Always reset so re-selecting the same file fires another change event.
      e.target.value = ''
    }
  }

  const onValidate = () => setIssues(validateDocument(toDocument()))

  const errorCount = issues?.filter((i) => i.level === 'error').length ?? 0

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="primary" onPress={onExport}>
          <Download className="size-4" />
          Export .poly
        </Button>
        <Button size="sm" variant="secondary" onPress={() => fileRef.current?.click()}>
          <Upload className="size-4" />
          Import .poly
        </Button>
        <Button size="sm" variant="secondary" onPress={onCopy}>
          <Copy className="size-4" />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Button size="sm" variant="secondary" onPress={onValidate}>
          <ShieldCheck className="size-4" />
          Validate
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".poly,.smesh,text/plain"
        onChange={onImportFile}
        className="hidden"
      />

      {importError && (
        <p className="flex items-start gap-1.5 rounded-md bg-red-50 p-2 text-xs text-red-700">
          <CircleX className="mt-0.5 size-3.5 shrink-0" />
          Import failed: {importError}
        </p>
      )}

      {nFaces === 0 && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          No closed face detected. DES3D requires at least one region — draw a closed loop of
          segments so a face is detected.
        </p>
      )}

      {exportWarning && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {exportWarning}
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      {issues && (
        <div className="flex flex-col gap-1 text-xs">
          {issues.length === 0 ? (
            <p className="flex items-center gap-1.5 rounded-md bg-emerald-50 p-2 text-emerald-700">
              <CircleCheck className="size-4" />
              No issues found.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
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
      )}
    </div>
  )
}
