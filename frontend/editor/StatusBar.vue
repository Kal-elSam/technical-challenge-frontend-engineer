<script setup lang="ts">
import { computed } from "vue";

import type { SyncStatus } from "./sync.ts";

const props = defineProps<{
  levelId: string | null;
  levelLabel: string;
  version: number | null;
  width: number;
  height: number;
  status: SyncStatus;
  errorMessage: string | null;
  hoverCell: { x: number; y: number } | null;
  canDeleteLevel: boolean;
}>();

const emit = defineEmits<{
  "reload-authoritative": [];
  retry: [];
  "delete-level": [];
}>();

const STATUS_LABEL: Record<SyncStatus, string> = {
  loading: "Loading…",
  clean: "Saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  conflict: "Conflict",
  // Covers both save and load failures (e.g. a corrupt/unparseable board
  // fetched from the backend) — the banner text below carries the specifics.
  error: "Error",
};

const statusClass = computed(() => `status status--${props.status}`);
const isBusy = computed(() => props.status === "loading" || props.status === "saving");
</script>

<template>
  <div class="status-bar">
    <span class="chip" :title="levelId ?? 'No backend id yet'">
      <span class="chip-icon">◇</span>
      {{ levelLabel }}
    </span>
    <span class="chip" title="Version">v{{ version ?? "–" }}</span>
    <span class="chip" title="Grid dimensions">{{ width }}×{{ height }}</span>
    <span v-if="hoverCell" class="chip chip--muted" title="Cell under cursor">{{ hoverCell.x }}, {{ hoverCell.y }}</span>

    <span :class="statusClass">
      <span v-if="isBusy" class="spinner" />
      <span v-else class="status-dot" />
      {{ STATUS_LABEL[status] }}
    </span>

    <div v-if="status === 'conflict'" class="banner banner--conflict">
      <span class="banner-icon">⚠</span>
      <span>{{ errorMessage ?? "This level changed on the server." }}</span>
      <button type="button" @click="emit('reload-authoritative')">Reload authoritative version</button>
    </div>

    <div v-else-if="status === 'error'" class="banner banner--error">
      <span class="banner-icon">✕</span>
      <span>{{ errorMessage ?? "Could not reach the server." }}</span>
      <button type="button" @click="emit('retry')">Retry</button>
      <button
        v-if="canDeleteLevel"
        type="button"
        class="banner-button--danger"
        @click="emit('delete-level')"
      >
        Delete level
      </button>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px 12px;
  background: var(--surface-0);
  border-top: 1px solid var(--border-subtle);
  font-size: 0.8rem;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 4px 9px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.chip--muted {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.chip-icon {
  color: var(--accent);
  font-size: 0.7rem;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px;
  border-radius: 999px;
  font-weight: 600;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.spinner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status--loading {
  background: var(--surface-3);
  color: var(--text-primary);
}

.status--clean {
  background: rgba(76, 175, 125, 0.16);
  color: var(--accent-strong);
}

.status--dirty {
  background: var(--warning-bg);
  color: var(--warning);
}

.status--saving {
  background: var(--info-bg);
  color: var(--info);
}

.status--conflict,
.status--error {
  background: var(--danger-bg);
  color: var(--danger);
}

.banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-basis: 100%;
  padding: 5px 12px;
  border-radius: var(--radius-sm);
}

.banner-icon {
  font-size: 0.8rem;
}

.banner--conflict {
  background: var(--warning-bg);
  color: #f0c987;
}

.banner--error {
  background: var(--danger-bg);
  color: #f0a0a0;
}

.banner button {
  background: var(--accent);
  border: none;
  color: var(--accent-contrast);
  border-radius: var(--radius-sm);
  padding: 5px 11px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.78rem;
  transition: background var(--transition-fast);
}

.banner button:hover {
  background: var(--accent-strong);
}

.banner-button--danger {
  background: rgba(224, 96, 96, 0.22) !important;
  color: #ffd0d0 !important;
}

.banner-button--danger:hover {
  background: rgba(224, 96, 96, 0.35) !important;
}
</style>
