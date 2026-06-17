<script setup lang="ts">
import { computed } from "vue";

export type StatusType = "running" | "completed" | "error" | "pending" | "idle";

export interface Props {
  /** 状态类型：运行中/完成/错误/等待中/空闲 */
  status: StatusType;
  /** 自定义文本内容，默认使用状态名 */
  label?: string;
  /** 是否禁用交互 */
  disabled?: boolean;
  /** 紧凑尺寸 */
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  compact: false,
});

// 暖色账本语义：运行=terracotta，完成=账本绿，错误=账本红，等待=琥珀，空闲=墨灰
const statusConfig: Record<StatusType, { dot: string; text: string; label: string }> = {
  running: { dot: "bg-brand", text: "text-brand-ink", label: "运行中" },
  completed: { dot: "bg-up", text: "text-up", label: "完成" },
  error: { dot: "bg-down", text: "text-down", label: "错误" },
  pending: { dot: "bg-acc-amber", text: "text-acc-amber", label: "等待中" },
  idle: { dot: "bg-ink3", text: "text-ink3", label: "空闲" },
};

const config = computed(() => statusConfig[props.status]);
const displayLabel = computed(() => props.label || config.value.label);
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 font-medium uppercase tracking-caps',
      compact ? 'text-[10px]' : 'text-[11px]',
      config.text,
      disabled && 'opacity-60',
    ]"
    :aria-busy="status === 'running'"
    role="status"
  >
    <span
      :class="[
        'inline-block rounded-full',
        compact ? 'h-1.5 w-1.5' : 'h-2 w-2',
        config.dot,
        status === 'running' && 'animate-pulse',
      ]"
      aria-hidden="true"
    />
    {{ displayLabel }}
  </span>
</template>
