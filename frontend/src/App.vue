<script setup lang="ts">
import { ref } from "vue";
import SkConfig from "./components/SkConfig.vue";
import Workflow from "./components/Workflow.vue";

const tab = ref<"workflow" | "sk">("workflow");
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
        <div class="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
          L
        </div>
        <div class="flex-1">
          <h1 class="text-base font-semibold leading-tight">LoopForge</h1>
          <p class="text-xs text-slate-500">Cursor / Claude · 节点/Loop 自驱编排</p>
        </div>
        <nav class="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <button
            type="button"
            :class="tab === 'workflow' ? 'bg-white shadow-sm' : 'text-slate-500'"
            class="rounded-md px-3 py-1.5 font-medium"
            @click="tab = 'workflow'"
          >
            工作流
          </button>
          <button
            type="button"
            :class="tab === 'sk' ? 'bg-white shadow-sm' : 'text-slate-500'"
            class="rounded-md px-3 py-1.5 font-medium"
            @click="tab = 'sk'"
          >
            SK 配置
          </button>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-6 py-10">
      <Workflow v-if="tab === 'workflow'" />
      <SkConfig v-else />
    </main>
  </div>
</template>
