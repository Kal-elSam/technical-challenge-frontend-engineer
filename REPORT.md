# REPORT — 2D Level Editor

## What was built

`frontend/editor/` — a Vue 3 + TypeScript + Bun level editor for Maze Chase
levels, backed by the existing FastAPI service. Run with `bun run editor`
(needs `uv run backend` running too). **Play** opens `bun run game` with the
saved level id (`?level=...`).

## Technical decisions

- **Own compact model, not the engine's `Board`.** `level-model.ts` stores
  `cells: Uint8Array` + `directions: Uint8Array` instead of Vue components or
  the engine's per-cell object array. At 1000×1000 that's 2MB of flat memory
  instead of 1M reactive objects — mutating a cell during a drag is a single
  array write, not a Vue reactivity trip.
- **The document is a `shallowRef`, not `reactive`.** Vue would otherwise
  proxy every property access on the hot paint/render path. Cell mutations
  happen in place on plain objects; `sync.notifyChanged()` (`triggerRef`)
  is called once per stroke — not per cell — to refresh the few things that
  actually need to react (validation panel, status bar).
- **Own serializer, engine untouched.** The engine's `toAscii2d` only
  serializes walls (see "What was NOT changed" below). Rather than patch a
  shared file, the editor has its own `parseAscii2d`/`serializeToAscii2d`
  that round-trips all six tokens and feeds `fromAscii2d` unmodified — the
  engine still owns what "playable" means.
- **Viewport-bounded canvas rendering.** `renderer.ts` never touches a cell
  outside the visible area. Above ~3px/cell it draws per-cell icons; below
  that it fills an offscreen `ImageData` buffer sized to the *visible* cell
  count and blits it scaled up, so zooming out to see a full 1000×1000 board
  is one small buffer write instead of a million `fillRect` calls.
  `fitViewportToDocument` centers the maze (negative origins when the board
  is smaller than the canvas; `contentBounds` ignores ascii padding void).
- **Stroke = interpolate + dedupe.** `stroke.ts` Bresenham-interpolates
  between pointer samples so fast drags don't skip cells, and skips writing
  cells already at the target kind/direction — this is both the "dedupe"
  requirement and the repaint-minimization mechanism.
- **Sync is an explicit state machine**, not ad hoc flags:
  `loading → clean → dirty → saving → clean`, with `dirty/saving → conflict`
  on HTTP 409 (autosave stops, backend content is never overwritten
  silently) and `→ error` on network failure (retryable). Every save quotes
  `base_version`; generated/new levels are stored immediately so they have a
  real id/version before the first autosave needs one.
- **Backend persistence (P1)**: `storage.py` mirrors the level dict to a JSON
  file (atomic write via temp-file + rename), loaded on startup.
- **Delete custom levels**: `POST /level/delete` + `LevelStore.delete()` let
  the editor remove corrupt or unwanted custom levels (`classic` is protected).
  The error banner exposes delete when load/save fails on a broken board.
- **Hardening pass**: save-in-flight queue, `operationId` generation token,
  `hasPendingWork` drives `beforeunload` including conflict state,
  confirm-before-discard on level switch/new/generate, reused `ImageData` in
  the low-zoom renderer path.
- **Shared arcade visuals** (`frontend/shared/`): palette + canvas shapes
  used by both editor and game playground so levels look the same in edit and
  play modes. Editor board uses floor + icon rendering (beveled walls,
  pellet dots, pac-man wedge, ghost silhouettes).
- **Editor → game preview (P1)**: Toolbar **Play** flushes pending saves,
  then opens `http://localhost:3000/?level=<id>`. The game loads
  `ascii2d` from `GET /level/load` via `frontend/shared/level-api.ts` and
  falls back to classic if the backend is unreachable.
- **Friendly level names in the UI**: the backend only stores opaque ids
  (uuid hex for generated levels). `level-labels.ts` maps ids to readable
  labels ("Classic", "Generated 41×41 · seed 1", numbered "Custom maze"
  fallbacks) in sessionStorage; the wire format and API stay unchanged.

## Playground UX (not engine)

The game shell (`frontend/game/App.vue`, `settings.ts`) adds **playground-only**
controls — no changes to movement, collision, ghost AI, or power-ups:

- **Fixed simulation timestep** decoupled from monitor FPS (was one
  `engine.tick()` per animation frame, so 144 Hz felt ~2.4× too fast).
- **Speed selector** (slow / normal / fast presets, sessionStorage).
- **Restart** button and `R` key recreate the engine from the loaded level.

## What code was read

`technical-challenge-frontend-engineer.md`, `docs/level-editor-spec.md`,
all of `frontend/game/engine/`, `frontend/game/` shell, all of
`backend/server/` and `backend/generator/`, plus root config files.

## What was NOT changed

- `frontend/game/engine/**` — game mechanics, `Board`, `fromAscii2d`, and the
  wall-only `toAscii2d` are untouched.
- `backend/generator/**` — the deterministic maze generator is untouched.
- Core store/generate contracts — `StoreRequest`, version/conflict semantics,
  and `GenerateRequest` are unchanged. Only additive API: `DeleteRequest` +
  `POST /level/delete` (plus `DELETE` query alias for tests).
- Version/conflict semantics in `storage.py` — persistence and delete were
  added around them, not into them.

**Presentation-only game changes:** `frontend/game/App.vue`, `styles.css`,
`render.ts`, and `settings.ts` — visuals and playground controls only.

## AI use and limits

Built with Cursor's agent, iterating in small, verifiable steps. Limits I
held to:

- No changes to game mechanics or the wire format the engine expects.
- Every non-trivial claim was verified: `bun test` + `uv run pytest` for
  logic, browser testing for UI/sync/conflict scenarios.
- Backend changes stayed minimal and additive (persistence, delete); no auth,
  no new stack.
- Refused scope creep: no minimap, undo/redo, auth, or deployment.

## Open question

How would this editor evolve for **collaborative editing** while keeping the
backend as authority — an operation log with server-side patches, or a CRDT
over cell edits? The current `version + full ascii2d` contract is simple for
one editor tab but would force explicit conflict UX (or a new wire format) once
two users paint the same level concurrently.
