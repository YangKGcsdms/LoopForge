<script setup lang="ts">
/** 主题切换：单按钮循环 自动 ◐ → 浅色 ○ → 深色 ●（取自 carter_book）。 */
import { useTheme, THEME_ICON, THEME_LABEL } from "../composables/useTheme";

const { theme, cycle } = useTheme();
</script>

<template>
  <button
    type="button"
    class="flex h-7 w-7 items-center justify-center rounded-full text-base leading-none text-ink3 transition-colors hover:text-ink2"
    :title="`主题：${THEME_LABEL[theme]}`"
    :aria-label="`切换主题，当前${THEME_LABEL[theme]}`"
    @click="cycle"
  >
    {{ THEME_ICON[theme] }}
  </button>
</template>
