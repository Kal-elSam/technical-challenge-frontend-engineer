import { describe, expect, test } from "bun:test";

import { CellKind, SpawnDirection, createEmptyDocument, getCell } from "./level-model.ts";
import { applyStroke, lineCells } from "./stroke.ts";

describe("lineCells", () => {
  test("interpolates every cell on a diagonal so fast drags leave no gaps", () => {
    const points = lineCells(0, 0, 3, 3);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
  });

  test("handles a purely horizontal drag", () => {
    const points = lineCells(0, 5, 4, 5);
    expect(points.map((p) => p.x)).toEqual([0, 1, 2, 3, 4]);
    expect(points.every((p) => p.y === 5)).toBe(true);
  });
});

describe("applyStroke", () => {
  test("paints every interpolated cell between two pointer samples", () => {
    const doc = createEmptyDocument(10, 10);
    applyStroke(doc, { x: 0, y: 0 }, { x: 4, y: 0 }, CellKind.Wall, SpawnDirection.Right);
    for (let x = 0; x <= 4; x++) {
      expect(getCell(doc, x, 0)).toBe(CellKind.Wall);
    }
  });

  test("skips cells outside document bounds without throwing", () => {
    const doc = createEmptyDocument(3, 3);
    expect(() => applyStroke(doc, { x: -2, y: 0 }, { x: 5, y: 0 }, CellKind.Wall, SpawnDirection.Right)).not.toThrow();
    expect(getCell(doc, 0, 0)).toBe(CellKind.Wall);
    expect(getCell(doc, 2, 0)).toBe(CellKind.Wall);
  });

  test("dedupes: re-painting the same kind/direction reports no change", () => {
    const doc = createEmptyDocument(5, 5);
    const first = applyStroke(doc, null, { x: 2, y: 2 }, CellKind.Wall, SpawnDirection.Right);
    const second = applyStroke(doc, null, { x: 2, y: 2 }, CellKind.Wall, SpawnDirection.Right);
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  test("a direction-only change on the same kind still counts as a change", () => {
    const doc = createEmptyDocument(5, 5);
    applyStroke(doc, null, { x: 1, y: 1 }, CellKind.Player, SpawnDirection.Up);
    const changed = applyStroke(doc, null, { x: 1, y: 1 }, CellKind.Player, SpawnDirection.Down);
    expect(changed).toBe(true);
  });
});
