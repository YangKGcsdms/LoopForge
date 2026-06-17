<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import AppHeader from "./components/AppHeader.vue";
import BottomNav, { type TabKey } from "./components/BottomNav.vue";
import SkConfig from "./components/SkConfig.vue";
import RoutePool from "./components/RoutePool.vue";
import WorkflowForm from "./components/WorkflowForm.vue";
import WorkflowResults from "./components/WorkflowResults.vue";
import HistoryView from "./components/HistoryView.vue";
import AboutView from "./components/AboutView.vue";
import { useRun } from "./composables/useRun";
import { useProvider } from "./composables/useProvider";

// 单例运行状态：跨 Tab 保持 SSE 流不中断
const runState = useRun();
// 全局所选引擎（落库持久化），路由卡片随之跟随
const { provider, load: loadProvider } = useProvider();
void loadProvider();
const activeTab = ref<TabKey>("run");

const tabTitle: Record<TabKey, string> = {
  run: "运行",
  history: "历史",
  config: "配置",
  about: "关于",
};

// 切到运行 Tab 时若正在运行，自动回到运行页便于观察（保持当前即可）
onUnmounted(runState.cleanup);
</script>

<template>
  <div class="page text-slate-800">
    <AppHeader
      :title="tabTitle[activeTab]"
      :running="runState.running.value"
      :has-error="!!runState.error.value"
    />

    <!-- 运行 Tab -->
    <main v-show="activeTab === 'run'" class="px-4 py-5">
      <WorkflowForm :use-run-state="runState" @go-config="activeTab = 'config'" />
      <div class="mt-6">
        <WorkflowResults :use-run-state="runState" @resume="runState.resumeRun" />
      </div>
    </main>

    <!-- 历史 Tab：v-if 使每次切入都重新拉取最新记录 -->
    <main v-if="activeTab === 'history'">
      <HistoryView />
    </main>

    <!-- 配置 Tab：引擎选择 + SK 配置 + 路由卡片（跟随所选引擎） -->
    <main v-show="activeTab === 'config'" class="space-y-6 px-4 py-5">
      <SkConfig />
      <RoutePool :provider="provider" />
    </main>

    <!-- 关于 Tab -->
    <main v-show="activeTab === 'about'">
      <AboutView />
    </main>

    <BottomNav v-model="activeTab" />
  </div>
</template>
