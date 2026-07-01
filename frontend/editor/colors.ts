// Cell color theme for the editor canvas. Maps level-model kinds onto the
// shared arcade palette so the editor and game stay visually consistent.

import { PALETTE, rgb } from "../shared/palette.ts";
import { CellKind } from "./level-model.ts";

export const CELL_RGB: Record<CellKind, readonly [number, number, number]> = {
  [CellKind.Empty]: PALETTE.floor,
  [CellKind.Wall]: PALETTE.wall,
  [CellKind.Pellet]: PALETTE.pellet,
  [CellKind.PowerPellet]: PALETTE.powerPellet,
  [CellKind.Player]: PALETTE.player,
  [CellKind.Ghost]: PALETTE.ghost,
};

export const CELL_CSS_COLOR: Record<CellKind, string> = Object.fromEntries(
  Object.entries(CELL_RGB).map(([kind, tuple]) => [kind, rgb(tuple)]),
) as Record<CellKind, string>;

export const FLOOR_CSS_COLOR = CELL_CSS_COLOR[CellKind.Empty];
