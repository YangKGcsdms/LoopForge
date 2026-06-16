<script setup lang="ts">
import { computed } from "vue";

export interface Props {
  /** 输入框类型 */
  type?: "text" | "email" | "password" | "number" | "search" | "tel" | "url";
  /** 输入框变体 */
  variant?: "default" | "muted";
  /** 输入框尺寸 */
  size?: "sm" | "md" | "lg";
  /** 是否禁用 */
  disabled?: boolean;
  /** 占位符 */
  placeholder?: string;
  /** 当前值 */
  modelValue?: string | number;
  /** 错误状态 */
  error?: boolean;
  /** 完整宽度 */
  fullWidth?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  type: "text",
  variant: "default",
  size: "md",
  disabled: false,
  fullWidth: false,
  error: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string | number];
  input: [event: Event];
  change: [event: Event];
  focus: [event: FocusEvent];
  blur: [event: FocusEvent];
}>();

const computedClass = computed(() => [
  'rounded-lg border bg-white transition-colors duration-150',
  'focus:outline-none focus:ring-2 focus:ring-offset-2',
  'placeholder:text-slate-500',
  'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
  'text-slate-900',
  props.fullWidth && 'w-full',
  // Size variants
  props.size === 'sm' && 'px-2.5 py-1.5 text-sm',
  props.size === 'md' && 'px-3 py-2 text-sm',
  props.size === 'lg' && 'px-4 py-3 text-base',
  // Color variants
  props.error
    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500'
    : props.variant === 'muted'
      ? 'border-slate-200 text-slate-700 focus:border-slate-400 focus:ring-violet-500'
      : 'border-slate-300 focus:border-violet-600 focus:ring-violet-500',
]);

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit("update:modelValue", props.type === "number" ? target.valueAsNumber : target.value);
  emit("input", event);
}
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="computedClass"
    @input="handleInput"
    @change="emit('change', $event)"
    @focus="emit('focus', $event)"
    @blur="emit('blur', $event)"
  />
</template>
