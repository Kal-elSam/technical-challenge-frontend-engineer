<script setup lang="ts">
import { ref } from "vue";

import { CELL_CSS_COLOR } from "./colors.ts";
import { CellKind, SpawnDirection } from "./level-model.ts";
import type { LevelOption } from "./level-labels.ts";

const tool = defineModel<CellKind>("tool", { required: true });
const direction = defineModel<SpawnDirection>("direction", { required: true });

defineProps<{
  levelOptions: LevelOption[];
  currentLevelId: string | null;
}>();

const emit = defineEmits<{
  "select-level": [id: string];
  "new-level": [];
  generate: [seed: number, size: number];
  "fit-view": [];
  "play-level": [];
}>();

// Swatches reuse the renderer's own palette (colors.ts) so the tool a user
// picks always looks exactly like what lands on the canvas.
const TOOLS: Array<{ kind: CellKind; label: string; hint: string; shortcut: string }> = [
  { kind: CellKind.Empty, label: "Empty", hint: "Clear a cell", shortcut: "1" },
  { kind: CellKind.Wall, label: "Wall", hint: "Paint a wall", shortcut: "2" },
  { kind: CellKind.Pellet, label: "Pellet", hint: "Paint a pellet", shortcut: "3" },
  { kind: CellKind.PowerPellet, label: "Power", hint: "Paint a power pellet", shortcut: "4" },
  { kind: CellKind.Player, label: "Player", hint: "Place player spawn", shortcut: "5" },
  { kind: CellKind.Ghost, label: "Ghost", hint: "Place ghost spawn", shortcut: "6" },
];

const DIRECTIONS: Array<{ dir: SpawnDirection; label: string; slot: string }> = [
  { dir: SpawnDirection.Up, label: "↑", slot: "up" },
  { dir: SpawnDirection.Left, label: "←", slot: "left" },
  { dir: SpawnDirection.Right, label: "→", slot: "right" },
  { dir: SpawnDirection.Down, label: "↓", slot: "down" },
];

const seed = ref(1);
const size = ref(41);

function needsDirection(kind: CellKind): boolean {
  return kind === CellKind.Player || kind === CellKind.Ghost;
}

function onGenerate(): void {
  emit("generate", seed.value, size.value);
}
</script>

<template>
  <div class="toolbar">
    <div class="group">
      <span class="group-label">Tool</span>
      <div class="tool-buttons">
        <button
          v-for="entry in TOOLS"
          :key="entry.kind"
          type="button"
          class="tool-button"
          :class="{ active: tool === entry.kind }"
          :title="`${entry.hint} (${entry.shortcut})`"
          @click="tool = entry.kind"
        >
          <span class="swatch" :style="{ background: CELL_CSS_COLOR[entry.kind] }" />
          {{ entry.label }}
          <span class="shortcut">{{ entry.shortcut }}</span>
        </button>
      </div>
    </div>

    <div class="divider" />

    <div class="group" :class="{ disabled: !needsDirection(tool) }">
      <span class="group-label">Direction</span>
      <div class="direction-pad">
        <button
          v-for="entry in DIRECTIONS"
          :key="entry.dir"
          type="button"
          class="direction-button"
          :class="[`slot-${entry.slot}`, { active: direction === entry.dir }]"
          :disabled="!needsDirection(tool)"
          @click="direction = entry.dir"
        >
          {{ entry.label }}
        </button>
      </div>
    </div>

    <div class="divider" />

    <div class="group">
      <span class="group-label">Level</span>
      <div class="row">
        <select
          :value="currentLevelId ?? ''"
          class="level-select"
          :title="currentLevelId ?? undefined"
          @change="emit('select-level', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="entry in levelOptions" :key="entry.id" :value="entry.id" :title="entry.id">
            {{ entry.label }}
          </option>
        </select>
        <button type="button" class="ghost-button" @click="emit('new-level')">New</button>
        <button type="button" class="ghost-button" @click="emit('fit-view')">Fit view</button>
        <button
          type="button"
          class="play-button"
          title="Open this level in the game playground (saves pending edits first)"
          :disabled="currentLevelId === null"
          @click="emit('play-level')"
        >
          Play
        </button>
      </div>
    </div>

    <div class="divider" />

    <div class="group">
      <span class="group-label">Generate</span>
      <div class="row">
        <label class="field">
          seed
          <input v-model.number="seed" type="number" />
        </label>
        <label class="field">
          size
          <input v-model.number="size" type="number" min="15" max="1000" />
        </label>
        <button type="button" class="primary-button" @click="onGenerate">Generate</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: flex-end;
  justify-content: center;
  padding: 0 24px 12px;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: opacity var(--transition-fast);
}

.group.disabled {
  opacity: 0.4;
}

.group-label {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.divider {
  width: 1px;
  align-self: stretch;
  background: var(--border-subtle);
  margin-bottom: 2px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-buttons {
  display: flex;
  gap: 4px;
}

.tool-button {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  font-size: 0.83rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 7px;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);
}

.tool-button:hover {
  background: var(--surface-3);
  border-color: var(--border-strong);
}

.tool-button:active {
  transform: translateY(1px);
}

.tool-button.active {
  background: rgba(76, 175, 125, 0.16);
  border-color: var(--accent);
  color: var(--accent-strong);
}

.swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.shortcut {
  font-size: 0.68rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.tool-button.active .shortcut {
  color: var(--accent);
}

/* 2x2 CSS-grid compass so the direction buttons read as a mini d-pad rather
   than an arbitrary row — orientation is grasped at a glance. */
.direction-pad {
  display: grid;
  grid-template-columns: repeat(3, 26px);
  grid-template-rows: repeat(2, 26px);
  gap: 2px;
  justify-content: center;
}

.direction-button {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.slot-up {
  grid-column: 2;
  grid-row: 1;
}

.slot-left {
  grid-column: 1;
  grid-row: 2;
}

.slot-right {
  grid-column: 3;
  grid-row: 2;
}

.slot-down {
  grid-column: 2;
  grid-row: 2;
}

.direction-button:hover:not(:disabled) {
  background: var(--surface-3);
  border-color: var(--border-strong);
}

.direction-button.active {
  background: rgba(76, 175, 125, 0.16);
  border-color: var(--accent);
  color: var(--accent-strong);
}

.direction-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.level-select {
  background: var(--surface-2);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 7px 8px;
  cursor: pointer;
  /* Long hex ids are hidden behind friendly labels; allow a bit more room. */
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.field input {
  width: 62px;
  background: var(--surface-2);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 5px 6px;
}

.ghost-button,
.primary-button,
.play-button {
  border-radius: var(--radius-sm);
  padding: 7px 12px;
  font-size: 0.83rem;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
}

.ghost-button {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
}

.ghost-button:hover {
  background: var(--surface-3);
  border-color: var(--border-strong);
}

.primary-button {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: var(--accent-contrast);
}

.primary-button:hover {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
}

.play-button {
  background: rgba(107, 184, 230, 0.14);
  border: 1px solid rgba(107, 184, 230, 0.45);
  color: #9ed4f5;
}

.play-button:hover:not(:disabled) {
  background: rgba(107, 184, 230, 0.22);
  border-color: #6bb8e6;
}

.play-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ghost-button:active,
.primary-button:active,
.play-button:active:not(:disabled) {
  transform: translateY(1px);
}
</style>
