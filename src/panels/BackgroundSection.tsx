import { useRef } from 'react'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { Menu } from '../components/Menu'
import { NumberValue } from '../components/fields'
import { useEditorStore } from '../store/editorStore'

/**
 * Control-panel section for the translucent background reference image. The
 * image is added from the header `…` menu (or by dropping it on the canvas) and
 * positioned/scaled via the fields below. The checkbox lifts it above the
 * geometry so it can be dragged and resized directly on the canvas.
 */
export function BackgroundSection() {
  const background = useEditorStore((s) => s.background)
  const selected = useEditorStore((s) => s.backgroundSelected)
  const lockAspect = useEditorStore((s) => s.backgroundLockAspect)
  const fileRef = useRef<HTMLInputElement>(null)

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) useEditorStore.getState().loadBackgroundFromFile(file)
    // Reset so re-selecting the same file fires another change event.
    e.target.value = ''
  }

  const headerMenu = (
    <Menu
      align="right"
      trigger={
        <button
          type="button"
          aria-label="Background image actions"
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <MoreHorizontal className="size-4" />
        </button>
      }
      items={[
        {
          key: 'add',
          label: background ? 'Replace image…' : 'Add background image',
          onSelect: () => fileRef.current?.click(),
        },
      ]}
    />
  )

  return (
    <CollapsibleSection title="Background image" headerRight={headerMenu}>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />

      {!background ? (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          No background image. Use the ⋯ menu to add one.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="Select background image"
              checked={selected}
              onChange={(e) => useEditorStore.getState().setBackgroundSelected(e.target.checked)}
              className="size-3.5 shrink-0 accent-violet-600"
            />
            <button
              type="button"
              onClick={() => useEditorStore.getState().setBackgroundSelected(!selected)}
              className="flex-1 truncate text-left text-xs text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
              title={background.fileName}
            >
              {background.fileName}
            </button>
            <button
              type="button"
              aria-label="Remove background image"
              title="Remove background image"
              onClick={() => useEditorStore.getState().removeBackground()}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-800"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NumberValue
              label="X"
              value={background.x}
              onCommit={(v) => useEditorStore.getState().updateBackground({ x: v })}
            />
            <NumberValue
              label="Z"
              value={background.z}
              onCommit={(v) => useEditorStore.getState().updateBackground({ z: v })}
            />
            <NumberValue
              label="Scale X (m/px)"
              value={background.scaleX}
              onCommit={(v) => useEditorStore.getState().updateBackground({ scaleX: v })}
            />
            <NumberValue
              label="Scale Z (m/px)"
              value={background.scaleZ}
              onCommit={(v) => useEditorStore.getState().updateBackground({ scaleZ: v })}
            />
            <NumberValue
              label="Opacity (0–1)"
              value={background.opacity}
              step="0.05"
              onCommit={(v) => useEditorStore.getState().updateBackground({ opacity: v })}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-200">
            <input
              type="checkbox"
              checked={lockAspect}
              onChange={(e) => useEditorStore.getState().setBackgroundLockAspect(e.target.checked)}
              className="size-3.5 shrink-0 accent-violet-600"
            />
            Lock aspect ratio (resize)
          </label>
        </div>
      )}
    </CollapsibleSection>
  )
}
