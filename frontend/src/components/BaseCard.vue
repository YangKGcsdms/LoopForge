<script setup lang="ts">
import { computed } from "vue";

export interface Props {
  /** 卡片变体（保留 API；编辑风一律发丝线、无阴影） */
  variant?: "default" | "elevated" | "outlined";
  /** 卡片尺寸/边距 */
  size?: "sm" | "md" | "lg";
  /** 语义色调（暖色账本：success=绿 / warning=琥珀 / error=红 / info=terracotta） */
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
  // 暖色账本：surface 卡面 + 发丝线分层 + 圆角 ≤12px，无阴影
  "rounded-lg border bg-surface transition-colors duration-150",
  props.size === "sm" && "p-3",
  props.size === "md" && "p-5",
  props.size === "lg" && "p-6",
  // tone：统一发丝线边 + 对应淡底（暖色账本，颜色靠淡底与内文表达，不靠重边框）
  props.tone === "neutral" && "border-hair",
  props.tone === "success" && "border-hair bg-up-bg",
  props.tone === "warning" && "border-hair bg-[rgba(192,138,60,0.12)]",
  props.tone === "error" && "border-hair bg-down-bg",
  props.tone === "info" && "border-hair bg-brand-bg",
  props.interactive && "cursor-pointer hover:border-hair-strong",
]);
</script>

<template>
  <div :class="[computedClass, $attrs.class]">
    <slot />
  </div>
</template>
