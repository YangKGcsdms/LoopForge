<script setup lang="ts">
import { computed } from "vue";

export interface Props {
  modelValue?: string;
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
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
  "rounded-md border border-hair-strong bg-surface text-ink transition-colors duration-150",
  "disabled:cursor-not-allowed disabled:bg-surface2 disabled:text-ink3",
  props.fullWidth && "w-full",
  props.size === "sm" && "h-9 px-2.5 text-[13px]",
  props.size === "md" && "h-11 px-3 text-sm",
  props.size === "lg" && "h-12 px-3.5 text-base",
]);

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit("update:modelValue", target.value);
  emit("change", event);
}
</script>

<template>
  <select :value="modelValue" :disabled="disabled" :class="computedClass" @change="handleChange">
    <slot />
  </select>
</template>
