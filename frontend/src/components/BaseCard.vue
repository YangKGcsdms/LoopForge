<script setup lang="ts">
import { computed } from "vue";

export interface Props {
  /** 卡片变体 */
  variant?: "default" | "elevated" | "outlined";
  /** 卡片尺寸/边距 */
  size?: "sm" | "md" | "lg";
  /** 背景色调 */
  tone?: "neutral" | "success" | "warning" | "error" | "info";
  /** 是否可交互（悬停效果） */
  interactive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "default",
  size: "md",
  tone: "neutral",
  interactive: false,
});

const computedClass = computed(() => [
  'rounded-lg border transition-all duration-150',
  // Size variants
  props.size === 'sm' && 'p-3 rounded-md',
  props.size === 'md' && 'p-6',
  props.size === 'lg' && 'p-8 rounded-xl',
  // Style variants
  props.variant === 'default' && 'bg-slate-50 border-slate-200',
  props.variant === 'elevated' && 'bg-slate-50 border-slate-200 shadow-md',
  props.variant === 'outlined' && 'bg-slate-50 border-2',
  // Tone variants
  props.tone === 'neutral' && (
    props.variant === 'outlined'
      ? 'border-slate-300'
      : ''
  ),
  props.tone === 'success' && (
    props.variant === 'outlined'
      ? 'border-emerald-300 bg-emerald-50'
      : 'border-emerald-200 bg-emerald-50'
  ),
  props.tone === 'warning' && (
    props.variant === 'outlined'
      ? 'border-amber-300 bg-amber-50'
      : 'border-amber-200 bg-amber-50'
  ),
  props.tone === 'error' && (
    props.variant === 'outlined'
      ? 'border-rose-300 bg-rose-50'
      : 'border-rose-200 bg-rose-50'
  ),
  props.tone === 'info' && (
    props.variant === 'outlined'
      ? 'border-sky-300 bg-sky-50'
      : 'border-sky-200 bg-sky-50'
  ),
  // Interactive state
  props.interactive && 'cursor-pointer hover:shadow-md hover:border-slate-300',
]);
</script>

<template>
  <div :class="[computedClass, $attrs.class]">
    <slot />
  </div>
</template>
