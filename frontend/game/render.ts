// Game canvas renderer — arcade visuals aligned with the level editor palette.

import { drawGhost, drawPacManWedge, drawPellet, drawPowerPellet, drawWallCell } from "../shared/canvas-shapes.ts";
import { FLOOR_COLOR, GHOST_COLORS, PELLET_COLOR, PLAYER_COLOR, POWER_PELLET_COLOR, WALL_COLOR } from "../shared/palette.ts";
import { Direction, type Board } from "./engine/board.ts";
import { frac, toNum } from "./engine/coord.ts";
import type { Ghost, Player } from "./engine/index.ts";
import type { Pellet, PowerPellet } from "./engine/pellet.ts";

const TICKS_PER_SECOND = 60;
const POWER_BLINK_TICKS = TICKS_PER_SECOND;
const POWER_BLINK_PERIOD = 8;

export type GameDrawState = {
  board: Board;
  players: readonly Player[];
  ghosts: readonly Ghost[];
  pellets: readonly Pellet[];
  powerPellets: readonly PowerPellet[];
  blockSize: number;
  padding: number;
};

function directionAngle(direction: Direction): number {
  switch (direction) {
    case Direction.UP:
      return -Math.PI / 2;
    case Direction.RIGHT:
      return 0;
    case Direction.DOWN:
      return Math.PI / 2;
    case Direction.LEFT:
      return Math.PI;
    default: {
      const exhaustive: never = direction;
      throw new Error(`Unhandled direction: ${String(exhaustive)}`);
    }
  }
}

function playerColor(player: Player): string {
  const NORMAL = PLAYER_COLOR;
  const POWERED = "rgb(235, 96, 64)";
  if (player.poweredTicks <= 0) {
    return NORMAL;
  }
  if (player.poweredTicks < POWER_BLINK_TICKS) {
    const on = Math.floor(player.poweredTicks / POWER_BLINK_PERIOD) % 2 === 0;
    return on ? NORMAL : POWERED;
  }
  return POWERED;
}

function ghostColor(id: number): string {
  return GHOST_COLORS[id % GHOST_COLORS.length] ?? GHOST_COLORS[0];
}

function cellOrigin(padding: number, blockSize: number, x: number, y: number): { left: number; top: number; cx: number; cy: number } {
  const left = padding + x * blockSize;
  const top = padding + y * blockSize;
  return { left, top, cx: left + blockSize / 2, cy: top + blockSize / 2 };
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameDrawState): void {
  const { board, players, ghosts, pellets, powerPellets, blockSize, padding } = state;
  const boardWidth = board.width * blockSize;
  const boardHeight = board.height * blockSize;

  ctx.clearRect(0, 0, padding * 2 + boardWidth, padding * 2 + boardHeight);
  ctx.fillStyle = FLOOR_COLOR;
  ctx.fillRect(padding, padding, boardWidth, boardHeight);

  for (let x = 0; x < board.width; x++) {
    for (let y = 0; y < board.height; y++) {
      if (!board.hasWall(x, y)) {
        continue;
      }
      const { left, top } = cellOrigin(padding, blockSize, x, y);
      drawWallCell(ctx, left, top, blockSize, blockSize, WALL_COLOR);
    }
  }

  for (const pellet of pellets) {
    const { cx, cy } = cellOrigin(padding, blockSize, toNum(pellet.x), toNum(pellet.y));
    drawPellet(ctx, cx, cy, blockSize, PELLET_COLOR);
  }

  for (const powerPellet of powerPellets) {
    const { cx, cy } = cellOrigin(padding, blockSize, toNum(powerPellet.x), toNum(powerPellet.y));
    drawPowerPellet(ctx, cx, cy, blockSize, POWER_PELLET_COLOR);
  }

  for (const ghost of ghosts) {
    const { cx, cy } = cellOrigin(padding, blockSize, toNum(ghost.x), toNum(ghost.y));
    drawGhost(ctx, cx, cy, blockSize, directionAngle(ghost.current), ghostColor(ghost.id));
  }

  for (const player of players) {
    const { cx, cy } = cellOrigin(padding, blockSize, toNum(player.x), toNum(player.y));
    const openingCenter = directionAngle(player.current);
    const phase = Math.abs(toNum(frac(player.x)) + toNum(frac(player.y)) - 0.5) * 2;
    const openingWidth = ((45 - 45 * phase) * Math.PI) / 180;
    drawPacManWedge(ctx, cx, cy, blockSize, openingCenter, openingWidth, playerColor(player));
  }
}
