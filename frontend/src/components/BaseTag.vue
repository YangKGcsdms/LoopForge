<script setup lang="ts">
/**
 * 统一的彩色芯片/标签 —— 全站唯一的"药丸"形状。
 * 颜色由 format.ts 的 tierClass/kindClass/diffClass 传入（语义色集中在 semantic-colors.ts），
 * 形状（圆角/内距/字号）在这里统一，避免各处手写 rounded-* px-* text-xs 造成不一致。
 */
interface Props {
  /** 颜色 class（"bg-xxx text-xxx"），缺省中性灰 */
  color?: string;
  /** 等宽字体（模型名 / ID 等） */
  mono?: boolean;
}

withDefaults(defineProps<Props>(), {
  color: "bg-slate-100 text-slate-700",
  mono: false,
});
</script>

<template>
  <span
    :class="[
      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
      color,
      mono && 'font-mono',
    ]"
  >
    <slot />
  </span>
</template>
