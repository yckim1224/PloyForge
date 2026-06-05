import {
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Plus } from 'lucide-react'

export interface AddRowFieldOption {
  label: string
  value: number
}

export interface AddRowField {
  key: string
  placeholder: string
  type: 'number' | 'select'
  options?: AddRowFieldOption[]
  /** Parse the raw string. Return null when invalid. */
  parse: (raw: string) => number | null
  /** When true, empty input is rejected. Default false. */
  required?: boolean
}

export interface AddRowResult {
  ok: boolean
  error?: string
}

export interface AddRowProps {
  fields: AddRowField[]
  /**
   * Called when the user submits. Values are parsed; missing/blank inputs
   * surface as `null` so the caller can treat "no ID" as `index = null`.
   */
  onAdd: (values: Record<string, number | null>) => AddRowResult
}

const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs tabular-nums focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'

function defaultDraft(fields: AddRowField[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of fields) {
    if (f.type === 'select' && f.options && f.options.length > 0)
      out[f.key] = String(f.options[0].value)
    else out[f.key] = ''
  }
  return out
}

/** Inline "add new entity" row: input boxes + a `⊕` submit button. */
export function AddRow({ fields, onAdd }: AddRowProps) {
  const [draft, setDraft] = useState<Record<string, string>>(() => defaultDraft(fields))
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const values: Record<string, number | null> = {}
    for (const f of fields) {
      const raw = (draft[f.key] ?? '').trim()
      if (raw === '') {
        if (f.required) {
          setError(`Missing ${f.placeholder}`)
          return
        }
        values[f.key] = null
        continue
      }
      const parsed = f.parse(raw)
      if (parsed === null) {
        setError(`Invalid ${f.placeholder}`)
        return
      }
      values[f.key] = parsed
    }
    const res = onAdd(values)
    if (!res.ok) {
      setError(res.error ?? 'Could not add item')
      return
    }
    setError(null)
    setDraft(defaultDraft(fields))
  }

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Add"
          onClick={submit}
          className="flex size-7 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white text-violet-600 transition-colors hover:bg-violet-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-violet-950/30"
        >
          <Plus className="size-3.5" />
        </button>
        {fields.map((f) => (
          <div key={f.key} className="flex-1">
            {f.type === 'select' ? (
              <select
                value={draft[f.key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                onKeyDown={onKey}
                aria-label={f.placeholder}
                className={inputClass}
              >
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                inputMode="decimal"
                value={draft[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                onKeyDown={onKey}
                aria-label={f.placeholder}
                className={inputClass}
              />
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
