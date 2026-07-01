<script setup lang="ts">
// Orchestrator only: owns tool/direction selection and wires the canvas to
// the sync state machine. No cell data lives in component state — `sync`
// owns the document, `EditorCanvas` owns the viewport and pointer handling.

import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import { listLevels } from "./api.ts";
import EditorCanvas from "./EditorCanvas.vue";
import { buildLevelOptions, labelForLevelId, loadLevelLabels, saveLevelLabel } from "./level-labels.ts";
import { CellKind, SpawnDirection, createEmptyDocument } from "./level-model.ts";
import StatusBar from "./StatusBar.vue";
import { createLevelSync, hasPendingWork } from "./sync.ts";
import Toolbar from "./Toolbar.vue";
import { validateLevel } from "./validation.ts";
import ValidationPanel from "./ValidationPanel.vue";
import { playUrlForLevel } from "../shared/playground.ts";
import type { GridPoint } from "./stroke.ts";

const CLASSIC_LEVEL_ID = "classic";
const NEW_LEVEL_WIDTH = 30;
const NEW_LEVEL_HEIGHT = 20;

const sync = createLevelSync(createEmptyDocument(NEW_LEVEL_WIDTH, NEW_LEVEL_HEIGHT));
const selectedTool = ref<CellKind>(CellKind.Wall);
const selectedDirection = ref<SpawnDirection>(SpawnDirection.Right);
const levels = ref<string[]>([]);
const levelLabels = ref(loadLevelLabels());
const levelOptions = computed(() => buildLevelOptions(levels.value, levelLabels.value));
const currentLevelLabel = computed(() => {
  const id = sync.document.value.id;
  if (id === null) {
    return "Unsaved draft";
  }
  return labelForLevelId(id, levelLabels.value);
});
const hoverCell = ref<GridPoint | null>(null);
const canvasRef = ref<InstanceType<typeof EditorCanvas> | null>(null);

const hasUnsavedEdits = computed(() => hasPendingWork(sync.status.value));

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
  sync.markDirty();
}

function onStrokeEnd(): void {
  sync.notifyChanged();
  void sync.flush();
}

function confirmDiscardPending(): boolean {
  if (!hasUnsavedEdits.value) {
    return true;
  }
  return window.confirm("You have unsaved changes. Discard them and continue?");
}

async function selectLevel(id: string): Promise<void> {
  if (!confirmDiscardPending()) {
    return;
  }
  await sync.load(id);
  canvasRef.value?.fitToDocument();
}

async function createNewLevel(): Promise<void> {
  if (!confirmDiscardPending()) {
    return;
  }
  await sync.createBlank(NEW_LEVEL_WIDTH, NEW_LEVEL_HEIGHT);
  const id = sync.document.value.id;
  if (id !== null) {
    saveLevelLabel(id, `Blank ${NEW_LEVEL_WIDTH}×${NEW_LEVEL_HEIGHT}`);
    levelLabels.value = loadLevelLabels();
  }
  await refreshLevelList();
  canvasRef.value?.fitToDocument();
}

async function onGenerate(seed: number, size: number): Promise<void> {
  if (!confirmDiscardPending()) {
    return;
  }
  await sync.generate(seed, size);
  const id = sync.document.value.id;
  if (id !== null) {
    saveLevelLabel(id, `Generated ${size}×${size} · seed ${seed}`);
    levelLabels.value = loadLevelLabels();
  }
  await refreshLevelList();
  canvasRef.value?.fitToDocument();
}

async function reloadAuthoritative(): Promise<void> {
  await sync.reloadAuthoritative();
  canvasRef.value?.fitToDocument();
}

function retrySave(): void {
  void sync.flush();
}

async function playLevel(): Promise<void> {
  if (hasUnsavedEdits.value) {
    await sync.flush();
    if (hasPendingWork(sync.status.value)) {
      window.alert("Save or resolve conflicts before playing this level.");
      return;
    }
  }

  const id = sync.document.value.id;
  if (id === null) {
    window.alert("This level has no backend id yet.");
    return;
  }

  window.open(playUrlForLevel(id), "_blank", "noopener,noreferrer");
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
  levelLabels.value = loadLevelLabels();
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
    <header class="editor-header">
      <h1 class="title">
        <span class="logo">▪</span>
        Maze Chase
        <span class="title-sub">Level Editor</span>
      </h1>

      <Toolbar
        v-model:tool="selectedTool"
        v-model:direction="selectedDirection"
        :level-options="levelOptions"
        :current-level-id="sync.document.value.id"
        @select-level="selectLevel"
        @new-level="createNewLevel"
        @generate="onGenerate"
        @fit-view="canvasRef?.fitToDocument()"
        @play-level="playLevel"
      />

      <StatusBar
        :level-id="sync.document.value.id"
        :level-label="currentLevelLabel"
        :version="sync.document.value.version"
        :width="sync.document.value.width"
        :height="sync.document.value.height"
        :status="sync.status.value"
        :error-message="sync.errorMessage.value"
        :hover-cell="hoverCell"
        @reload-authoritative="reloadAuthoritative"
        @retry="retrySave"
      />
    </header>

    <section class="workspace">
      <div class="stage">
        <EditorCanvas
          ref="canvasRef"
          :doc="sync.document.value"
          :tool="selectedTool"
          :direction="selectedDirection"
          @dirty="onCanvasDirty"
          @stroke-end="onStrokeEnd"
          @hover-cell="(cell) => (hoverCell = cell)"
        />

        <ValidationPanel v-if="validationIssues.length > 0" class="stage-validation" :issues="validationIssues" />
      </div>

      <p class="hint">Drag to paint · wheel to pan · ctrl/⌘+wheel to zoom · space+drag to pan · 1–6 tools · arrows for direction</p>
    </section>
  </main>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.editor-header {
  flex-shrink: 0;
  background: var(--surface-1);
  border-bottom: 1px solid var(--border-subtle);
}

.title {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 14px 24px 10px;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.logo {
  color: var(--accent);
  font-size: 0.7rem;
}

.title-sub {
  font-weight: 400;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 24px 20px;
  background:
    radial-gradient(900px 500px at 50% 40%, rgba(76, 175, 125, 0.04), transparent),
    var(--surface-0);
}

.stage {
  position: relative;
  flex: 1;
  width: min(100%, 1280px);
  min-height: 0;
  display: flex;
}

.stage-validation {
  position: absolute;
  left: 16px;
  bottom: 16px;
  z-index: 2;
  max-width: min(420px, calc(100% - 32px));
}

.hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-muted);
  text-align: center;
}
</style>
