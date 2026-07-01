# REPORT — 2D Level Editor

## What was built

`frontend/editor/` — a Vue 3 + TypeScript + Bun level editor for Maze Chase
levels, backed by the existing FastAPI service. Run with `bun run editor`
(needs `uv run backend` running too).

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
  outside the visible area. Above ~3px/cell it draws per-cell rects; below
  that it fills an offscreen `ImageData` buffer sized to the *visible* cell
  count and blits it scaled up, so zooming out to see a full 1000×1000 board
  is one small buffer write instead of a million `fillRect` calls.
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
- **Backend persistence (P1)**: `storage.py` now optionally mirrors the
  level dict to a JSON file (atomic write via temp-file + rename), loaded on
  startup. `id`/`version`/`ascii2d` and the conflict contract are unchanged;
  tests use `LevelStore()` with no path so they never touch disk.

## What code was read

`technical-challenge-frontend-engineer.md`, `docs/level-editor-spec.md`,
all of `frontend/game/engine/` (`board.ts`, `ascii2d.ts`, `coord.ts`,
`engine.ts`, `player.ts`, `ghost.ts`, `pellet.ts`, `index.ts`),
`frontend/game/{App.vue,main.ts,serve.ts,index.html,env.d.ts,styles.css}`,
all of `backend/server/` (`app.py`, `models.py`, `storage.py`) and
`backend/generator/` (`maze.py`, `ascii2d.py`), plus the root config files
(`package.json`, `tsconfig.json`, `bunfig.toml`, `pyproject.toml`).

## What was NOT changed

- `frontend/game/engine/**` — game mechanics, `Board`, `fromAscii2d`, and the
  wall-only `toAscii2d` are untouched. The editor works around the
  serialization gap with its own serializer instead of editing shared code.
- `frontend/game/**` — the game playground is untouched; `bun run game`
  still behaves exactly as before.
- `backend/generator/**` — the deterministic maze generator is untouched.
- `backend/server/models.py` — request/response contracts are unchanged.
- The version/conflict semantics in `backend/server/storage.py`
  (`VersionConflict`, `LevelNotFound`, monotonic `version`) — persistence
  was added around them, not into them.

## AI use and limits

Built with Cursor's agent, iterating in small, verifiable steps. Limits I
held to:

- No changes to game mechanics or the wire format the engine expects —
  every serializer change was checked against `fromAscii2d`/`toAscii2d`
  directly, not just against my own code.
- Every non-trivial claim was verified, not assumed: `bun test` +
  `uv run pytest` for logic, and live browser testing (paint strokes, 1M-cell
  zoom/pan, generate, and a real 409 by racing two writes) for the UI. That
  testing surfaced and fixed three real bugs before they shipped:
  1. `setPointerCapture` could throw and crash the app on some pointer
     sources — now guarded.
  2. Every successful autosave replaced the document object for its
     id/version, which a naive `watch` used to reinterpret as "reset the
     viewport" — autosave was resetting the user's pan/zoom mid-edit. Fixed
     by removing that watch; every real level switch already fits the view
     explicitly.
  3. The `directions` array used two different "don't care" defaults
     (zero-init vs. an explicit `Right`) for non-spawn cells, breaking exact
     round-trip equality. Normalized to one constant.
- Did not invent backend endpoints or fields beyond what `app.py`/`models.py`
  already exposed.
