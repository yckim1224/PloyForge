import { create } from 'zustand'
import { parsePoly, type ParseResult } from '../poly/parse'
import { hasGeometry, useEditorStore } from './editorStore'
import { toast } from './toastStore'

/** Cap on per-import warning toasts before the rest collapse into a summary. */
export const MAX_WARNING_TOASTS = 5

/** A parsed-but-not-yet-applied import awaiting the unsaved-work confirmation. */
interface PendingImport {
  fileName: string
  result: ParseResult
}

interface ImportState {
  pending: PendingImport | null
  /**
   * Validate, parse, then either apply immediately (empty editor) or stage a
   * confirmation (non-empty editor). All feedback is surfaced via toasts.
   */
  requestImport: (file: File) => Promise<void>
  /** Apply the staged import (user confirmed the overwrite). */
  confirm: () => void
  /** Discard the staged import (user kept their current work). */
  cancel: () => void
}

/**
 * Replace the document with a parsed result and report the outcome. File import
 * replaces everything, so the undo history is cleared -- undoing into a
 * half-imported state would surprise users.
 */
function applyImport(fileName: string, result: ParseResult): void {
  useEditorStore.getState().loadDocument(result.doc, result.discoveredMaterials)
  useEditorStore.temporal.getState().clear()
  toast.success(`Imported "${fileName}".`)
  const shown = result.warnings.slice(0, MAX_WARNING_TOASTS)
  for (const w of shown) toast.warning(w)
  const overflow = result.warnings.length - shown.length
  if (overflow > 0) toast.warning(`${overflow} more warning(s).`)
}

export const useImportStore = create<ImportState>((set, get) => ({
  pending: null,

  requestImport: async (file) => {
    // Image files are routed to the background before reaching here (DropZone);
    // anything that lands here is parsed as a .poly regardless of extension.
    let result: ParseResult
    try {
      result = parsePoly(await file.text())
    } catch (err) {
      toast.error(
        `Import failed: ${err instanceof Error ? err.message : 'Could not parse the .poly file.'}`,
      )
      return
    }
    // Only prompt once we have something valid to load; a wrong file never
    // reaches this point, so existing work is never put at risk needlessly.
    if (hasGeometry(useEditorStore.getState())) {
      set({ pending: { fileName: file.name, result } })
      return
    }
    applyImport(file.name, result)
  },

  confirm: () => {
    const pending = get().pending
    if (!pending) return
    applyImport(pending.fileName, pending.result)
    set({ pending: null })
  },

  cancel: () => set({ pending: null }),
}))
