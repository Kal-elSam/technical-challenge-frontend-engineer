import { describe, expect, test } from "bun:test";

import { fromAscii2d as engineFromAscii2d, toAscii2d as engineToAscii2dWallsOnly, CLASSIC } from "../game/engine/ascii2d.ts";
import { Block, type Board } from "../game/engine/board.ts";
import {
  CellKind,
  SpawnDirection,
  createEmptyDocument,
  getCell,
  getDirection,
  parseAscii2d,
  serializeToAscii2d,
  setCell,
} from "./level-model.ts";

describe("parseAscii2d / serializeToAscii2d round-trip", () => {
  test("CLASSIC survives a full parse -> serialize -> parse cycle", () => {
    const doc = parseAscii2d(CLASSIC);
    const serialized = serializeToAscii2d(doc);
    const reparsed = parseAscii2d(serialized);

    expect(reparsed.width).toBe(doc.width);
    expect(reparsed.height).toBe(doc.height);
    expect([...reparsed.cells]).toEqual([...doc.cells]);
    expect([...reparsed.directions]).toEqual([...doc.directions]);
  });

  test("serialized CLASSIC also parses cleanly through the engine's own fromAscii2d", () => {
    const doc = parseAscii2d(CLASSIC);
    const serialized = serializeToAscii2d(doc);
    // This is the contract that matters: whatever the editor writes must be
    // playable by the untouched engine.
    expect(() => engineFromAscii2d(serialized)).not.toThrow();
  });

  test("round-trips every token kind, not just walls", () => {
    const doc = createEmptyDocument(4, 2);
    setCell(doc, 0, 0, CellKind.Wall);
    setCell(doc, 1, 0, CellKind.Pellet);
    setCell(doc, 2, 0, CellKind.PowerPellet);
    setCell(doc, 3, 0, CellKind.Player, SpawnDirection.Left);
    setCell(doc, 0, 1, CellKind.Ghost, SpawnDirection.Down);
    setCell(doc, 1, 1, CellKind.Empty);

    const serialized = serializeToAscii2d(doc);
    const reparsed = parseAscii2d(serialized);

    expect(getCell(reparsed, 0, 0)).toBe(CellKind.Wall);
    expect(getCell(reparsed, 1, 0)).toBe(CellKind.Pellet);
    expect(getCell(reparsed, 2, 0)).toBe(CellKind.PowerPellet);
    expect(getCell(reparsed, 3, 0)).toBe(CellKind.Player);
    expect(getDirection(reparsed, 3, 0)).toBe(SpawnDirection.Left);
    expect(getCell(reparsed, 0, 1)).toBe(CellKind.Ghost);
    expect(getDirection(reparsed, 0, 1)).toBe(SpawnDirection.Down);
    expect(getCell(reparsed, 1, 1)).toBe(CellKind.Empty);
  });

  test("preserves trailing spaces so short/empty rows stay full width", () => {
    const doc = createEmptyDocument(3, 1);
    setCell(doc, 0, 0, CellKind.Wall);
    // Cells 1 and 2 stay Empty ("  "), which must not get trimmed away.
    const serialized = serializeToAscii2d(doc);
    const [, row] = serialized.split("\n");
    expect(row).toBe("##    ");
  });

  test("rejects an odd row length the same way the engine parser does", () => {
    expect(() => parseAscii2d("\n###\n")).toThrow();
  });
});

describe("CLASSIC parses to the shape the engine already knows about", () => {
  test("cell kinds match Board.getBlock for every position", () => {
    const doc = parseAscii2d(CLASSIC);
    const board: Board = engineFromAscii2d(CLASSIC);

    for (let y = 0; y < doc.height; y++) {
      for (let x = 0; x < doc.width; x++) {
        const block = board.getBlock(x, y);
        const kind = getCell(doc, x, y);
        if (block.kind === Block.Wall) {
          expect(kind).toBe(CellKind.Wall);
        }
      }
    }
  });

  test("the engine's own wall-only serializer is a strict subset of ours", () => {
    // Documents the known gap this editor fixes: engine's toAscii2d drops
    // every non-wall token. We don't change that function; we replace it
    // for the editor's own save path instead.
    const board = engineFromAscii2d(CLASSIC);
    const wallsOnly = engineToAscii2dWallsOnly(board);
    expect(wallsOnly).not.toContain("P");
    expect(wallsOnly).not.toContain("O");
  });
});
