<script setup lang="ts">
import { computed } from "vue";

import type { ValidationIssue } from "./validation.ts";

const props = defineProps<{
  issues: ValidationIssue[];
}>();

const errorCount = computed(() => props.issues.filter((issue) => issue.severity === "error").length);
const warningCount = computed(() => props.issues.filter((issue) => issue.severity === "warning").length);
</script>

<template>
  <div v-if="issues.length > 0" class="validation-panel">
    <div class="header">
      <span class="title">Validation</span>
      <span v-if="errorCount > 0" class="badge badge--error">{{ errorCount }} error{{ errorCount === 1 ? "" : "s" }}</span>
      <span v-if="warningCount > 0" class="badge badge--warning">{{ warningCount }} warning{{ warningCount === 1 ? "" : "s" }}</span>
    </div>
    <div class="issues">
      <div v-for="issue in issues" :key="issue.message" class="issue" :class="`issue--${issue.severity}`">
        <span class="icon">{{ issue.severity === "error" ? "✕" : "⚠" }}</span>
        {{ issue.message }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.validation-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  background: rgba(18, 18, 20, 0.92);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(8px);
  font-size: 0.8rem;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 999px;
}

.badge--error {
  background: var(--danger-bg);
  color: var(--danger);
}

.badge--warning {
  background: var(--warning-bg);
  color: var(--warning);
}

.issues {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.issue {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon {
  font-size: 0.72rem;
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}

.issue--error {
  color: #f0a0a0;
}

.issue--warning {
  color: #f0c987;
}
</style>
