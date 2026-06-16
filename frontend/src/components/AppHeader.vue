<script setup lang="ts">
import { computed } from "vue";

interface Props {
  /** 当前页标题 */
  title?: string;
  /** 全局运行状态：用于右侧状态点 */
  running?: boolean;
  hasError?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: "",
  running: false,
  hasError: false,
});

const dotClass = computed(() => {
  if (props.hasError) return "bg-rose-500";
  if (props.running) return "bg-violet-600 animate-pulse";
  return "bg-slate-300";
});

const statusText = computed(() => {
  if (props.hasError) return "error";
  if (props.running) return "running";
  return "idle";
});
</script>

<template>
  <header class="app-header">
    <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 font-serif text-sm text-slate-50">
      L
    </div>
    <div class="flex-1">
      <h1 class="font-serif text-base font-normal italic leading-tight tracking-tight text-slate-900">
        LoopForge<span v-if="title" class="ml-2 not-italic font-sans text-[10px] uppercase tracking-widest text-slate-500">{{ title }}</span>
      </h1>
    </div>
    <div class="flex items-center gap-1.5">
      <span :class="['inline-block h-1.5 w-1.5 rounded-full', dotClass]" aria-hidden="true" />
      <span class="font-mono text-[10px] uppercase tracking-wider text-slate-500">{{ statusText }}</span>
    </div>
  </header>
</template>
