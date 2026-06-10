import { useEffect, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useImportStore } from '../store/importStore'
import { useEditorStore } from '../store/editorStore'
import { toast } from '../store/toastStore'
import { isImageFile } from '../lib/imageFile'

/** True when a drag carries OS files (vs. in-app element/text drags). */
function isFileDrag(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes('Files') ?? false
}

/**
 * Full-window drop target for `.poly` import. Listens at the `window` level so
 * a file dropped anywhere in the app is imported, and renders a translucent
 * overlay only while a file is being dragged.
 *
 * Two safety points:
 *   - `dragover`/`drop` always `preventDefault()`, otherwise the browser
 *     navigates to / opens the dropped file and the editor state is lost.
 *   - Every handler gates on {@link isFileDrag} so in-app drags (e.g. table
 *     row reordering, text selection) pass through untouched.
 */
export function DropZone() {
  const requestImport = useImportStore((s) => s.requestImport)
  const [active, setActive] = useState(false)
  // dragenter/dragleave fire for every child boundary crossing; a depth
  // counter keeps the overlay steady instead of flickering.
  const depth = useRef(0)

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      depth.current += 1
      setActive(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setActive(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      depth.current = 0
      setActive(false)
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      if (files.length > 1) {
        toast.error('Only one file can be dropped at a time.')
        return
      }
      const file = files[0]
      // Images become the background reference; everything else is parsed as .poly.
      if (isImageFile(file)) useEditorStore.getState().loadBackgroundFromFile(file)
      else void requestImport(file)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [requestImport])

  if (!active) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-violet-500/10 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-violet-400 bg-white/90 px-8 py-6 text-center shadow-lg dark:bg-neutral-900/90">
        <Upload className="size-6 text-violet-500" />
        <p className="text-sm font-medium text-violet-700 dark:text-violet-300">
          Drop a <code className="font-mono">.poly</code> file or an image to import
        </p>
      </div>
    </div>
  )
}
