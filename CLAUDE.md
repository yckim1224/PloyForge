# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**poly-forge** is a browser-based editor for DynEarthSol3D (DES3D) 2D `.poly` (PSLG)
mesh-input files. The user draws **Points** and **Lines**; the app derives **Faces**
(closed regions) and lets the user assign each face a **Type** (`mattype` + element
`size`). Stack: React 19 + TypeScript + Vite, Konva (`react-konva`) for the canvas,
Zustand + zundo for state, Tailwind 4 + HeroUI + lucide-react for UI.

Read `docs/concepts.md` (Korean) for the domain model and the exact `.poly` mapping —
it is the authoritative spec for Point/Line/Face/Type and the file format.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build (type-check is part of the build)
npm run lint         # eslint
npm test             # vitest run (one-shot)
npm run test:watch   # vitest watch
```

Run a single test file or name:
```bash
npx vitest run src/store/editorStore.test.ts
npx vitest run -t "renode splits at T-junction"
```

Tests use vitest + jsdom (`globals: true`), live next to their subject as
`*.test.ts(x)`, and run through `vitest.config.ts` — kept separate from
`vite.config.ts` so the Tailwind plugin does not run during tests.

## Core architecture

### Domain model (`src/types.ts`)
- Coordinate convention: **x horizontal, z depth (z ≤ 0, increasing downward)**, meters.
- `Point` / `Line` are stored. `Line.bdryFlag` is a **single bit** (2D: 0 internal,
  1 left/X0, 2 right/X1, 16 bottom/Z0, 32 top/Z1).
- `Face` is **derived, never stored**. `PolyDocument` = `{ points, lines, faceTypes }`.

### Faces are computed, Types are face-keyed (`src/poly/faces.ts`, `editorStore`)
- `detectFaces()` runs `@turf/polygonize` over the line graph on every geometry change.
- Each face gets a **deterministic id** `face:${sorted-pointIds}`. Because the id is
  derived from its vertex set, a face's Type survives recomputation, translation, and
  **resurrects after undo** when the same face reforms.
- `faceTypes: Record<faceId, {mattype, size}>` is the only Type storage. Stale entries
  (faceId not currently detected) are **intentionally kept** for resurrection — do not
  prune them on face loss.

### PSLG conformity: always renode after geometry edits (`editorStore.renode`)
polygonize only sees regions if the graph is a conforming PSLG. `renode()`:
- **Phase A** inserts a point at every proper segment–segment crossing.
- **Phase B** does T-junction noding: splits any segment that has a point on its interior.

The standard mutation pattern (followed by `addPoint`/`addLine`/`movePoint`/
`translateSelectionBy`/etc.) is: mutate → `renode()` → `recomputeFaces()`. **New
geometry mutations must follow this same pattern**, or faces silently fail to detect.

### State: stores under `src/store/`
- **`editorStore`** (wrapped in zundo `temporal`) — the document + derived `faces` +
  transient `selection`/`tool`/`pendingLineStart`. Only `points`/`lines`/`faceTypes`
  are undoable (`partialize`). `undoEdit`/`redoEdit` are exported wrappers that also
  `recomputeFaces()` + `clearSelection()`. **Undo batching:** `handleSet` collapses all
  `set()` calls in one synchronous burst into a single undo step via `queueMicrotask`,
  so a compound action (e.g. `addLineByCoords` → two `addPoint`s + `addLine`) = one
  undo. Keep multi-step actions synchronous so they batch correctly.
- **`settingsStore`** — display prefs: grid, point style, per-flag line styles, and the
  `materials` color/label palette. Persisted to `localStorage` `poly-forge:settings:v1`.
- **`layerStore`** — layer visibility (grid = on/off; points/lines/faces = tri-state
  off/on/labeled). Persisted to `poly-forge:layers:v1`.
- **`importStore`** — import flow; gates an overwrite confirm when `hasGeometry()` is true.
- **`toastStore`** — toast notifications.

### Persistence philosophy (important)
The **document is deliberately NOT persisted**. A page refresh starts on an empty
canvas; the user keeps work by **Export → `.poly`**. Only display settings, layer
visibility, and theme persist. `hasGeometry(state)` is the single source of "unsaved
work" truth — used by the `beforeunload` guard and the import overwrite prompt. `App.tsx`
also sweeps away old `poly-forge:doc:*` localStorage keys from a previous auto-save era.

### `.poly` I/O (`src/poly/`)
- `parse.ts` — tolerant parser (comments, inline `#`, blank lines, sci-notation). Maps
  each `region` record onto a detected face via point-in-polygon → `faceTypes`. Reports
  `warnings` and `discoveredMaterials` (to hydrate the palette).
- `serialize.ts` — emits exactly **one region line per detected face**
  (`interiorPoint` seed); untyped faces fall back to `mattype 0` and are counted in
  `untypedFaceCount`. Holes are always `0` (DES3D requirement).
- `boundary.ts` — `autoBoundaryFlag` from the points' bounding box.
- `validate.ts` — `validateDocument` returns `error`/`warning` issues; **export aborts
  on any error** (see `AppActions.onExport`).

### Canvas (`src/canvas/`)
`EditorStage.tsx` is the large interactive Konva stage (tools select/point/line/pan,
marquee select, drag, keyboard shortcuts, HUD). It composes pure, unit-tested helpers:
`viewport.ts` (pan/zoom/fit/screen↔world), `grid.ts`, `snapping.ts`, `selection.ts`
(rect hit-testing), `drag.ts`. Point-placement snap priority is **existing vertex →
projection onto an edge → grid intersection** (the edge-snap is what lets a new point
land on a slanted boundary and split a face).

### UI shell
`App.tsx` → `AppBar` (undo/redo/theme) + `ResizableSplit(ControlPanel | EditorStage)`
+ `DropZone` + modals + `ToastViewport`. `ControlPanel` (`src/panels/`) stacks
`AppActions` (import/export/validate/settings/clear) and the `PointsSection` /
`LinesSection` / `FacesSection` tables. Cross-cutting keyboard actions are wired via
**nonce bumps** on the store: `requestFit`→`fitNonce`, `requestExport`→`exportNonce`
(Cmd/Ctrl+S routes through the same export path as the button).

## Conventions
- **Source code is English-only** (identifiers, comments, messages); prose docs under
  `docs/` are Korean.
- Faces/Types: never store or serialize a `Face`; assign Types through `faceTypes` keyed
  by the deterministic `face:${sorted-pointIds}` id.
- Coordinate sign convention (z ≤ 0 downward) is load-bearing for boundary flags,
  fitting, and HUD — keep it consistent in any geometry code.
