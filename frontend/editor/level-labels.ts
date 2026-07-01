// Human-readable names for backend level ids. The API only stores opaque ids
// (uuid.hex for generated levels); this module maps ids to labels the user
// actually chose (generate seed/size, blank dimensions) and falls back to
// numbered "Custom maze" names for older saves.

export const CLASSIC_LEVEL_ID = "classic";

const STORAGE_KEY = "maze-chase-level-labels";

function readStorage(): Storage | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

export type LevelLabels = Record<string, string>;

export type LevelOption = {
  id: string;
  label: string;
};

export function loadLevelLabels(): LevelLabels {
  const storage = readStorage();
  if (storage === null) {
    return {};
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    return parsed as LevelLabels;
  } catch {
    return {};
  }
}

export function saveLevelLabel(id: string, label: string): void {
  const storage = readStorage();
  if (storage === null) {
    return;
  }
  const labels = loadLevelLabels();
  labels[id] = label;
  storage.setItem(STORAGE_KEY, JSON.stringify(labels));
}

export function forgetLevelLabel(id: string): void {
  const storage = readStorage();
  if (storage === null) {
    return;
  }
  const labels = loadLevelLabels();
  if (!(id in labels)) {
    return;
  }
  delete labels[id];
  storage.setItem(STORAGE_KEY, JSON.stringify(labels));
}

/** Sorted options for a <select>: classic first, then saved labels, then
 * numbered fallbacks for legacy uuid ids. */
export function buildLevelOptions(ids: readonly string[], labels: LevelLabels): LevelOption[] {
  const sorted = [...ids].sort((a, b) => {
    if (a === CLASSIC_LEVEL_ID) {
      return -1;
    }
    if (b === CLASSIC_LEVEL_ID) {
      return 1;
    }
    return a.localeCompare(b);
  });

  let unnamedCustomCount = 0;
  return sorted.map((id) => {
    if (id === CLASSIC_LEVEL_ID) {
      return { id, label: "Classic" };
    }
    const saved = labels[id];
    if (saved !== undefined) {
      return { id, label: saved };
    }
    unnamedCustomCount += 1;
    const label = unnamedCustomCount === 1 ? "Custom maze" : `Custom maze ${unnamedCustomCount}`;
    return { id, label };
  });
}

export function labelForLevelId(id: string, labels: LevelLabels): string {
  return buildLevelOptions([id], labels)[0]?.label ?? id;
}
