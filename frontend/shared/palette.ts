// Arcade palette shared by the level editor canvas and the game playground.

export const PALETTE = {
  floor: [11, 11, 16] as const,
  wall: [42, 58, 145] as const,
  pellet: [235, 218, 158] as const,
  powerPellet: [235, 96, 64] as const,
  player: [255, 213, 79] as const,
  ghost: [255, 105, 140] as const,
} as const;

export function rgb([r, g, b]: readonly [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export const FLOOR_COLOR = rgb(PALETTE.floor);
export const WALL_COLOR = rgb(PALETTE.wall);
export const PELLET_COLOR = rgb(PALETTE.pellet);
export const POWER_PELLET_COLOR = rgb(PALETTE.powerPellet);
export const PLAYER_COLOR = rgb(PALETTE.player);

/** Classic ghost house colors, keyed by ghost id modulo palette length. */
export const GHOST_COLORS = [
  "rgb(255, 0, 85)",
  "rgb(255, 184, 255)",
  "rgb(0, 220, 255)",
  "rgb(255, 184, 82)",
] as const;
