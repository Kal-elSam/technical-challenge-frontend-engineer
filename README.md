# Maze Chase

A Pac-Man-like game and an online 2D level editor for designing its levels.
See `technical-challenge-frontend-engineer.md` for the task and `REPORT.md`
for the editor's design notes.

## Quick start

```bash
bun install && uv sync
uv run backend      # http://localhost:8000
bun run editor      # http://localhost:3001 — the level editor
bun run game        # http://localhost:3000 — play a level (?level=id)
```

In the editor, use **Play** to open the current saved level in the game tab.

## Tests

```bash
bun test            # frontend: ascii2d round-trip, paint-stroke logic
uv run pytest       # backend: version/conflict contract, JSON persistence
```
