<script setup lang="ts">
/**
 * 桌面(浏览器)版 —— 暖色账本 / Anthropic 编辑风的两栏工作台。
 * 运行态/表单态由 App 注入并与 H5 版共享；header 放 brand-mark + 主题切换 + 视图切换。
 */
import { computed, ref } from "vue";
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

/** 操作台两个 tab：提交任务（主入口）/ 配置。 */
type LeftTab = "task" | "config";
const leftTab = ref<LeftTab>("task");

/** 登录态：null=校验中/未知，true=ok，false=异常。由 SkConfig 刷新时自动校验抛上来。 */
const loginOk = ref<boolean | null>(null);
const loginDotTitle = computed(() =>
  loginOk.value === null ? "登录态校验中…" : loginOk.value ? "登录态正常" : "登录态异常，点开配置查看",
);
function onValidated(v: { valid: boolean }) {
  loginOk.value = v.valid;
}
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
      <!-- 左栏：操作台（提交任务 / 配置 两个 tab）-->
      <div class="lg:min-h-[calc(100vh-130px)]">
        <!-- tab 段控件：配置 tab 带登录态状态点 -->
        <div
          class="mb-7 inline-flex w-full rounded-md border border-hair bg-surface2 p-0.5"
          role="tablist"
          aria-label="操作台"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="leftTab === 'task'"
            :class="[
              'flex-1 rounded px-3 py-1.5 text-[12px] font-medium transition-colors duration-150',
              leftTab === 'task' ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--border-soft)]' : 'text-ink3 hover:text-ink2',
            ]"
            @click="leftTab = 'task'"
          >
            提交任务
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="leftTab === 'config'"
            :class="[
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium transition-colors duration-150',
              leftTab === 'config' ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--border-soft)]' : 'text-ink3 hover:text-ink2',
            ]"
            @click="leftTab = 'config'"
          >
            配置
            <span
              :class="['h-1.5 w-1.5 rounded-full', loginOk === null ? 'bg-ink4' : loginOk ? 'bg-up' : 'bg-down']"
              :title="loginDotTitle"
            ></span>
          </button>
        </div>

        <!-- v-show 而非 v-if：两块都挂载，SkConfig 一加载就自动校验登录态（刷新即知） -->
        <div v-show="leftTab === 'task'">
          <WorkflowForm :use-run-state="runState" :form-state="formState" />
        </div>
        <div v-show="leftTab === 'config'">
          <SkConfig :form-state="formState" @validated="onValidated" />
        </div>
      </div>

      <!-- 右栏：结果流 -->
      <div class="lg:min-h-[calc(100vh-130px)]">
        <WorkflowResults :use-run-state="runState" />
      </div>
    </main>
  </div>
</template>
