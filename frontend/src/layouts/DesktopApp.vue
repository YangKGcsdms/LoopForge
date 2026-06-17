<script setup lang="ts">
/**
 * 桌面(浏览器)版 —— 暖色账本 / Anthropic 编辑风的两栏工作台。
 * 运行态/表单态由 App 注入并与 H5 版共享；header 放 brand-mark + 主题切换 + 视图切换。
 */
import SkConfig from "../components/SkConfig.vue";
import WorkflowForm from "../components/WorkflowForm.vue";
import WorkflowResults from "../components/WorkflowResults.vue";
import ViewSwitch from "../components/ViewSwitch.vue";
import ThemeToggle from "../components/ThemeToggle.vue";
import { type UseRunState, type UseRunActions } from "../composables/useRun";
import { type WorkflowForm as WorkflowFormState } from "../composables/useWorkflowForm";
import { type ViewMode } from "../composables/useDevice";

defineProps<{
  runState: UseRunState & UseRunActions;
  formState: WorkflowFormState;
  mode: ViewMode;
  autoIsMobile: boolean;
}>();

const emit = defineEmits<{ "set-mode": [mode: ViewMode] }>();
</script>

<template>
  <div class="min-h-screen bg-paper text-ink">
    <!-- 编辑感 header：衬线斜体 brand-mark + meta + 主题/视图切换 -->
    <header class="border-b border-hair bg-paper">
      <div class="flex items-center gap-4 px-6 py-4">
        <div class="flex flex-1 items-baseline gap-3">
          <span class="font-serif text-[19px] italic leading-none text-ink">LoopForge</span>
          <span class="kicker hidden sm:inline">Self-Driving Orchestration</span>
        </div>
        <span class="hidden font-mono text-[11px] text-ink3 md:inline">Cursor · Claude · 节点/Loop</span>
        <ViewSwitch :mode="mode" :auto-is-mobile="autoIsMobile" @select="emit('set-mode', $event)" />
        <ThemeToggle />
      </div>
    </header>

    <!-- 两栏响应式：lg+ 左配置(440) / 右结果，md- 单列堆叠 -->
    <main
      class="grid auto-rows-max gap-8 px-5 py-7 md:px-8 md:py-9 lg:grid-cols-[440px_1fr] lg:gap-10 lg:px-10 lg:py-10"
    >
      <!-- 左栏：配置与表单 -->
      <div class="lg:min-h-[calc(100vh-130px)]">
        <div class="space-y-10">
          <SkConfig />
          <WorkflowForm :use-run-state="runState" :form-state="formState" />
        </div>
      </div>

      <!-- 右栏：结果流 -->
      <div class="lg:min-h-[calc(100vh-130px)]">
        <WorkflowResults :use-run-state="runState" />
      </div>
    </main>
  </div>
</template>
