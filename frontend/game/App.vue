<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

import { loadLevelPayload } from "./api.ts";
import { CLASSIC_LEVEL_ID, labelForLevelId, loadLevelLabels } from "../editor/level-labels.ts";
import { CLASSIC, Direction, Engine, div, fromNum, type Ghost, type Player, type Pellet, type PowerPellet } from "./engine/index.ts";
import { renderGame } from "./render.ts";

const BLOCK_SIZE = 16;
const BOARD_PADDING = 12;

const engine = ref<Engine | null>(null);
const players = ref<readonly Player[]>([]);
const ghosts = ref<readonly Ghost[]>([]);
const pellets = ref<readonly Pellet[]>([]);
const powerPellets = ref<readonly PowerPellet[]>([]);
const levelWidth = ref(0);
const levelHeight = ref(0);
const fps = ref(0);
const levelId = ref(CLASSIC_LEVEL_ID);
const levelLabel = computed(() => labelForLevelId(levelId.value, loadLevelLabels()));
const loadNotice = ref<string | null>(null);
const heldDirection = ref<Direction | null>(null);

let frameId = 0;
let lastFrameTime = 0;
let frameCount = 0;
let fpsWindowStart = 0;

const canvasWidth = computed(() => BOARD_PADDING * 2 + levelWidth.value * BLOCK_SIZE);
const canvasHeight = computed(() => BOARD_PADDING * 2 + levelHeight.value * BLOCK_SIZE);

function syncState(): void {
  if (engine.value === null) {
    return;
  }
  players.value = engine.value.getPlayers();
  ghosts.value = engine.value.getGhosts();
  pellets.value = engine.value.getPellets();
  powerPellets.value = engine.value.getPowerPellets();
  const board = engine.value.getBoard();
  levelWidth.value = board.width;
  levelHeight.value = board.height;
}

function draw(ctx: CanvasRenderingContext2D): void {
  if (engine.value === null) {
    return;
  }
  renderGame(ctx, {
    board: engine.value.getBoard(),
    players: players.value,
    ghosts: ghosts.value,
    pellets: pellets.value,
    powerPellets: powerPellets.value,
    blockSize: BLOCK_SIZE,
    padding: BOARD_PADDING,
  });
}

function tickFrame(timestamp: number): void {
  if (engine.value === null) {
    return;
  }

  if (lastFrameTime > 0) {
    engine.value.tick({ direction: heldDirection.value });
    syncState();
  }
  lastFrameTime = timestamp;

  frameCount += 1;
  if (fpsWindowStart === 0) {
    fpsWindowStart = timestamp;
  }
  if (timestamp - fpsWindowStart >= 1000) {
    fps.value = frameCount;
    frameCount = 0;
    fpsWindowStart = timestamp;
  }

  const canvas = document.getElementById("game-canvas");
  if (canvas instanceof HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (ctx !== null) {
      draw(ctx);
    }
  }

  frameId = requestAnimationFrame(tickFrame);
}

function directionFromKey(key: string): Direction | null {
  if (key === "ArrowRight") {
    return Direction.RIGHT;
  }
  if (key === "ArrowLeft") {
    return Direction.LEFT;
  }
  if (key === "ArrowUp") {
    return Direction.UP;
  }
  if (key === "ArrowDown") {
    return Direction.DOWN;
  }
  return null;
}

function onKeyDown(event: KeyboardEvent): void {
  const direction = directionFromKey(event.key);
  if (direction !== null) {
    heldDirection.value = direction;
    event.preventDefault();
  }
}

function onKeyUp(event: KeyboardEvent): void {
  const direction = directionFromKey(event.key);
  if (direction !== null && heldDirection.value === direction) {
    heldDirection.value = null;
    event.preventDefault();
  }
}

onMounted(() => {
  void (async () => {
    const requestedId = new URLSearchParams(window.location.search).get("level") ?? CLASSIC_LEVEL_ID;
    levelId.value = requestedId;
    try {
      const level = await loadLevelPayload(requestedId);
      engine.value = new Engine(level.ascii2d, div(fromNum(1), fromNum(8)));
    } catch {
      loadNotice.value =
        requestedId === CLASSIC_LEVEL_ID
          ? "Could not reach the level server — is `uv run backend` running?"
          : `Could not load "${requestedId}" — playing classic instead.`;
      levelId.value = CLASSIC_LEVEL_ID;
      engine.value = new Engine(CLASSIC, div(fromNum(1), fromNum(8)));
    }
    syncState();
    frameId = requestAnimationFrame(tickFrame);
  })();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
});

onUnmounted(() => {
  cancelAnimationFrame(frameId);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
});
</script>

<template>
  <main class="game">
    <header class="game-header">
      <h1 class="title">
        <span class="logo">▪</span>
        Maze Chase
      </h1>
      <p v-if="loadNotice" class="notice">{{ loadNotice }}</p>
      <p v-else class="hint">Arrow keys to move</p>
    </header>

    <section class="stage">
      <div class="hud">
        <span class="chip" :title="levelId">{{ levelLabel }}</span>
        <span class="chip">{{ levelWidth }}×{{ levelHeight }}</span>
        <span class="chip">{{ fps }} FPS</span>
        <span class="chip">players {{ players.length }}</span>
        <span class="chip">ghosts {{ ghosts.length }}</span>
        <span class="chip">pellets {{ pellets.length }}</span>
      </div>

      <div class="canvas-shell">
        <canvas id="game-canvas" :width="canvasWidth" :height="canvasHeight" />
      </div>
    </section>
  </main>
</template>

<style scoped>
.game {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  min-height: 100vh;
  padding: 24px;
}

.game-header {
  text-align: center;
}

.title {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.logo {
  color: var(--accent);
  font-size: 0.75rem;
}

.hint {
  margin: 6px 0 0;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.notice {
  margin: 6px 0 0;
  color: var(--warning, #e6b800);
  font-size: 0.82rem;
  max-width: 32rem;
  text-align: center;
}

.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: min(100%, 720px);
}

.hud {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.chip {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  padding: 4px 10px;
}

.canvas-shell {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 12px;
  background:
    radial-gradient(ellipse at center, rgba(255, 255, 255, 0.02), transparent 70%),
    #0a0a0e;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

canvas {
  display: block;
  image-rendering: pixelated;
}
</style>
