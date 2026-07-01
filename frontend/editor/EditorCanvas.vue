<script setup lang="ts">
// Single canvas, viewport-bounded rendering, and all pointer interaction
// (pan/zoom/paint). This is the one place per-frame work happens, so it
// intentionally does not hold document content reactively — `doc` is read
// and mutated as a plain object, and only view state (viewport, cursor
// cell) is Vue-reactive.

import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import type { CellKind, LevelDocument, SpawnDirection } from "./level-model.ts";
import {
  clampViewport,
  createRenderer,
  fitViewportToDocument,
  panViewport,
  screenToCell,
  zoomViewport,
  type Viewport,
} from "./renderer.ts";
import { applyStroke, type GridPoint } from "./stroke.ts";

const props = defineProps<{
  doc: LevelDocument;
  tool: CellKind;
  direction: SpawnDirection;
}>();

const emit = defineEmits<{
  dirty: [];
  "stroke-end": [];
  "hover-cell": [cell: GridPoint | null];
}>();

const canvasEl = ref<HTMLCanvasElement | null>(null);
const containerEl = ref<HTMLDivElement | null>(null);
const renderer = createRenderer();
const isPanningState = ref(false);
const spaceHeldState = ref(false);

const viewport = ref<Viewport>({ originX: 0, originY: 0, cellSize: 16 });
const zoomPercent = computed(() => Math.round(viewport.value.cellSize * 100));
const cursorClass = computed(() => (isPanningState.value ? "panning" : spaceHeldState.value ? "pan-ready" : "painting"));
let canvasWidth = 0;
let canvasHeight = 0;
let devicePixelRatio = 1;

let isPainting = false;
let isPanning = false;
let spaceHeld = false;
let lastPaintCell: GridPoint | null = null;
let panStart: { sx: number; sy: number; originX: number; originY: number } | null = null;

function resizeCanvas(): void {
  const canvas = canvasEl.value;
  const container = containerEl.value;
  if (canvas === null || container === null) {
    return;
  }
  devicePixelRatio = window.devicePixelRatio || 1;
  canvasWidth = container.clientWidth;
  canvasHeight = container.clientHeight;
  canvas.width = Math.round(canvasWidth * devicePixelRatio);
  canvas.height = Math.round(canvasHeight * devicePixelRatio);
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  viewport.value = clampViewport(viewport.value, props.doc, canvasWidth, canvasHeight);
  draw();
}

function draw(): void {
  const canvas = canvasEl.value;
  if (canvas === null) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return;
  }
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  renderer.render(ctx, props.doc, viewport.value, canvasWidth, canvasHeight);
}

function fitToDocument(): void {
  viewport.value = fitViewportToDocument(props.doc, canvasWidth, canvasHeight);
  draw();
}

function zoomAt(sx: number, sy: number, factor: number): void {
  viewport.value = clampViewport(zoomViewport(viewport.value, sx, sy, factor), props.doc, canvasWidth, canvasHeight);
  draw();
}

function panBy(dx: number, dy: number): void {
  viewport.value = clampViewport(panViewport(viewport.value, dx, dy), props.doc, canvasWidth, canvasHeight);
  draw();
}

function pointerPos(event: PointerEvent): { sx: number; sy: number } {
  const canvas = canvasEl.value;
  const rect = canvas!.getBoundingClientRect();
  return { sx: event.clientX - rect.left, sy: event.clientY - rect.top };
}

function paintAt(sx: number, sy: number): void {
  const cell = screenToCell(viewport.value, sx, sy);
  const changed = applyStroke(props.doc, lastPaintCell, cell, props.tool, props.direction);
  lastPaintCell = cell;
  if (changed) {
    draw();
    emit("dirty");
  }
}

function capturePointer(pointerId: number): void {
  // Guards environments/synthetic events where the browser has no active
  // pointer session to capture (setPointerCapture then throws); painting
  // still works without capture, it just won't survive leaving the canvas.
  try {
    canvasEl.value?.setPointerCapture(pointerId);
  } catch {
    // Non-fatal: see comment above.
  }
}

function onPointerDown(event: PointerEvent): void {
  const { sx, sy } = pointerPos(event);
  const wantsPan = spaceHeld || event.button === 1;
  if (wantsPan) {
    isPanning = true;
    isPanningState.value = true;
    panStart = { sx, sy, originX: viewport.value.originX, originY: viewport.value.originY };
    capturePointer(event.pointerId);
    return;
  }
  if (event.button !== 0) {
    return;
  }
  isPainting = true;
  lastPaintCell = null;
  capturePointer(event.pointerId);
  paintAt(sx, sy);
}

function onPointerMove(event: PointerEvent): void {
  const { sx, sy } = pointerPos(event);
  if (isPanning && panStart !== null) {
    // Recompute from the fixed pan-start snapshot (not incrementally) so
    // rounding never compounds across many pointermove events.
    const candidate: Viewport = {
      ...viewport.value,
      originX: panStart.originX - (sx - panStart.sx) / viewport.value.cellSize,
      originY: panStart.originY - (sy - panStart.sy) / viewport.value.cellSize,
    };
    viewport.value = clampViewport(candidate, props.doc, canvasWidth, canvasHeight);
    draw();
    return;
  }
  if (isPainting) {
    paintAt(sx, sy);
    return;
  }
  emit("hover-cell", screenToCell(viewport.value, sx, sy));
}

function endStroke(): void {
  if (isPainting) {
    isPainting = false;
    lastPaintCell = null;
    emit("stroke-end");
  }
  isPanning = false;
  isPanningState.value = false;
  panStart = null;
}

function onWheel(event: WheelEvent): void {
  event.preventDefault();
  const rect = canvasEl.value!.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;
  if (event.ctrlKey || event.metaKey) {
    const factor = Math.exp(-event.deltaY * 0.01);
    zoomAt(sx, sy, factor);
  } else {
    panBy(event.deltaX, event.deltaY);
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.code === "Space") {
    spaceHeld = true;
    spaceHeldState.value = true;
  }
}

function onKeyUp(event: KeyboardEvent): void {
  if (event.code === "Space") {
    spaceHeld = false;
    spaceHeldState.value = false;
  }
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  resizeObserver = new ResizeObserver(() => resizeCanvas());
  if (containerEl.value !== null) {
    resizeObserver.observe(containerEl.value);
  }
  resizeCanvas();
  fitToDocument();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
});

// Deliberately no watcher on `props.doc`: every place that swaps in a
// genuinely different document (load/generate/new) already calls
// `fitToDocument()` explicitly from App.vue. A reference-based watch would
// also fire on routine autosave metadata updates (id/version refresh keeps
// the same cells/directions arrays) and reset the user's pan/zoom mid-edit.
defineExpose({ fitToDocument });
</script>

<template>
  <div ref="containerEl" class="canvas-shell">
    <canvas
      ref="canvasEl"
      class="editor-canvas"
      :class="cursorClass"
      role="img"
      aria-label="Level grid canvas: drag to paint, wheel to pan, ctrl+wheel to zoom"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endStroke"
      @pointercancel="endStroke"
      @pointerleave="endStroke"
      @wheel="onWheel"
      @contextmenu.prevent
    />
    <span class="zoom-badge">{{ zoomPercent }}%</span>
  </div>
</template>

<style scoped>
.canvas-shell {
  position: relative;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  background:
    radial-gradient(ellipse at center, rgba(255, 255, 255, 0.02), transparent 70%),
    #0a0a0e;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-strong);
  box-shadow:
    var(--shadow-md),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.editor-canvas {
  display: block;
  touch-action: none;
  cursor: crosshair;
}

.editor-canvas.pan-ready {
  cursor: grab;
}

.editor-canvas.panning {
  cursor: grabbing;
}

.zoom-badge {
  position: absolute;
  right: 12px;
  bottom: 12px;
  background: rgba(18, 18, 20, 0.85);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  padding: 3px 9px;
  border-radius: 999px;
  pointer-events: none;
  backdrop-filter: blur(4px);
}
</style>
