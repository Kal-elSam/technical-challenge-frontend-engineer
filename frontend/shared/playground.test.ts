import { describe, expect, test } from "bun:test";

import { playUrlForLevel } from "./playground.ts";

describe("playUrlForLevel", () => {
  test("builds a game URL with the level query param", () => {
    expect(playUrlForLevel("classic")).toBe("http://localhost:3000/?level=classic");
    expect(playUrlForLevel("a/b?c", "http://localhost:3000")).toBe("http://localhost:3000/?level=a%2Fb%3Fc");
  });
});
