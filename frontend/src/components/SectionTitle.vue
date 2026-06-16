<script setup lang="ts">
import { computed } from "vue";

export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export interface Props {
  /** 标题文本 */
  title: string;
  /** 标题层级：h1-h6，控制字体大小和权重 */
  level?: HeadingLevel;
  /** 副标题/描述文本 */
  description?: string;
  /** 是否显示下边界线 */
  divider?: boolean;
  /** 下边界线颜色 */
  dividerColor?: "neutral" | "subtle" | "accent";
  /** 内容间距 */
  spacing?: "sm" | "md" | "lg";
  /** 是否禁用（禁用态会降低视觉强度） */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  level: "h2",
  divider: true,
  dividerColor: "neutral",
  spacing: "md",
  disabled: false,
});

// 标题层级到 Tailwind 类的映射
const levelClasses = {
  h1: "font-serif text-4xl font-normal leading-tight tracking-tight",
  h2: "font-serif text-2xl font-normal tracking-tight",
  h3: "font-serif text-xl font-normal tracking-tight",
  h4: "text-lg font-semibold",
  h5: "text-base font-medium",
  h6: "text-sm font-medium",
};

// 标题容器间距
const spacingClasses = {
  sm: "pb-2",
  md: "pb-4",
  lg: "pb-6",
};

// 下边界线颜色
const dividerClasses = {
  neutral: "border-slate-200",
  subtle: "border-slate-100",
  accent: "border-slate-300",
};

const titleClass = computed(() => [
  levelClasses[props.level],
  "transition-colors duration-150",
  props.disabled && "opacity-60 text-slate-400",
  !props.disabled && "text-slate-900",
]);

const containerClass = computed(() => [
  "flex flex-col",
  spacingClasses[props.spacing],
  props.divider && [
    "border-b",
    dividerClasses[props.dividerColor],
  ],
]);

const descriptionClass = computed(() => [
  "mt-1 text-sm leading-relaxed",
  "transition-colors duration-150",
  props.disabled && "opacity-60 text-slate-500",
  !props.disabled && "text-slate-700",
]);
</script>

<template>
  <div :class="containerClass">
    <component
      :is="props.level"
      :class="titleClass"
      :aria-disabled="disabled"
    >
      <slot name="prefix" />
      {{ title }}
      <slot name="suffix" />
    </component>
    <p v-if="description" :class="descriptionClass">
      {{ description }}
    </p>
    <slot />
  </div>
</template>
