<script setup lang="ts">
// Orchestrator only: owns tool/direction selection and wires the canvas to
// the sync state machine. No cell data lives in component state — `sync`
// owns the document, `EditorCanvas` owns the viewport and pointer handling.

import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import { listLevels } from "./api.ts";
import EditorCanvas from "./EditorCanvas.vue";
import { CellKind, SpawnDirection, createEmptyDocument } from "./level-model.ts";
import StatusBar from "./StatusBar.vue";
import { createLevelSync } from "./sync.ts";
import Toolbar from "./Toolbar.vue";
import { validateLevel } from "./validation.ts";
import ValidationPanel from "./ValidationPanel.vue";
import type { GridPoint } from "./stroke.ts";

const CLASSIC_LEVEL_ID = "classic";
const NEW_LEVEL_WIDTH = 30;
const NEW_LEVEL_HEIGHT = 20;

const sync = createLevelSync(createEmptyDocument(NEW_LEVEL_WIDTH, NEW_LEVEL_HEIGHT));
const selectedTool = ref<CellKind>(CellKind.Wall);
const selectedDirection = ref<SpawnDirection>(SpawnDirection.Right);
const levels = ref<string[]>([]);
const hoverCell = ref<GridPoint | null>(null);
const hasUnsavedEdits = ref(false);
const canvasRef = ref<InstanceType<typeof EditorCanvas> | null>(null);

const validationIssues = computed(() => validateLevel(sync.document.value));

async function refreshLevelList(): Promise<void> {
  try {
    levels.value = await listLevels();
  } catch {
    // Listing is a convenience for the level picker; a failure here should
    // not block editing the level already loaded.
  }
}

function onCanvasDirty(): void {
  hasUnsavedEdits.value = true;
  sync.markDirty();
}

function onStrokeEnd(): void {
  sync.notifyChanged();
  void sync.flush().then(() => {
    hasUnsavedEdits.value = sync.status.value === "dirty" || sync.status.value === "error";
  });
}

async function selectLevel(id: string): Promise<void> {
  await sync.load(id);
  hasUnsavedEdits.value = false;
  canvasRef.value?.fitToDocument();
}

async function createNewLevel(): Promise<void> {
  await sync.createBlank(NEW_LEVEL_WIDTH, NEW_LEVEL_HEIGHT);
  hasUnsavedEdits.value = false;
  await refreshLevelList();
  canvasRef.value?.fitToDocument();
}

async function onGenerate(seed: number, size: number): Promise<void> {
  await sync.generate(seed, size);
  hasUnsavedEdits.value = false;
  await refreshLevelList();
  canvasRef.value?.fitToDocument();
}

async function reloadAuthoritative(): Promise<void> {
  await sync.reloadAuthoritative();
  hasUnsavedEdits.value = false;
  canvasRef.value?.fitToDocument();
}

function retrySave(): void {
  void sync.flush();
}

const TOOL_SHORTCUTS: Record<string, CellKind> = {
  "1": CellKind.Empty,
  "2": CellKind.Wall,
  "3": CellKind.Pellet,
  "4": CellKind.PowerPellet,
  "5": CellKind.Player,
  "6": CellKind.Ghost,
};

const DIRECTION_SHORTCUTS: Record<string, SpawnDirection> = {
  ArrowUp: SpawnDirection.Up,
  ArrowRight: SpawnDirection.Right,
  ArrowDown: SpawnDirection.Down,
  ArrowLeft: SpawnDirection.Left,
};

function isTypingIntoField(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
}

function onKeyDown(event: KeyboardEvent): void {
  if (isTypingIntoField(event.target)) {
    return;
  }
  const tool = TOOL_SHORTCUTS[event.key];
  if (tool !== undefined) {
    selectedTool.value = tool;
    return;
  }
  const direction = DIRECTION_SHORTCUTS[event.key];
  if (direction !== undefined) {
    selectedDirection.value = direction;
    event.preventDefault();
  }
}

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!hasUnsavedEdits.value) {
    return;
  }
  event.preventDefault();
  event.returnValue = "";
}

onMounted(() => {
  void sync.load(CLASSIC_LEVEL_ID).then(() => canvasRef.value?.fitToDocument());
  void refreshLevelList();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("beforeunload", onBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("beforeunload", onBeforeUnload);
  sync.dispose();
});
</script>

<template>
  <main class="editor">
    <h1 class="title">Maze Chase — Level Editor</h1>

    <Toolbar
      v-model:tool="selectedTool"
      v-model:direction="selectedDirection"
      :levels="levels"
      :current-level-id="sync.document.value.id"
      @select-level="selectLevel"
      @new-level="createNewLevel"
      @generate="onGenerate"
      @fit-view="canvasRef?.fitToDocument()"
    />

    <StatusBar
      :level-id="sync.document.value.id"
      :version="sync.document.value.version"
      :width="sync.document.value.width"
      :height="sync.document.value.height"
      :status="sync.status.value"
      :error-message="sync.errorMessage.value"
      :hover-cell="hoverCell"
      @reload-authoritative="reloadAuthoritative"
      @retry="retrySave"
    />

    <ValidationPanel :issues="validationIssues" />

    <div class="canvas-area">
      <EditorCanvas
        ref="canvasRef"
        :doc="sync.document.value"
        :tool="selectedTool"
        :direction="selectedDirection"
        @dirty="onCanvasDirty"
        @stroke-end="onStrokeEnd"
        @hover-cell="(cell) => (hoverCell = cell)"
      />
    </div>
  </main>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.title {
  margin: 0;
  padding: 10px 16px;
  font-size: 1rem;
  background: #161616;
  border-bottom: 1px solid #2a2a2a;
}

.canvas-area {
  flex: 1;
  min-height: 0;
}
</style>
