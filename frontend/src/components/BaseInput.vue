<script setup lang="ts">
import { computed } from "vue";

export interface Props {
  type?: "text" | "email" | "password" | "number" | "search" | "tel" | "url";
  variant?: "default" | "muted";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  placeholder?: string;
  modelValue?: string | number;
  error?: boolean;
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
  // 暖色发丝线输入框；焦点态（terracotta 细描边）在 style.css base 统一
  "rounded-md border bg-surface text-ink transition-colors duration-150",
  "disabled:cursor-not-allowed disabled:bg-surface2 disabled:text-ink3",
  props.fullWidth && "w-full",
  props.size === "sm" && "h-9 px-2.5 text-[13px]",
  props.size === "md" && "h-11 px-3 text-sm",
  props.size === "lg" && "h-12 px-3.5 text-base",
  props.error ? "border-down" : props.variant === "muted" ? "border-hair-soft" : "border-hair-strong",
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
