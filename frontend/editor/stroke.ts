// Paint stroke logic, kept independent of Vue/canvas so it is trivial to
// reason about and test: interpolates between two grid cells (Bresenham) so
// a fast drag never skips cells, and only writes cells whose kind/direction
// actually change, which is both the dedupe and the "what to repaint" signal.

import {
  type CellKind,
  type LevelDocument,
  type SpawnDirection,
  getCell,
  getDirection,
  isInBounds,
  setCell,
} from "./level-model.ts";

export type GridPoint = { x: number; y: number };

export function lineCells(x0: number, y0: number, x1: number, y1: number): GridPoint[] {
  const points: GridPoint[] = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) {
      break;
    }
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

/** Paints `to` (and every cell between `from` and `to`, if given) with
 * (kind, direction). Returns true if any cell actually changed. */
export function applyStroke(
  doc: LevelDocument,
  from: GridPoint | null,
  to: GridPoint,
  kind: CellKind,
  direction: SpawnDirection,
): boolean {
  const points = from === null ? [to] : lineCells(from.x, from.y, to.x, to.y);
  let changed = false;
  for (const point of points) {
    if (!isInBounds(doc, point.x, point.y)) {
      continue;
    }
    if (getCell(doc, point.x, point.y) === kind && getDirection(doc, point.x, point.y) === direction) {
      continue;
    }
    setCell(doc, point.x, point.y, kind, direction);
    changed = true;
  }
  return changed;
}
