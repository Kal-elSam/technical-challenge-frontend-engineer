// Playground speed settings. Simulation ticks are decoupled from display FPS
// so a 144 Hz monitor does not run the maze ~2.4× faster than intended.

export const GAME_SPEEDS = ["slow", "normal", "fast"] as const;
export type GameSpeed = (typeof GAME_SPEEDS)[number];

const STORAGE_KEY = "maze-chase-game-speed";

/** Simulation ticks per second for each preset (8 ticks ≈ one cell at UNIT/8 step). */
export const TICKS_PER_SECOND: Record<GameSpeed, number> = {
  slow: 48,
  normal: 60,
  fast: 72,
};

export const GAME_SPEED_LABEL: Record<GameSpeed, string> = {
  slow: "Slow",
  normal: "Normal",
  fast: "Fast",
};

function readStorage(): Storage | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

export function isGameSpeed(value: string): value is GameSpeed {
  return (GAME_SPEEDS as readonly string[]).includes(value);
}

export function loadGameSpeed(): GameSpeed {
  const storage = readStorage();
  if (storage === null) {
    return "normal";
  }
  const saved = storage.getItem(STORAGE_KEY);
  if (saved !== null && isGameSpeed(saved)) {
    return saved;
  }
  return "normal";
}

export function saveGameSpeed(speed: GameSpeed): void {
  const storage = readStorage();
  if (storage === null) {
    return;
  }
  storage.setItem(STORAGE_KEY, speed);
}

export function msPerSimulationTick(speed: GameSpeed): number {
  return 1000 / TICKS_PER_SECOND[speed];
}

/** Cap catch-up after a tab hitch so one long frame does not fast-forward the level. */
export const MAX_SIMULATION_TICKS_PER_FRAME = 8;
