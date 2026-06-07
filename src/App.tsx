import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { Hammer, Moon, Redo2, Sun, Undo2 } from 'lucide-react'
import { ResizableSplit } from './components/ResizableSplit'
import { ToastViewport } from './components/ToastViewport'
import { ConfirmModal } from './components/ConfirmModal'
import { DropZone } from './components/DropZone'
import { EditorStage } from './canvas/EditorStage'
import { ControlPanel } from './panels/ControlPanel'
import { hasGeometry, redoEdit, undoEdit, useEditorStore } from './store/editorStore'
import { useImportStore } from './store/importStore'
import {
  loadSettings,
  saveSettings,
  useSettingsStore,
  type AppSettings,
} from './store/settingsStore'
import {
  loadLayerVisibility,
  saveLayerVisibility,
  useLayerStore,
  type LayerVisibility,
} from './store/layerStore'
import { applyTheme, getTheme, type Theme } from './lib/theme'

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-8 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:disabled:text-neutral-600"
    >
      {children}
    </button>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getTheme())
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }
  return (
    <IconButton label="Toggle theme" onClick={toggle}>
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </IconButton>
  )
}

function AppBar() {
  const canUndo = useStore(useEditorStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useEditorStore.temporal, (s) => s.futureStates.length > 0)
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-900">
      <Hammer className="size-5 text-violet-600" />
      <h1 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
        poly-forge
      </h1>
      <span className="text-xs text-neutral-400">
        DES3D <code className="font-mono">.poly</code> editor
      </span>
      <div className="ml-auto flex items-center gap-1">
        <IconButton label="Undo (Cmd/Ctrl+Z)" onClick={undoEdit} disabled={!canUndo}>
          <Undo2 className="size-4" />
        </IconButton>
        <IconButton label="Redo (Cmd/Ctrl+Shift+Z)" onClick={redoEdit} disabled={!canRedo}>
          <Redo2 className="size-4" />
        </IconButton>
        <ThemeToggle />
      </div>
    </header>
  )
}

/**
 * Single overwrite-confirmation for the import flow, driven by importStore.
 * Both the Import button and the full-window DropZone funnel through the same
 * pending state, so this is the only place the prompt is rendered.
 */
function ImportConfirmModal() {
  const pending = useImportStore((s) => s.pending)
  const confirm = useImportStore((s) => s.confirm)
  const cancel = useImportStore((s) => s.cancel)
  return (
    <ConfirmModal
      open={pending !== null}
      title="Unsaved work"
      message={`Your current work is not saved. Importing "${pending?.fileName ?? ''}" will replace it. Continue?`}
      destructive
      confirmLabel="Import"
      onCancel={cancel}
      onConfirm={confirm}
    />
  )
}

function App() {
  // Apply the saved theme and hydrate persisted display preferences on first
  // mount. The DOCUMENT itself is intentionally NOT persisted -- a refresh
  // starts from an empty canvas; users are expected to Export to .poly to
  // keep work. Display settings (grid, palette, layout, layers, theme) still
  // persist so the editor feels stable across sessions.
  useEffect(() => {
    applyTheme(getTheme())

    // One-time sweep of pre-existing auto-saved documents (v1..v3 era). Safe
    // to call repeatedly -- removeItem on a missing key is a no-op.
    try {
      for (const key of [
        'poly-forge:doc:v3',
        'poly-forge:doc:v2',
        'poly-forge:doc:v1',
        'poly-forge:doc:v2.backup',
        'poly-forge:doc:v1.backup',
        'poly-forge:doc:v1.orphans',
      ]) {
        localStorage.removeItem(key)
      }
    } catch {
      /* storage unavailable (private mode); skip */
    }

    const persistedSettings = loadSettings()
    if (persistedSettings) useSettingsStore.getState().hydrate(persistedSettings)

    const persistedLayers = loadLayerVisibility()
    if (persistedLayers) useLayerStore.getState().hydrate(persistedLayers)

    const unsubSettings = useSettingsStore.subscribe((s, prev) => {
      if (
        s.grid !== prev.grid ||
        s.point !== prev.point ||
        s.line !== prev.line ||
        s.materials !== prev.materials
      ) {
        const snapshot: AppSettings = {
          grid: s.grid,
          point: s.point,
          line: s.line,
          materials: s.materials,
        }
        saveSettings(snapshot)
      }
    })

    // Browser-level confirm when leaving with unsaved geometry. Modern
    // browsers ignore the returned string and show their own copy ("Changes
    // you made may not be saved"); preventDefault + returnValue is the
    // canonical way to opt in.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasGeometry(useEditorStore.getState())) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    const unsubLayers = useLayerStore.subscribe((s, prev) => {
      if (
        s.grid !== prev.grid ||
        s.points !== prev.points ||
        s.lines !== prev.lines ||
        s.faces !== prev.faces
      ) {
        const snapshot: LayerVisibility = {
          grid: s.grid,
          points: s.points,
          lines: s.lines,
          faces: s.faces,
        }
        saveLayerVisibility(snapshot)
      }
    })

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      unsubSettings()
      unsubLayers()
    }
  }, [])

  return (
    <div className="flex h-full w-full flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <AppBar />
      <div className="min-h-0 flex-1">
        <ResizableSplit left={<ControlPanel />} right={<EditorStage />} />
      </div>
      <DropZone />
      <ImportConfirmModal />
      <ToastViewport />
    </div>
  )
}

export default App
