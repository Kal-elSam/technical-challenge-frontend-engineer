<script setup lang="ts">
import { ref } from "vue";

import { CellKind, SpawnDirection } from "./level-model.ts";

const tool = defineModel<CellKind>("tool", { required: true });
const direction = defineModel<SpawnDirection>("direction", { required: true });

defineProps<{
  levels: string[];
  currentLevelId: string | null;
}>();

const emit = defineEmits<{
  "select-level": [id: string];
  "new-level": [];
  generate: [seed: number, size: number];
  "fit-view": [];
}>();

const TOOLS: Array<{ kind: CellKind; label: string; hint: string; shortcut: string }> = [
  { kind: CellKind.Empty, label: "Empty", hint: "Clear a cell", shortcut: "1" },
  { kind: CellKind.Wall, label: "Wall", hint: "Paint a wall", shortcut: "2" },
  { kind: CellKind.Pellet, label: "Pellet", hint: "Paint a pellet", shortcut: "3" },
  { kind: CellKind.PowerPellet, label: "Power", hint: "Paint a power pellet", shortcut: "4" },
  { kind: CellKind.Player, label: "Player", hint: "Place player spawn", shortcut: "5" },
  { kind: CellKind.Ghost, label: "Ghost", hint: "Place ghost spawn", shortcut: "6" },
];

const DIRECTIONS: Array<{ dir: SpawnDirection; label: string }> = [
  { dir: SpawnDirection.Up, label: "↑" },
  { dir: SpawnDirection.Right, label: "→" },
  { dir: SpawnDirection.Down, label: "↓" },
  { dir: SpawnDirection.Left, label: "←" },
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
          {{ entry.label }}
          <span class="shortcut">{{ entry.shortcut }}</span>
        </button>
      </div>
    </div>

    <div class="group" :class="{ disabled: !needsDirection(tool) }">
      <span class="group-label">Direction</span>
      <div class="direction-buttons">
        <button
          v-for="entry in DIRECTIONS"
          :key="entry.dir"
          type="button"
          class="direction-button"
          :class="{ active: direction === entry.dir }"
          :disabled="!needsDirection(tool)"
          @click="direction = entry.dir"
        >
          {{ entry.label }}
        </button>
      </div>
    </div>

    <div class="group">
      <span class="group-label">Level</span>
      <select :value="currentLevelId ?? ''" class="level-select" @change="emit('select-level', ($event.target as HTMLSelectElement).value)">
        <option v-for="id in levels" :key="id" :value="id">{{ id }}</option>
      </select>
      <button type="button" class="ghost-button" @click="emit('new-level')">New</button>
      <button type="button" class="ghost-button" @click="emit('fit-view')">Fit view</button>
    </div>

    <div class="group">
      <span class="group-label">Generate</span>
      <label class="field">
        seed
        <input v-model.number="seed" type="number" />
      </label>
      <label class="field">
        size
        <input v-model.number="size" type="number" min="15" max="1000" />
      </label>
      <button type="button" class="ghost-button" @click="onGenerate">Generate</button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-end;
  padding: 10px 16px;
  background: #202020;
  border-bottom: 1px solid #333333;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group.disabled {
  opacity: 0.4;
}

.group-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #999999;
}

.tool-buttons,
.direction-buttons {
  display: flex;
  gap: 4px;
}

.tool-button,
.direction-button,
.ghost-button {
  background: #2c2c2c;
  border: 1px solid #3d3d3d;
  color: #f0f0f0;
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-button:hover,
.direction-button:hover:not(:disabled),
.ghost-button:hover {
  background: #383838;
}

.tool-button.active,
.direction-button.active {
  background: #4caf50;
  border-color: #4caf50;
  color: #101010;
}

.direction-button:disabled {
  cursor: not-allowed;
}

.shortcut {
  font-size: 0.7rem;
  color: #888888;
}

.tool-button.active .shortcut {
  color: #1a3a1a;
}

.level-select {
  background: #2c2c2c;
  color: #f0f0f0;
  border: 1px solid #3d3d3d;
  border-radius: 4px;
  padding: 6px 8px;
}

.field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: #aaaaaa;
}

.field input {
  width: 70px;
  background: #2c2c2c;
  color: #f0f0f0;
  border: 1px solid #3d3d3d;
  border-radius: 4px;
  padding: 4px 6px;
}
</style>
