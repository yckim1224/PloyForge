import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface CollapsibleSectionProps {
  /** Section heading; also used as the persistence slot key. */
  title: string
  /** Optional count rendered after the title (e.g. "Points (10)"). */
  count?: number
  /** Optional right-aligned slot (e.g. a "…" menu trigger). */
  headerRight?: ReactNode
  /** Initial open state when no persisted preference exists (default true). */
  defaultOpen?: boolean
  children: ReactNode
}

const STORAGE_KEY = 'poly-forge:sections:v1'

type SectionState = Record<string, boolean>

function readPersistedState(): SectionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: SectionState = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean') result[k] = v
    }
    return result
  } catch {
    return {}
  }
}

function writePersistedState(next: SectionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* storage may be unavailable (private mode, quota); ignore */
  }
}

/**
 * Generic collapsible card matching the existing Section header style
 * (border-b, dense padding). Open/closed state persists per-title to
 * localStorage under `poly-forge:sections:v1`.
 */
export function CollapsibleSection({
  title,
  count,
  headerRight,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState<boolean>(() => {
    const persisted = readPersistedState()
    return title in persisted ? persisted[title] : defaultOpen
  })

  // Persist per-title; merge so other sections' slots are preserved.
  useEffect(() => {
    const current = readPersistedState()
    if (current[title] === open) return
    writePersistedState({ ...current, [title]: open })
  }, [title, open])

  const toggle = useCallback(() => setOpen((v) => !v), [])
  const bodyId = `section-body-${title.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <section className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center gap-1 px-4 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex flex-1 items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-700 focus:outline-none dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
          <h2 className="m-0 text-xs font-semibold uppercase tracking-wide">
            {title}
            {typeof count === 'number' && (
              <span className="ml-1 text-neutral-400 dark:text-neutral-500">({count})</span>
            )}
          </h2>
        </button>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>
      <div
        id={bodyId}
        aria-hidden={!open}
        className={open ? 'px-4 pb-3' : 'hidden'}
      >
        {children}
      </div>
    </section>
  )
}
