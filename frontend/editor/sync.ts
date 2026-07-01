// Backend sync state machine. The backend is authority: every save quotes the
// last accepted `version`, and a stale write comes back as a 409 instead of
// silently overwriting newer work. This module owns the state machine only;
// it does not know about pointer events, canvas, or Vue components.
//
//   loading -> clean
//   clean -> dirty -> saving -> clean
//   dirty/saving -> conflict   (409: stop autosave, wait for the user)
//   dirty/saving -> error      (network failure: stays retryable)

import { shallowRef, triggerRef, type ShallowRef } from "vue";

import { ConflictError, createLevel, generateLevel, loadLevel, updateLevel } from "./api.ts";
import { createEmptyDocument, type LevelDocument, parseAscii2d, serializeToAscii2d } from "./level-model.ts";

export type SyncStatus = "loading" | "clean" | "dirty" | "saving" | "conflict" | "error";

const AUTOSAVE_DELAY_MS = 800;

export type LevelSync = {
  status: ShallowRef<SyncStatus>;
  errorMessage: ShallowRef<string | null>;
  document: ShallowRef<LevelDocument>;
  load: (id: string) => Promise<void>;
  generate: (seed: number, size: number) => Promise<void>;
  createBlank: (width: number, height: number) => Promise<void>;
  /** Call after mutating `document.value` in place (e.g. during a paint stroke). */
  markDirty: () => void;
  /** Forces dependents (computed validation, etc.) to re-read the in-place
   * mutated document. `shallowRef` does not auto-detect cell/direction
   * writes, so this is called once per stroke rather than per cell — running
   * full-grid validation on every pointermove would not scale to 1M cells. */
  notifyChanged: () => void;
  /** Persists immediately; used at stroke end and as the manual retry action. */
  flush: () => Promise<void>;
  /** Discards local edits and re-loads the backend's current version. */
  reloadAuthoritative: () => Promise<void>;
  dispose: () => void;
};

export function createLevelSync(initial: LevelDocument): LevelSync {
  const status = shallowRef<SyncStatus>("clean");
  const errorMessage = shallowRef<string | null>(null);
  const document = shallowRef<LevelDocument>(initial);
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  function clearAutosaveTimer(): void {
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
  }

  function setDocument(doc: LevelDocument): void {
    document.value = doc;
    triggerRef(document);
  }

  async function persist(): Promise<void> {
    clearAutosaveTimer();
    if (status.value === "conflict" || status.value === "saving") {
      return;
    }
    const doc = document.value;
    status.value = "saving";
    errorMessage.value = null;
    const ascii2d = serializeToAscii2d(doc);
    try {
      const response = doc.id === null ? await createLevel(ascii2d) : await updateLevel(doc.id, ascii2d, doc.version ?? 0);
      setDocument({ ...doc, id: response.id, version: response.version });
      status.value = "clean";
    } catch (error) {
      if (error instanceof ConflictError) {
        status.value = "conflict";
        errorMessage.value = "Someone else saved a newer version. Reload to see it before continuing.";
        return;
      }
      status.value = "error";
      errorMessage.value = error instanceof Error ? error.message : String(error);
    }
  }

  function markDirty(): void {
    if (status.value === "conflict") {
      return;
    }
    status.value = "dirty";
    clearAutosaveTimer();
    autosaveTimer = setTimeout(() => void persist(), AUTOSAVE_DELAY_MS);
  }

  async function flush(): Promise<void> {
    if (status.value !== "dirty" && status.value !== "error") {
      return;
    }
    await persist();
  }

  async function load(id: string): Promise<void> {
    clearAutosaveTimer();
    status.value = "loading";
    errorMessage.value = null;
    try {
      const response = await loadLevel(id);
      setDocument({ ...parseAscii2d(response.ascii2d), id: response.id, version: response.version });
      status.value = "clean";
    } catch (error) {
      status.value = "error";
      errorMessage.value = error instanceof Error ? error.message : String(error);
    }
  }

  async function generate(seed: number, size: number): Promise<void> {
    clearAutosaveTimer();
    status.value = "loading";
    errorMessage.value = null;
    try {
      const generated = await generateLevel(seed, size);
      // Store immediately: a generated level must have a real backend id
      // before the user can edit it, or the first autosave has nothing to
      // attach a base_version to.
      const created = await createLevel(generated.ascii2d);
      setDocument({ ...parseAscii2d(created.ascii2d), id: created.id, version: created.version });
      status.value = "clean";
    } catch (error) {
      status.value = "error";
      errorMessage.value = error instanceof Error ? error.message : String(error);
    }
  }

  async function createBlank(width: number, height: number): Promise<void> {
    clearAutosaveTimer();
    status.value = "loading";
    errorMessage.value = null;
    try {
      const ascii2d = serializeToAscii2d(createEmptyDocument(width, height));
      // Store immediately, same reasoning as `generate`: editing needs a
      // real id/version to attach the first autosave's base_version to.
      const created = await createLevel(ascii2d);
      setDocument({ ...parseAscii2d(created.ascii2d), id: created.id, version: created.version });
      status.value = "clean";
    } catch (error) {
      status.value = "error";
      errorMessage.value = error instanceof Error ? error.message : String(error);
    }
  }

  async function reloadAuthoritative(): Promise<void> {
    const id = document.value.id;
    if (id === null) {
      return;
    }
    await load(id);
  }

  function dispose(): void {
    clearAutosaveTimer();
  }

  function notifyChanged(): void {
    triggerRef(document);
  }

  return {
    status,
    errorMessage,
    document,
    load,
    generate,
    createBlank,
    markDirty,
    notifyChanged,
    flush,
    reloadAuthoritative,
    dispose,
  };
}
