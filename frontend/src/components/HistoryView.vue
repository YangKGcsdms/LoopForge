<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, type RunHistoryItem, type RunDetail } from "../api/client";
import StatusBadge from "./StatusBadge.vue";

const runs = ref<RunHistoryItem[]>([]);
const loading = ref(false);
const err = ref("");

const expanded = ref<string | null>(null);
const details = ref<Record<string, RunDetail>>({});
const detailLoading = ref<string | null>(null);

async function load() {
  loading.value = true;
  err.value = "";
  try {
    runs.value = (await api.getHistory()).runs;
  } catch (e) {
    err.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function toggle(runId: string) {
  if (expanded.value === runId) {
    expanded.value = null;
    return;
  }
  expanded.value = runId;
  if (!details.value[runId]) {
    detailLoading.value = runId;
    try {
      details.value[runId] = await api.getRunDetail(runId);
    } catch {
      // 详情拉取失败时静默
    } finally {
      detailLoading.value = null;
    }
  }
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const statusMap: Record<string, "completed" | "error" | "running" | "idle"> = {
  done: "completed",
  failed: "error",
  running: "running",
  aborted: "idle",
};
const statusLabel: Record<string, string> = {
  done: "完成",
  failed: "失败",
  running: "运行中",
  aborted: "中断",
};
const todoStatusLabel: Record<string, string> = {
  converged: "✓ 收敛",
  max_iterations: "迭代用尽",
  blocked: "被阻断",
  error: "出错",
  pending: "待运行",
};

onMounted(load);
</script>

<template>
  <div class="px-5 py-6">
    <div class="mb-4 flex items-baseline justify-between">
      <h2 class="font-serif text-2xl font-normal tracking-tight text-slate-900">运行历史</h2>
      <button type="button" class="text-xs text-slate-500 hover:text-slate-800" @click="load">↻ 刷新</button>
    </div>

    <p v-if="loading" class="py-10 text-center text-sm text-slate-400">加载中…</p>
    <p v-else-if="err" class="py-10 text-center text-sm text-rose-600">{{ err }}</p>
    <p v-else-if="runs.length === 0" class="py-10 text-center text-sm text-slate-400">
      还没有运行记录，去「运行」跑一次吧。
    </p>

    <div v-else class="space-y-3">
      <div
        v-for="run in runs"
        :key="run.runId"
        class="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
      >
        <!-- 概要行 -->
        <button
          type="button"
          class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-100"
          @click="toggle(run.runId)"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="num text-xs text-slate-500">{{ fmtTime(run.createdAt) }}</span>
              <StatusBadge :status="statusMap[run.status] ?? 'idle'" :label="statusLabel[run.status] ?? run.status" compact />
            </div>
            <p class="mt-1 truncate text-sm font-medium text-slate-900">{{ run.input.requirement }}</p>
            <p class="mt-0.5 truncate text-xs text-slate-500">目标：{{ run.input.goal }}</p>
          </div>
          <span class="mt-1 shrink-0 text-slate-300">{{ expanded === run.runId ? "▾" : "›" }}</span>
        </button>

        <!-- 详情 -->
        <div v-if="expanded === run.runId" class="border-t border-slate-200 px-4 py-3">
          <p v-if="detailLoading === run.runId" class="text-center text-xs text-slate-400">加载详情…</p>
          <template v-else-if="details[run.runId]">
            <!-- 完整输入 -->
            <div class="mb-3 space-y-2">
              <div>
                <span class="label-caps">需求</span>
                <p class="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{{ details[run.runId].manifest.input.requirement }}</p>
              </div>
              <div>
                <span class="label-caps">最终目标</span>
                <p class="mt-0.5 text-sm text-slate-800">{{ details[run.runId].manifest.input.goal }}</p>
              </div>
              <div v-if="details[run.runId].manifest.cwd">
                <span class="label-caps">工作目录</span>
                <p class="mt-0.5 break-all font-mono text-xs text-slate-700">{{ details[run.runId].manifest.cwd }}</p>
              </div>
              <div v-if="details[run.runId].difficulty?.difficulty">
                <span class="label-caps">难度</span>
                <span class="ml-2 text-sm text-slate-800">{{ details[run.runId].difficulty?.difficulty }}</span>
              </div>
            </div>

            <!-- 任务列表 + 验收标准 -->
            <span class="label-caps">任务列表（{{ details[run.runId].todos.length }}）</span>
            <ul class="mt-2 space-y-2">
              <li
                v-for="t in details[run.runId].todos"
                :key="t.id"
                class="rounded-md border border-slate-200 bg-white p-3"
              >
                <div class="flex items-baseline gap-2">
                  <span class="font-mono text-xs font-semibold text-slate-900">{{ t.id }}</span>
                  <span class="flex-1 text-sm font-medium text-slate-800">{{ t.title }}</span>
                  <span class="num shrink-0 text-xs text-slate-500">{{ t.estimateHours }}h</span>
                </div>
                <p class="mt-1.5 text-xs leading-relaxed text-slate-600">
                  <span class="label-caps">验收</span> {{ t.acceptance }}
                </p>
                <span class="mt-1.5 inline-block rounded-sm bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                  {{ todoStatusLabel[t.status] ?? t.status }}
                </span>
              </li>
              <li v-if="details[run.runId].todos.length === 0" class="text-xs text-slate-400">
                未拆解出任务（运行未到拆解阶段或为空结果）
              </li>
            </ul>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
