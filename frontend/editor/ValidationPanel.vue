<script setup lang="ts">
import type { ValidationIssue } from "./validation.ts";

defineProps<{
  issues: ValidationIssue[];
}>();
</script>

<template>
  <div v-if="issues.length > 0" class="validation-panel">
    <div v-for="issue in issues" :key="issue.message" class="issue" :class="`issue--${issue.severity}`">
      <span class="dot" />
      {{ issue.message }}
    </div>
  </div>
</template>

<style scoped>
.validation-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 16px;
  background: #181818;
  border-bottom: 1px solid #2a2a2a;
  font-size: 0.8rem;
}

.issue {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.issue--error {
  color: #f0a0a0;
}

.issue--error .dot {
  background: #e05555;
}

.issue--warning {
  color: #f0c987;
}

.issue--warning .dot {
  background: #e6b800;
}
</style>
