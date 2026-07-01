<script setup lang="ts">
import { computed } from "vue";

import type { SyncStatus } from "./sync.ts";

const props = defineProps<{
  levelId: string | null;
  version: number | null;
  width: number;
  height: number;
  status: SyncStatus;
  errorMessage: string | null;
  hoverCell: { x: number; y: number } | null;
}>();

const emit = defineEmits<{
  "reload-authoritative": [];
  retry: [];
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
</script>

<template>
  <div class="status-bar">
    <span class="chip">{{ levelId ?? "unsaved" }}</span>
    <span class="chip">v{{ version ?? "–" }}</span>
    <span class="chip">{{ width }}×{{ height }}</span>
    <span v-if="hoverCell" class="chip">{{ hoverCell.x }}, {{ hoverCell.y }}</span>
    <span :class="statusClass">{{ STATUS_LABEL[status] }}</span>

    <div v-if="status === 'conflict'" class="banner banner--conflict">
      <span>{{ errorMessage ?? "This level changed on the server." }}</span>
      <button type="button" @click="emit('reload-authoritative')">Reload authoritative version</button>
    </div>

    <div v-else-if="status === 'error'" class="banner banner--error">
      <span>{{ errorMessage ?? "Could not reach the server." }}</span>
      <button type="button" @click="emit('retry')">Retry</button>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: #181818;
  border-bottom: 1px solid #2a2a2a;
  font-size: 0.8rem;
  flex-wrap: wrap;
}

.chip {
  background: #262626;
  border-radius: 4px;
  padding: 3px 8px;
  color: #cccccc;
}

.status {
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 600;
}

.status--loading {
  background: #444444;
  color: #eeeeee;
}

.status--clean {
  background: #1f4d24;
  color: #8bd794;
}

.status--dirty {
  background: #4d4419;
  color: #e6c65a;
}

.status--saving {
  background: #1e3a4d;
  color: #7fc3e6;
}

.status--conflict,
.status--error {
  background: #4d1f1f;
  color: #e68a8a;
}

.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  padding: 4px 10px;
  border-radius: 4px;
}

.banner--conflict {
  background: #3a2a10;
  color: #f0c987;
}

.banner--error {
  background: #3a1010;
  color: #f0a0a0;
}

.banner button {
  background: #4caf50;
  border: none;
  color: #101010;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
  font-weight: 600;
}
</style>
