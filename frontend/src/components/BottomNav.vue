<script setup lang="ts">
export type TabKey = "run" | "history" | "config" | "about";

defineProps<{ modelValue: TabKey }>();
const emit = defineEmits<{ "update:modelValue": [value: TabKey] }>();

const tabs: { key: TabKey; label: string }[] = [
  { key: "run", label: "运行" },
  { key: "history", label: "历史" },
  { key: "config", label: "配置" },
  { key: "about", label: "关于" },
];
</script>

<template>
  <nav class="bottom-nav">
    <button
      v-for="t in tabs"
      :key="t.key"
      type="button"
      :class="['bottom-nav__item', modelValue === t.key && 'is-active']"
      :aria-current="modelValue === t.key ? 'page' : undefined"
      @click="emit('update:modelValue', t.key)"
    >
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
        <template v-if="t.key === 'run'">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </template>
        <template v-else-if="t.key === 'history'">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </template>
        <template v-else-if="t.key === 'config'">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 11-4 0 2 2 0 014 0zM4 7h7m0 0h9M4 17h9m0 0h7m-7 0a2 2 0 104 0 2 2 0 00-4 0z" />
        </template>
        <template v-else>
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </template>
      </svg>
      <span class="bottom-nav__label">{{ t.label }}</span>
    </button>
  </nav>
</template>
