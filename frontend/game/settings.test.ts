import { describe, expect, test } from "bun:test";

import { isGameSpeed, loadGameSpeed, msPerSimulationTick, TICKS_PER_SECOND } from "./settings.ts";

describe("game speed settings", () => {
  test("msPerSimulationTick matches ticks per second", () => {
    expect(msPerSimulationTick("normal")).toBeCloseTo(1000 / 60);
    expect(msPerSimulationTick("slow")).toBeCloseTo(1000 / 48);
  });

  test("slow is slower than normal", () => {
    expect(TICKS_PER_SECOND.slow).toBeLessThan(TICKS_PER_SECOND.normal);
    expect(TICKS_PER_SECOND.fast).toBeGreaterThan(TICKS_PER_SECOND.normal);
  });

  test("isGameSpeed validates presets", () => {
    expect(isGameSpeed("normal")).toBe(true);
    expect(isGameSpeed("turbo")).toBe(false);
  });

  test("loadGameSpeed defaults to normal without storage", () => {
    expect(loadGameSpeed()).toBe("normal");
  });
});
