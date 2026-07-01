import { describe, expect, test } from "bun:test";

import { CLASSIC } from "../game/engine/ascii2d.ts";
import { CellKind, SpawnDirection, createEmptyDocument, parseAscii2d, setCell } from "./level-model.ts";
import { validateLevel } from "./validation.ts";

describe("validateLevel", () => {
  test("flags a blank document with all three issues", () => {
    const doc = createEmptyDocument(5, 5);
    const issues = validateLevel(doc);
    expect(issues).toHaveLength(3);
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  test("CLASSIC has no validation issues", () => {
    const doc = parseAscii2d(CLASSIC);
    expect(validateLevel(doc)).toHaveLength(0);
  });

  test("a player-only board still warns about missing ghosts/pellets", () => {
    const doc = createEmptyDocument(3, 3);
    setCell(doc, 1, 1, CellKind.Player, SpawnDirection.Up);
    const issues = validateLevel(doc);
    expect(issues.every((i) => i.severity === "warning")).toBe(true);
    expect(issues).toHaveLength(2);
  });
});
