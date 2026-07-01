// Cell color theme, kept separate from renderer.ts so the rendering
// algorithm and the visual palette can change independently.

import { CellKind } from "./level-model.ts";

export const CELL_RGB: Record<CellKind, readonly [number, number, number]> = {
  [CellKind.Empty]: [26, 26, 26],
  [CellKind.Wall]: [58, 58, 66],
  [CellKind.Pellet]: [214, 197, 120],
  [CellKind.PowerPellet]: [229, 87, 53],
  [CellKind.Player]: [255, 213, 79],
  [CellKind.Ghost]: [92, 176, 224],
};

export const CELL_CSS_COLOR: Record<CellKind, string> = Object.fromEntries(
  Object.entries(CELL_RGB).map(([kind, [r, g, b]]) => [kind, `rgb(${r}, ${g}, ${b})`]),
) as Record<CellKind, string>;
