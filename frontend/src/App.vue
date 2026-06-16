<script setup lang="ts">
import { onUnmounted } from "vue";
import SkConfig from "./components/SkConfig.vue";
import WorkflowForm from "./components/WorkflowForm.vue";
import WorkflowResults from "./components/WorkflowResults.vue";
import { useRun } from "./composables/useRun";

const runState = useRun();

onUnmounted(runState.cleanup);
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800">
    <header class="border-b border-slate-200 bg-white">
      <div class="flex items-center gap-3 px-6 py-4">
        <div class="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
          L
        </div>
        <div class="flex-1">
          <h1 class="text-base font-semibold leading-tight text-slate-900">LoopForge</h1>
          <p class="text-xs text-slate-600">Cursor / Claude · 节点/Loop 自驱编排</p>
        </div>
      </div>
    </header>

    <!-- 两栏响应式网格布局：lg+ 两栏，md- 单列堆叠 -->
    <main class="grid min-h-[calc(100vh-72px)] auto-rows-max gap-6 px-4 py-6 md:px-6 md:py-8 lg:auto-rows-[1fr] lg:gap-6 lg:grid-cols-[420px_1fr] lg:px-6 lg:py-10">
      <!-- 左栏：配置与表单区（约 420px，小屏幕时单列） -->
      <div class="overflow-y-auto lg:min-h-[calc(100vh-72px)]">
        <div class="space-y-6 pr-0 md:pr-2">
          <!-- SK 配置 -->
          <SkConfig />

          <!-- 运行表单 -->
          <WorkflowForm :use-run-state="runState" />
        </div>
      </div>

      <!-- 右栏：结果区（flex-1，小屏幕时单列） -->
      <div class="overflow-y-auto lg:min-h-[calc(100vh-72px)]">
        <div class="pr-0 md:pr-2">
          <WorkflowResults :use-run-state="runState" />
        </div>
      </div>
    </main>
  </div>
</template>
