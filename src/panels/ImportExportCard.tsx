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
  const fileRef = useRef<HTMLInputElement>(null)
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const onExport = () => {
    const text = serializePoly(toDocument())
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
      await navigator.clipboard.writeText(serializePoly(toDocument()))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  }

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const result = parsePoly(text)
    loadDocument(result.doc)
    setWarnings(result.warnings)
    setIssues(null)
    e.target.value = ''
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
