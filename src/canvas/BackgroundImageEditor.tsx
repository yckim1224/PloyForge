import { useEffect, useRef } from 'react'
import { Image as KonvaImage, Layer, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { BackgroundImage } from '../types'
import { screenToWorld, worldToScreen, type Viewport } from './viewport'
import {
  nodeRectToWorld,
  resolveBoundBox,
  resolveResize,
  snapScreenPointToGrid,
} from './imageTransform'

interface BackgroundImageEditorProps {
  background: BackgroundImage
  vp: Viewport
  gridSpacing: number
  /** When true, resize keeps the image's aspect ratio (corner handles only). */
  lockAspect: boolean
  /** Live patches the editor store; called on drag end and resize end. */
  onChange: (patch: Partial<BackgroundImage>) => void
  /**
   * Fires after every drag/transform commit so the parent can suppress the
   * trailing click event (which would otherwise reset selection).
   */
  onGestureEnd: () => void
}

/**
 * Top-layer editor for the background reference image: draggable to move,
 * Transformer handles to resize. Owns its Konva refs, its Alt-modifier tracker,
 * and its Transformer attachment effect -- the parent only mounts/unmounts it
 * via the bgEditMode gate.
 */
export function BackgroundImageEditor({
  background,
  vp,
  gridSpacing,
  lockAspect,
  onChange,
  onGestureEnd,
}: BackgroundImageEditorProps) {
  const imageRef = useRef<Konva.Image | null>(null)
  const transformerRef = useRef<Konva.Transformer | null>(null)
  const activeAnchorRef = useRef<string | null>(null)
  // Tracks Alt for grid-snap bypass. Konva's bound funcs carry no React event,
  // so the global keyboard listener below is the baseline; dragMove/anchor sync
  // keeps it exact per frame when an event *is* available (a Windows Alt press
  // can blur the window and stale the keyboard tracker).
  const altDownRef = useRef(false)

  const syncAltFromEvent = (ev: { altKey: boolean }) => {
    altDownRef.current = ev.altKey
  }

  // Attach the Transformer to the image, and re-measure when the viewport or
  // image geometry changes so the resize handles track the rendered rect.
  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return
    if (imageRef.current) {
      tr.nodes([imageRef.current])
      tr.forceUpdate()
    }
    tr.getLayer()?.batchDraw()
  }, [background, vp])

  // Global Alt tracker so the snap-bypass keeps working without a live event.
  useEffect(() => {
    const onAlt = (e: KeyboardEvent) => {
      altDownRef.current = e.altKey
    }
    const onBlur = () => {
      altDownRef.current = false
    }
    window.addEventListener('keydown', onAlt)
    window.addEventListener('keyup', onAlt)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onAlt)
      window.removeEventListener('keyup', onAlt)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const bgScreen = worldToScreen(vp, background.x, background.z)

  return (
    <Layer>
      <KonvaImage
        ref={imageRef}
        name="background"
        image={background.img}
        x={bgScreen.sx}
        y={bgScreen.sy}
        width={background.naturalWidth * background.scaleX * vp.scale}
        height={background.naturalHeight * background.scaleZ * vp.scale}
        opacity={background.opacity}
        draggable
        dragBoundFunc={(pos) => {
          // Snap the top-left to the grid while dragging; Alt frees it.
          if (altDownRef.current || !(gridSpacing > 0)) return pos
          return snapScreenPointToGrid(vp, pos, gridSpacing)
        }}
        onDragMove={(e) => syncAltFromEvent(e.evt)}
        onDragEnd={(e) => {
          const { x, z } = nodeRectToWorld(
            { x: e.target.x(), y: e.target.y(), scaleX: 1, scaleY: 1 },
            vp,
            background.scaleX,
            background.scaleZ,
          )
          onGestureEnd()
          onChange({ x, z })
        }}
        onTransformStart={() => {
          activeAnchorRef.current = transformerRef.current?.getActiveAnchor() ?? null
        }}
        onTransformEnd={(e) => {
          const node = e.target
          const raw = nodeRectToWorld(
            { x: node.x(), y: node.y(), scaleX: node.scaleX(), scaleY: node.scaleY() },
            vp,
            background.scaleX,
            background.scaleZ,
          )
          // Reset the node scale: the derived render reproduces the new size
          // from scaleX/scaleZ, so leaving it on would double-apply.
          node.scaleX(1)
          node.scaleY(1)
          onGestureEnd()
          const dims = {
            naturalWidth: background.naturalWidth,
            naturalHeight: background.naturalHeight,
          }
          onChange(
            resolveResize(
              {
                x: background.x,
                z: background.z,
                scaleX: background.scaleX,
                scaleZ: background.scaleZ,
                ...dims,
              },
              { x: raw.x, z: raw.z, scaleX: raw.scaleX, scaleZ: raw.scaleZ, ...dims },
              activeAnchorRef.current,
              gridSpacing,
              altDownRef.current,
              lockAspect,
            ),
          )
        }}
      />
      <Transformer
        ref={transformerRef}
        rotateEnabled={false}
        keepRatio={lockAspect}
        enabledAnchors={
          lockAspect
            ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
            : [
                'top-left',
                'top-center',
                'top-right',
                'middle-left',
                'middle-right',
                'bottom-left',
                'bottom-center',
                'bottom-right',
              ]
        }
        anchorDragBoundFunc={(_oldPos, newPos, e) => {
          // Sync Alt from Konva's mouse event every frame, before boundBoxFunc
          // reads it (keyboard tracking can go stale on a Windows Alt blur).
          if (e) syncAltFromEvent(e)
          // Live grid snap for unlocked resize handles, mirroring the move
          // dragBoundFunc. Locked snaps in boundBoxFunc (keepRatio re-projects
          // the corner, defeating anchor snapping); Alt bypasses snap and is
          // re-anchored in boundBoxFunc.
          if (lockAspect || altDownRef.current || !(gridSpacing > 0)) {
            return newPos
          }
          return snapScreenPointToGrid(vp, newPos, gridSpacing)
        }}
        boundBoxFunc={(oldBox, newBox) => {
          if (newBox.width < 8 || newBox.height < 8) return oldBox
          if (!(gridSpacing > 0)) return newBox
          const dims = {
            naturalWidth: background.naturalWidth,
            naturalHeight: background.naturalHeight,
          }
          const prev = {
            x: background.x,
            z: background.z,
            scaleX: background.scaleX,
            scaleZ: background.scaleZ,
            ...dims,
          }
          // Convert Konva's screen box to world: the top-left plus the far
          // extents give the per-axis box scales (the *centered* scales when
          // Alt is held).
          const tl = screenToWorld(vp, newBox.x, newBox.y)
          const right = screenToWorld(vp, newBox.x + newBox.width, newBox.y).x
          const bottom = screenToWorld(vp, newBox.x, newBox.y + newBox.height).z
          const resolved = resolveBoundBox(
            prev,
            {
              left: tl.x,
              top: tl.z,
              scaleX: (right - tl.x) / dims.naturalWidth,
              scaleZ: (tl.z - bottom) / dims.naturalHeight,
            },
            activeAnchorRef.current,
            gridSpacing,
            altDownRef.current,
            lockAspect,
          )
          if (!resolved) return newBox // unlocked path already snapped live
          const s = worldToScreen(vp, resolved.x, resolved.z)
          return {
            x: s.sx,
            y: s.sy,
            width: dims.naturalWidth * resolved.scaleX * vp.scale,
            height: dims.naturalHeight * resolved.scaleZ * vp.scale,
            rotation: 0,
          }
        }}
      />
    </Layer>
  )
}
