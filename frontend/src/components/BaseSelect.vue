<script setup lang="ts">
import { computed } from "vue";

export interface Props {
  /** 选择框类型 */
  modelValue?: string;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 完整宽度 */
  fullWidth?: boolean;
  /** 尺寸 */
  size?: "sm" | "md" | "lg";
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  fullWidth: false,
  size: "md",
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  change: [event: Event];
}>();

const computedClass = computed(() => [
  'rounded-lg border bg-white transition-colors duration-150',
  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500',
  'focus:border-violet-600',
  'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
  'text-slate-900',
  props.fullWidth && 'w-full',
  // Size variants
  props.size === 'sm' && 'px-2.5 py-1.5 text-sm',
  props.size === 'md' && 'px-3 py-2 text-sm',
  props.size === 'lg' && 'px-4 py-3 text-base',
  'border-slate-300',
]);

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit("update:modelValue", target.value);
  emit("change", event);
}
</script>

<template>
  <select
    :value="modelValue"
    :disabled="disabled"
    :class="computedClass"
    @change="handleChange"
  >
    <slot />
  </select>
</template>
