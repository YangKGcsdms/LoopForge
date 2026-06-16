<script setup lang="ts">
import { computed } from "vue";

export type StatusType = "running" | "completed" | "error" | "pending" | "idle";

export interface Props {
  /** 状态类型：运行中/完成/错误/等待中/空闲 */
  status: StatusType;
  /** 自定义文本内容，默认使用状态值本身 */
  label?: string;
  /** 是否禁用交互 */
  disabled?: boolean;
  /** 是否为紧凑尺寸 */
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  compact: false,
});

const statusConfig = {
  running: {
    bg: "bg-violet-100",
    text: "text-violet-700",
    border: "border-violet-200",
    dot: "bg-violet-600",
    label: "运行中",
  },
  completed: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
    dot: "bg-emerald-600",
    label: "完成",
  },
  error: {
    bg: "bg-rose-100",
    text: "text-rose-800",
    border: "border-rose-300",
    dot: "bg-rose-600",
    label: "错误",
  },
  pending: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
    dot: "bg-amber-600",
    label: "等待中",
  },
  idle: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-300",
    dot: "bg-slate-600",
    label: "空闲",
  },
};

const config = computed(() => statusConfig[props.status]);

const displayLabel = computed(() => props.label || config.value.label);

const containerClass = computed(() => [
  "inline-flex items-center gap-2 rounded-full border transition-all duration-150",
  props.compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
  config.value.bg,
  config.value.text,
  config.value.border,
  // Disabled state
  props.disabled && "opacity-60 cursor-not-allowed",
  // Hover/Focus only when enabled
  !props.disabled && "hover:shadow-sm focus-within:ring-2 focus-within:ring-offset-1",
]);

const dotClass = computed(() => [
  "inline-block rounded-full animate-pulse",
  props.compact ? "h-1.5 w-1.5" : "h-2 w-2",
  config.value.dot,
  // Only animate for running status
  props.status !== "running" && "animate-none",
]);
</script>

<template>
  <div
    :class="containerClass"
    :aria-busy="status === 'running'"
    :aria-disabled="disabled"
    role="status"
  >
    <span :class="dotClass" aria-hidden="true" />
    <span class="font-medium">{{ displayLabel }}</span>
  </div>
</template>
