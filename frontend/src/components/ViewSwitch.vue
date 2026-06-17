<script setup lang="ts">
/**
 * 视图切换段控件 —— 桌面/H5 共用，放两个壳的 header。
 * 三档：自动 / 手机 / 电脑。仅展示与回调，判定与持久化在 useDevice。
 */
import { computed } from "vue";
import type { ViewMode } from "../composables/useDevice";

interface Props {
  mode: ViewMode;
  autoIsMobile?: boolean;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoIsMobile: false,
  compact: false,
});

const emit = defineEmits<{ select: [mode: ViewMode] }>();

const options: Array<{ value: ViewMode; label: string }> = [
  { value: "auto", label: "自动" },
  { value: "mobile", label: "手机" },
  { value: "desktop", label: "电脑" },
];

const autoHint = computed(() => (props.autoIsMobile ? "→手机" : "→电脑"));
</script>

<template>
  <div
    class="inline-flex items-center rounded-md border border-hair bg-surface2 p-0.5"
    role="group"
    aria-label="视图版本切换"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      :aria-pressed="mode === opt.value"
      :class="[
        'rounded font-medium transition-colors duration-150',
        compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-[11px]',
        mode === opt.value ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--border-soft)]' : 'text-ink3 hover:text-ink2',
      ]"
      @click="emit('select', opt.value)"
    >
      {{ opt.label }}
      <span v-if="opt.value === 'auto' && mode === 'auto'" class="ml-0.5 text-ink4">{{ autoHint }}</span>
    </button>
  </div>
</template>
