// Per-cell painting for the "normal zoom" renderer path. Split out of
// renderer.ts so viewport math and per-shape drawing detail don't live in
// the same file.

import { drawGhost, drawPellet, drawPlayer, drawPowerPellet, drawWallCell } from "./canvas-shapes.ts";
import { CELL_CSS_COLOR, FLOOR_CSS_COLOR } from "./colors.ts";
import { CellKind, type LevelDocument, getDirection } from "./level-model.ts";

// Below this, per-shape icons (dots, pac-man wedge, ghost eyes) cost more
// draw calls than they're worth at a size where they'd be unreadable anyway;
// fall back to a flat color swatch instead.
export const ICON_DETAIL_MIN_PX = 7;

/** Fast path for very small cells: a flat color swatch per kind, same as the
 * pre-icon renderer. Used below `ICON_DETAIL_MIN_PX` where dots/wedges/eyes
 * would be sub-pixel anyway. */
export function renderFlatCell(ctx: CanvasRenderingContext2D, kind: CellKind, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = CELL_CSS_COLOR[kind];
  ctx.fillRect(x, y, w, h);
}

/** Floor + icon: every non-wall kind sits on the same dark floor color, with
 * a small shape drawn on top — this is what makes pellets read as dots and
 * spawns read as a pac-man/ghost instead of flat, same-weight color blocks. */
export function renderDetailedCell(
  ctx: CanvasRenderingContext2D,
  doc: LevelDocument,
  kind: CellKind,
  x: number,
  y: number,
  sx: number,
  sy: number,
  w: number,
  h: number,
  cellSize: number,
): void {
  if (kind === CellKind.Wall) {
    drawWallCell(ctx, sx, sy, w, h, CELL_CSS_COLOR[CellKind.Wall]);
    return;
  }

  ctx.fillStyle = FLOOR_CSS_COLOR;
  ctx.fillRect(sx, sy, w, h);

  const cx = sx + w / 2;
  const cy = sy + h / 2;
  switch (kind) {
    case CellKind.Empty:
      return;
    case CellKind.Pellet:
      drawPellet(ctx, cx, cy, cellSize, CELL_CSS_COLOR[CellKind.Pellet]);
      return;
    case CellKind.PowerPellet:
      drawPowerPellet(ctx, cx, cy, cellSize, CELL_CSS_COLOR[CellKind.PowerPellet]);
      return;
    case CellKind.Player:
      drawPlayer(ctx, cx, cy, cellSize, getDirection(doc, x, y), CELL_CSS_COLOR[CellKind.Player]);
      return;
    case CellKind.Ghost:
      drawGhost(ctx, cx, cy, cellSize, getDirection(doc, x, y), CELL_CSS_COLOR[CellKind.Ghost]);
      return;
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unhandled cell kind: ${String(exhaustive)}`);
    }
  }
}
