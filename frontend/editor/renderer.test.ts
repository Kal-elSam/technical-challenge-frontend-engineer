import { describe, expect, test } from "bun:test";

import { createEmptyDocument } from "./level-model.ts";
import { clampViewport, fitViewportToDocument, viewportOriginBounds } from "./renderer.ts";

describe("viewport centering", () => {
  test("fitViewportToDocument centers a small board in a large canvas", () => {
    const doc = createEmptyDocument(28, 29);
    const viewport = fitViewportToDocument(doc, 1200, 800);

    expect(viewport.originX).toBeLessThan(0);
    expect(viewport.originY).toBeLessThan(0);
  });

  test("viewportOriginBounds allows negative origins when the board is smaller than the view", () => {
    const doc = createEmptyDocument(10, 10);
    const bounds = viewportOriginBounds(doc, 20, 800, 600);

    expect(bounds.minOriginX).toBeLessThan(0);
    expect(bounds.maxOriginX).toBe(0);
    expect(bounds.minOriginY).toBeLessThan(0);
    expect(bounds.maxOriginY).toBe(0);
  });

  test("clampViewport preserves a horizontally centered origin for undersized boards", () => {
    const doc = createEmptyDocument(10, 20);
    const bounds = viewportOriginBounds(doc, 20, 800, 600);
    const centered = clampViewport(
      { originX: (doc.width - 800 / 20) / 2, originY: bounds.minOriginY, cellSize: 20 },
      doc,
      800,
      600,
    );

    expect(centered.originX).toBeLessThan(0);
  });

  test("clampViewport still pins large boards to document edges", () => {
    const doc = createEmptyDocument(200, 200);
    const bounds = viewportOriginBounds(doc, 8, 800, 600);

    expect(bounds.minOriginX).toBe(0);
    expect(bounds.maxOriginX).toBeGreaterThan(0);

    const clamped = clampViewport({ originX: -50, originY: -50, cellSize: 8 }, doc, 800, 600);
    expect(clamped.originX).toBe(0);
    expect(clamped.originY).toBe(0);
  });
});
