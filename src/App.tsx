import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { Hammer, Moon, Redo2, Sun, Undo2 } from 'lucide-react'
import { ResizableSplit } from './components/ResizableSplit'
import { ToastViewport } from './components/ToastViewport'
import { EditorStage } from './canvas/EditorStage'
import { ControlPanel } from './panels/ControlPanel'
import { redoEdit, undoEdit, useEditorStore } from './store/editorStore'
import { loadPersisted, savePersisted } from './lib/persistence'
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

function App() {
  // Apply the saved theme and hydrate persisted geometry/settings on first mount.
  useEffect(() => {
    applyTheme(getTheme())

    const persistedSettings = loadSettings()
    if (persistedSettings) useSettingsStore.getState().hydrate(persistedSettings)

    const persistedLayers = loadLayerVisibility()
    if (persistedLayers) useLayerStore.getState().hydrate(persistedLayers)

    // Register the settings subscriber BEFORE loadPersisted so the
    // migration-driven setGrid (v2->v3 grid spacing lift) is captured and
    // saved back to localStorage; otherwise the migrated spacing would
    // silently vanish on the next reload.
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

    const doc = loadPersisted({ settingsHydrated: persistedSettings !== null })
    if (doc) {
      useEditorStore.getState().loadDocument(doc)
      useEditorStore.temporal.getState().clear()
    }

    const unsubDoc = useEditorStore.subscribe((s, prev) => {
      if (
        s.points !== prev.points ||
        s.lines !== prev.lines ||
        s.faceTypes !== prev.faceTypes
      ) {
        savePersisted({
          points: s.points,
          lines: s.lines,
          faceTypes: s.faceTypes,
        })
      }
    })

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
      unsubDoc()
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
      <ToastViewport />
    </div>
  )
}

export default App
