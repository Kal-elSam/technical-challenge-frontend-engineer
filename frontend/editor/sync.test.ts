import { afterEach, describe, expect, mock, test } from "bun:test";

import { CellKind, createEmptyDocument, serializeToAscii2d, setCell } from "./level-model.ts";
import { hasPendingWork } from "./sync.ts";

describe("hasPendingWork", () => {
  test("treats dirty, saving, error, and conflict as pending", () => {
    expect(hasPendingWork("dirty")).toBe(true);
    expect(hasPendingWork("saving")).toBe(true);
    expect(hasPendingWork("error")).toBe(true);
    expect(hasPendingWork("conflict")).toBe(true);
  });

  test("clean and loading are not pending", () => {
    expect(hasPendingWork("clean")).toBe(false);
    expect(hasPendingWork("loading")).toBe(false);
  });
});

describe("createLevelSync save queue", () => {
  afterEach(() => {
    mock.restore();
  });

  test("edits during an in-flight save queue a follow-up persist with the new version", async () => {
    let resolveFirst!: (value: { id: string; version: number; ascii2d: string }) => void;
    let updateCalls = 0;

    mock.module("./api.ts", () => ({
      ConflictError: class ConflictError extends Error {},
      NotFoundError: class NotFoundError extends Error {},
      loadLevel: mock(async () => {
        throw new Error("not used");
      }),
      listLevels: mock(async () => []),
      createLevel: mock(async () => ({ id: "lvl", version: 1, ascii2d: "" })),
      generateLevel: mock(async () => ({ seed: 1, size: 10, ascii2d: "" })),
      updateLevel: mock(async (_id: string, _ascii2d: string, baseVersion: number) => {
        updateCalls += 1;
        if (updateCalls === 1) {
          return await new Promise<{ id: string; version: number; ascii2d: string }>((resolve) => {
            resolveFirst = resolve;
          });
        }
        expect(baseVersion).toBe(1);
        return { id: "lvl", version: 2, ascii2d: _ascii2d };
      }),
    }));

    const { createLevelSync } = await import("./sync.ts");
    const doc = { ...createEmptyDocument(4, 4), id: "lvl", version: 1 };
    const sync = createLevelSync(doc);

    sync.markDirty();
    const firstSave = sync.flush();
    sync.markDirty();
    setCell(sync.document.value, 1, 1, CellKind.Wall);

    resolveFirst({ id: "lvl", version: 1, ascii2d: "" });
    await firstSave;

    expect(updateCalls).toBe(2);
    expect(sync.status.value).toBe("clean");
    expect(sync.document.value.version).toBe(2);
  });

  test("stale in-flight save does not overwrite a newer load", async () => {
    let resolveSave!: (value: { id: string; version: number; ascii2d: string }) => void;
    const loadedAscii = serializeToAscii2d(createEmptyDocument(2, 2));

    mock.module("./api.ts", () => ({
      ConflictError: class ConflictError extends Error {},
      NotFoundError: class NotFoundError extends Error {},
      loadLevel: mock(async () => ({ id: "new-level", version: 5, ascii2d: loadedAscii })),
      listLevels: mock(async () => []),
      createLevel: mock(async () => ({ id: "lvl", version: 1, ascii2d: "" })),
      generateLevel: mock(async () => ({ seed: 1, size: 10, ascii2d: "" })),
      updateLevel: mock(async () => {
        return await new Promise<{ id: string; version: number; ascii2d: string }>((resolve) => {
          resolveSave = resolve;
        });
      }),
    }));

    const { createLevelSync } = await import("./sync.ts");
    const sync = createLevelSync({ ...createEmptyDocument(4, 4), id: "old", version: 1 });

    sync.markDirty();
    const savePromise = sync.flush();
    await sync.load("new-level");

    expect(sync.document.value.id).toBe("new-level");
    expect(sync.document.value.version).toBe(5);

    resolveSave({ id: "old", version: 99, ascii2d: "" });
    await savePromise;

    expect(sync.document.value.id).toBe("new-level");
    expect(sync.document.value.version).toBe(5);
  });
});
