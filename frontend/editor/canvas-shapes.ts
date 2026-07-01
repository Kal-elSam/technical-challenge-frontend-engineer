// Editor adapter over shared canvas iconography (SpawnDirection → radians).

import { drawGhost as drawGhostShape, drawPacManWedge, drawPellet, drawPowerPellet, drawWallCell } from "../shared/canvas-shapes.ts";
import { SpawnDirection } from "./level-model.ts";

export function directionAngle(direction: SpawnDirection): number {
  switch (direction) {
    case SpawnDirection.Up:
      return -Math.PI / 2;
    case SpawnDirection.Right:
      return 0;
    case SpawnDirection.Down:
      return Math.PI / 2;
    case SpawnDirection.Left:
      return Math.PI;
    default: {
      const exhaustive: never = direction;
      throw new Error(`Unhandled direction: ${String(exhaustive)}`);
    }
  }
}

export { drawPellet, drawPowerPellet, drawWallCell };

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  direction: SpawnDirection,
  color: string,
): void {
  drawPacManWedge(ctx, cx, cy, cellSize, directionAngle(direction), Math.PI / 5, color);
}

export function drawGhost(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  direction: SpawnDirection,
  color: string,
): void {
  drawGhostShape(ctx, cx, cy, cellSize, directionAngle(direction), color);
}
