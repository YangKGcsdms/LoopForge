<script setup lang="ts">
/**
 * 统一的色调芯片 —— 全站唯一的小"药丸"。
 * 颜色由 format.ts 的 tierClass/kindClass/diffClass 注入（.tone-* 暖色调，集中在 style.css）。
 * 形状（圆角/内距/字号/字距）在这里统一，避免各处手写。
 */
interface Props {
  /** 色调 class（.tone-*），缺省中性 */
  color?: string;
  /** 等宽字体（模型名 / ID 等） */
  mono?: boolean;
}

withDefaults(defineProps<Props>(), {
  color: "tone-mute",
  mono: false,
});
</script>

<template>
  <span
    :class="[
      'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none tracking-wide',
      color,
      mono && 'font-mono',
    ]"
  >
    <slot />
  </span>
</template>
