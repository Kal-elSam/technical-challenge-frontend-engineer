# 2D Level Editor Specification

This document translates the challenge brief and starter code into an implementation-ready plan for the `frontend/editor/` deliverable.

## Outcome

Build a Vue 3 level editor that can load, edit, validate, generate, and save Pac-Man-like levels using the existing FastAPI backend as the source of truth.

## Hard requirements from the brief

| Area | Requirement | Acceptance check |
|---|---|---|
| Working editor | Implement the editor in `frontend/editor/`. | `bun install && uv sync`, then backend + editor run from a clean clone. |
| Good UX | Controls, layout, interactions, and feedback must help the user design levels confidently. | The editor exposes clear tools, live save status, validation, and predictable drag/paint behavior. |
| Performance | Editing a `1000x1000` grid should feel responsive. | Rendering and editing avoid per-cell Vue components and avoid full-grid work on every pointer move. |
| Backend authority | Reloads/disconnects restore from backend without silent loss or double-applied edits. | Every save uses backend `version`; stale writes surface a conflict instead of overwriting. |
| Report | Add root `REPORT.md`, max two screens. | Explains decisions, read/unchanged code, and AI usage. |
| Constraints | No auth, multi-user, deployment, new framework/language/build system, or game mechanic changes. | Keep Vue, TypeScript, Bun, FastAPI, and existing engine mechanics. |

## Existing code facts

| Area | Finding |
|---|---|
| Game source of truth | `frontend/game/engine/` parses `ascii2d` and runs mechanics. |
| Wire format | Each cell is a 2-character token: wall `##`, empty `  `, pellet `. `, power pellet `O `, player `P<dir>`, ghost `G<dir>`. |
| Existing serializer gap | `frontend/game/engine/ascii2d.ts` currently serializes walls only; the editor needs full token serialization. |
| Backend API | `GET /level/load`, `POST /level/store`, `POST /level/generate`, `GET /levels`. |
| Conflict model | Updates require `base_version`; stale writes return HTTP `409`. This is the right authority contract. |
| Persistence gap | `backend/server/storage.py` is in-memory and has a TODO for durable persistence. |
| Editor scaffold | `frontend/editor/` is empty except `.gitkeep`. |
| Repository state | The working folder is not currently initialized as a git repository. |

## Product spec

### Primary user flow

1. Open the editor.
2. Load the `classic` level by default or choose another backend level.
3. Paint cells with a selected tool.
4. See validation and save status while editing.
5. Save automatically after stable edits and immediately after finishing a stroke.
6. Reload the browser and recover the latest accepted backend version.

### Editor tools

| Tool | Behavior |
|---|---|
| Empty | Clears a cell. |
| Wall | Paints `##`. |
| Pellet | Paints `. `. |
| Power pellet | Paints `O `. |
| Player spawn | Paints `P<dir>` using selected direction. |
| Ghost spawn | Paints `G<dir>` using selected direction. |
| Pan/zoom | Supports large maps without forcing the user to scroll a huge DOM. |

### Recommended UX details

- Tool palette with keyboard shortcuts.
- Direction selector for player/ghost spawns.
- Visible level id, backend version, grid size, dirty/saving/saved/conflict state.
- Validation panel with actionable warnings:
  - no player spawn
  - no pellets/power pellets
  - no ghosts
  - parser/serialization errors
- Generate controls for `seed` and `size`.
- Conflict banner on `409` with "reload authoritative version" action.
- `beforeunload` warning when unsaved edits exist.

## Technical spec

### Frontend structure

```text
frontend/editor/
  App.vue
  main.ts
  index.html
  serve.ts
  styles.css
  api.ts
  level-model.ts
  renderer.ts
```

### Data model

Use a compact editor-owned grid model, not Vue components per cell.

```ts
type CellKind = 0 | 1 | 2 | 3 | 4 | 5;

type LevelDocument = {
  id: string | null;
  version: number | null;
  width: number;
  height: number;
  cells: Uint8Array;
  directions: Uint8Array;
};
```

Rationale:

- `1000x1000` is 1,000,000 cells; object-per-cell or component-per-cell is the wrong foundation.
- `Uint8Array` keeps the hot path memory-small and predictable.
- Vue should track document metadata and UI state, not every individual cell.

### Rendering

- Use a single `<canvas>`.
- Compute visible cell bounds from pan/zoom and canvas size.
- Draw only visible cells.
- Mark dirty rectangles during paint strokes.
- For low zoom levels, render via an `ImageData`/color-buffer path instead of issuing one canvas command per cell.

### Editing

- Pointer drag paints strokes.
- Interpolate missed cells between pointer events so fast drags do not leave holes.
- Deduplicate touched cells inside one stroke.
- Update the model synchronously, repaint dirty region, then schedule persistence.

### Serialization

- Reuse the existing `fromAscii2d` parser.
- Extend or replace `toAscii2d` so every supported cell token round-trips:
  - empty
  - wall
  - pellet
  - power pellet
  - player spawn with direction
  - ghost spawn with direction

### Backend sync

State machine:

```text
loading -> clean
clean -> dirty -> saving -> clean
dirty/saving -> conflict
dirty/saving -> error
```

Rules:

- Load always comes from backend.
- Save sends the full `ascii2d` document and the last accepted backend `version`.
- On success, replace local `id/version` with the response.
- On `409`, stop autosave and show a conflict; do not overwrite silently.
- On network error, keep dirty state and retry only when the user can see the status.
- New/generated levels should be stored immediately to receive a backend id before editing.

### Backend persistence decision

The minimum frontend requirement can work with the existing in-memory backend while the process stays alive. However, the code itself documents that process restarts lose all non-classic levels. If time allows, add a small JSON-file-backed store under a local data path while preserving the existing `id + version + ascii2d` contract.

Tradeoff:

- File persistence improves trust and aligns with "no silent loss of work".
- It is backend scope, so keep it minimal and do not introduce a database.

## Implementation tasks

### P0 — required

- [ ] Add editor Bun entrypoints and `package.json` script.
- [ ] Build an editor grid model based on compact arrays.
- [ ] Implement `ascii2d` parse/serialize round-trip for all token kinds.
- [ ] Implement canvas viewport rendering with pan/zoom.
- [ ] Implement paint tools and direction-aware spawns.
- [ ] Implement API client for load/list/store/generate.
- [ ] Implement versioned autosave and conflict handling.
- [ ] Add validation/status UI.
- [ ] Add `REPORT.md`.
- [ ] Initialize git before submission.

### P1 — strong signal

- [ ] Add backend file persistence while preserving the version/conflict API.
- [ ] Add focused tests for serialization and backend conflict behavior.
- [ ] Add a preview/open-in-game path if it can be done without changing mechanics.

### P2 — only if time remains

- [ ] Minimap.
- [ ] Undo/redo.
- [ ] Brush size.
- [ ] Rectangle/fill tools.

## Out of scope

- Authentication.
- Multi-user collaboration.
- Deployment.
- Changing game movement, collisions, ghost AI, or power-up mechanics.
- Replacing Vue/Bun/FastAPI with another stack.

## Report notes to capture while implementing

- The most important human decisions are data model, rendering strategy, and sync semantics.
- Be explicit that AI can draft boilerplate but should not decide the architecture blindly.
- Mention code that was read and intentionally left unchanged: engine movement/collision/ghost behavior unless the implementation proves a serializer-only change is needed.
