<script setup lang="ts">
export interface Props {
  /** 按钮变体 */
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

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="[
      'inline-flex items-center justify-center font-medium transition-all duration-150',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      fullWidth && 'w-full',
      // Size variants
      size === 'sm' && 'px-2.5 py-1.5 text-sm rounded-md',
      size === 'md' && 'px-4 py-2 text-sm rounded-lg',
      size === 'lg' && 'px-6 py-3 text-base rounded-lg',
      // Color variants
      variant === 'primary' && 'bg-slate-900 text-white hover:bg-slate-700 focus:ring-violet-500',
      variant === 'secondary' && 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus:ring-violet-500',
      variant === 'danger' && 'border border-rose-300 text-rose-700 hover:bg-rose-50 focus:ring-rose-500',
      variant === 'ghost' && 'text-slate-700 hover:bg-slate-100 focus:ring-violet-500',
    ]"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>
