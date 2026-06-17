<script setup lang="ts">
export interface Props {
  /** 按钮变体：primary=terracotta 实心 / secondary=发丝线 / danger / ghost */
  variant?: "primary" | "secondary" | "danger" | "ghost";
  /** 按钮尺寸 */
  size?: "sm" | "md" | "lg";
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否全宽 */
  fullWidth?: boolean;
  /** 原生 type 属性 */
  type?: "button" | "submit" | "reset";
}

withDefaults(defineProps<Props>(), {
  variant: "primary",
  size: "md",
  disabled: false,
  fullWidth: false,
  type: "button",
});

const emit = defineEmits<{ click: [event: MouseEvent] }>();
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="[
      'inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors duration-150',
      'focus:outline-none focus-visible:ring-1 focus-visible:ring-brand',
      'disabled:cursor-not-allowed disabled:opacity-50',
      fullWidth && 'w-full',
      // 尺寸（编辑风：手感高一点）
      size === 'sm' && 'h-9 px-3 text-[13px]',
      size === 'md' && 'h-11 px-4 text-sm',
      size === 'lg' && 'h-12 px-5 text-base',
      // 变体
      variant === 'primary' && 'border-brand bg-brand text-[#faf5f0] hover:bg-brand-ink hover:border-brand-ink',
      variant === 'secondary' && 'border-hair-strong bg-transparent text-ink hover:bg-surface2',
      variant === 'danger' && 'border-down bg-transparent text-down hover:bg-down-bg',
      variant === 'ghost' && 'border-transparent bg-transparent text-ink2 hover:bg-surface2 hover:text-ink',
    ]"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>
