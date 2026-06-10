import { useRef } from 'react'
import { Button } from '@heroui/react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { NumberValue } from '../components/fields'
import { useEditorStore } from '../store/editorStore'

/**
 * Control-panel section for the translucent background reference image. The
 * image is added here (or by dropping it on the canvas) and positioned/scaled
 * via the fields below. Checking "Select" lifts it above the geometry so it can
 * be dragged and resized directly on the canvas.
 */
export function BackgroundSection() {
  const background = useEditorStore((s) => s.background)
  const selected = useEditorStore((s) => s.backgroundSelected)
  const fileRef = useRef<HTMLInputElement>(null)

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) useEditorStore.getState().loadBackgroundFromFile(file)
    // Reset so re-selecting the same file fires another change event.
    e.target.value = ''
  }

  return (
    <CollapsibleSection title="Background image">
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />

      {!background ? (
        <Button size="sm" variant="secondary" onPress={() => fileRef.current?.click()}>
          <ImagePlus className="size-4" />
          Add background image
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span
              className="flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300"
              title={background.fileName}
            >
              {background.fileName}
            </span>
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
              label="Scale (m/px)"
              value={background.scale}
              onCommit={(v) => useEditorStore.getState().updateBackground({ scale: v })}
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
              checked={selected}
              onChange={(e) => useEditorStore.getState().setBackgroundSelected(e.target.checked)}
              className="size-3.5 accent-violet-600"
            />
            Select (move / resize on canvas)
          </label>

          {selected && (
            <p className="text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
              Drag to move, corner handles to resize. Arrow keys nudge; Delete removes.
            </p>
          )}
        </div>
      )}
    </CollapsibleSection>
  )
}
