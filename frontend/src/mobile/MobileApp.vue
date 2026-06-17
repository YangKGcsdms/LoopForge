<script setup lang="ts">
/**
 * H5(移动)版外壳 —— 暖色账本风：精简 header + 三页 Tab（配置/运行/结果）+ 底部导航。
 * 运行态/表单态由 App 注入并与桌面版共享；运行一开始自动跳到「结果」页。
 */
import { ref, watch } from "vue";
import SkConfig from "../components/SkConfig.vue";
import ViewSwitch from "../components/ViewSwitch.vue";
import ThemeToggle from "../components/ThemeToggle.vue";
import MobileForm from "./MobileForm.vue";
import MobileResults from "./MobileResults.vue";
import { type UseRunState, type UseRunActions } from "../composables/useRun";
import { type WorkflowForm } from "../composables/useWorkflowForm";
import { type ViewMode } from "../composables/useDevice";

const props = defineProps<{
  runState: UseRunState & UseRunActions;
  formState: WorkflowForm;
  mode: ViewMode;
  autoIsMobile: boolean;
}>();

const emit = defineEmits<{ "set-mode": [mode: ViewMode] }>();

type Tab = "config" | "run" | "results";
const tab = ref<Tab>("run");

const tabs: Array<{ key: Tab; label: string; en: string }> = [
  { key: "config", label: "配置", en: "Config" },
  { key: "run", label: "运行", en: "Run" },
  { key: "results", label: "结果", en: "Result" },
];

// 运行一开始就把用户带到结果页，看实时流。
watch(
  () => props.runState.running.value,
  (running) => {
    if (running) tab.value = "results";
  },
);
</script>

<template>
  <div class="flex flex-col bg-paper text-ink" style="height: 100dvh">
    <!-- 精简 header：衬线斜体 brand-mark + 主题/视图切换 -->
    <header class="flex flex-shrink-0 items-center gap-2.5 border-b border-hair bg-paper px-4 py-3">
      <div class="flex flex-1 items-baseline gap-2">
        <span class="font-serif text-[17px] italic leading-none text-ink">LoopForge</span>
        <span class="text-[10px] uppercase tracking-kicker text-ink3">H5</span>
      </div>
      <ViewSwitch :mode="mode" :auto-is-mobile="autoIsMobile" compact @select="emit('set-mode', $event)" />
      <ThemeToggle />
    </header>

    <!-- 内容区（三页常驻、Tab 切换显隐，保活状态与滚动位置） -->
    <main class="relative min-h-0 flex-1 overflow-hidden">
      <div v-show="tab === 'config'" class="h-full overflow-y-auto px-4 py-5">
        <SkConfig />
      </div>
      <div v-show="tab === 'run'" class="h-full">
        <MobileForm :run-state="runState" :form-state="formState" />
      </div>
      <div v-show="tab === 'results'" class="h-full">
        <MobileResults :run-state="runState" />
      </div>
    </main>

    <!-- 底部导航：大写小标签 + 状态点 + 激活态 terracotta 顶条 -->
    <nav
      class="flex flex-shrink-0 items-stretch border-t border-hair bg-surface"
      style="padding-bottom: env(safe-area-inset-bottom)"
    >
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        :aria-current="tab === t.key"
        :class="[
          'relative flex flex-1 flex-col items-center gap-1.5 py-2.5 transition-colors',
          tab === t.key ? 'text-ink' : 'text-ink3',
        ]"
        @click="tab = t.key"
      >
        <!-- 激活顶条 -->
        <span
          v-if="tab === t.key"
          class="absolute top-0 h-0.5 w-5 rounded-full bg-brand"
          aria-hidden="true"
        ></span>
        <span class="relative">
          <span
            :class="[
              'block h-1.5 w-1.5 rounded-full',
              tab === t.key ? 'bg-brand' : 'bg-ink4',
            ]"
          ></span>
          <!-- 运行中在「结果」上挂跳动小点 -->
          <span
            v-if="t.key === 'results' && runState.running.value && tab !== 'results'"
            class="absolute -right-1.5 -top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-brand"
          ></span>
        </span>
        <span class="text-[10px] font-medium uppercase tracking-caps">{{ t.en }}</span>
      </button>
    </nav>
  </div>
</template>
