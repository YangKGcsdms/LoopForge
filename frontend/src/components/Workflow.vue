<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { api, type CatalogModel } from "../api/client";
import { renderNodeOutput, tierClass, kindClass, diffClass } from "../lib/format";

interface Subtask {
  id: string;
  title: string;
  estimateHours: number;
  acceptance: string;
}
interface NodeItem {
  kind: "node";
  key: string;
  id: string;
  nodeKind: string;
  status: string;
  iteration: number | null;
  full: string;
  typed: string;
}
interface PhaseItem {
  kind: "phase";
  key: string;
  name: string;
}
interface TodosItem {
  kind: "todos";
  key: string;
  subtasks: Subtask[];
}
type LiveItem = NodeItem | PhaseItem | TodosItem;

const models = ref<CatalogModel[]>([]);
const modelSource = ref("");
const modelNote = ref("");

const provider = ref("cursor");
const requirement = ref("检查当前项目新版本的 oa-system-ui 前台权限系统");
const goal = ref("评估 RBAC/ABAC 权限系统进展，缺的补齐，确保能推进");
const cwd = ref("");
const dryRun = ref(true);

const running = ref(false);
const error = ref("");

const live = ref<LiveItem[]>([]);
const difficulty = ref<{ value: string; reason: string | null } | null>(null);
const routing = ref<Record<string, string> | null>(null);
const finalDone = ref<{ todos: number; developed: number; decompose: string } | null>(null);

let es: EventSource | null = null;
const queue: LiveItem[] = [];
let typing = false;
let seq = 0;
let pending: { todos: number; developed: number; decompose: string } | null = null;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// 渲染/样式辅助已抽到 ../lib/format（renderNodeOutput / tierClass / kindClass / diffClass）

async function pump() {
  if (typing) return;
  typing = true;
  while (queue.length) {
    const item = queue.shift()!;
    if (item.kind === "node") {
      const full = item.full;
      live.value.push({ ...item, typed: "" });
      const idx = live.value.length - 1;
      for (let i = 0; i <= full.length; i++) {
        (live.value[idx] as NodeItem).typed = full.slice(0, i);
        await sleep(4);
      }
    } else {
      live.value.push(item);
      await sleep(40);
    }
  }
  typing = false;
  if (pending) {
    finalDone.value = pending;
    running.value = false;
  }
}

function cleanup() {
  if (es) {
    es.close();
    es = null;
  }
}

function startRun() {
  cleanup();
  error.value = "";
  live.value = [];
  difficulty.value = null;
  routing.value = null;
  finalDone.value = null;
  queue.length = 0;
  pending = null;
  seq = 0;
  running.value = true;

  const params = new URLSearchParams({
    requirement: requirement.value,
    goal: goal.value,
    provider: provider.value,
    dryRun: String(dryRun.value),
  });
  if (cwd.value.trim()) params.set("cwd", cwd.value.trim());

  es = new EventSource(`/api/run/pipeline/stream?${params.toString()}`);

  es.addEventListener("difficulty", (e) => {
    const d = JSON.parse((e as MessageEvent).data);
    difficulty.value = { value: d.value, reason: d.reason };
  });
  es.addEventListener("routing", (e) => {
    routing.value = JSON.parse((e as MessageEvent).data);
  });
  es.addEventListener("phase", (e) => {
    const d = JSON.parse((e as MessageEvent).data);
    queue.push({ kind: "phase", key: `p${seq++}`, name: d.name });
    void pump();
  });
  es.addEventListener("todos", (e) => {
    const d = JSON.parse((e as MessageEvent).data);
    queue.push({ kind: "todos", key: `t${seq++}`, subtasks: d.subtasks });
    void pump();
  });
  es.addEventListener("node-end", (e) => {
    const d = JSON.parse((e as MessageEvent).data);
    queue.push({
      kind: "node",
      key: `n${seq++}`,
      id: d.id,
      nodeKind: d.kind,
      status: d.status,
      iteration: d.iteration ?? null,
      full: d.status === "error" ? `⚠ ${d.error ?? "节点报错"}` : renderNodeOutput(d),
      typed: "",
    });
    void pump();
  });
  es.addEventListener("done", (e) => {
    const d = JSON.parse((e as MessageEvent).data);
    pending = { todos: d.todos, developed: d.developed, decompose: d.decompose };
    cleanup();
    if (!typing && queue.length === 0) {
      finalDone.value = pending;
      running.value = false;
    }
  });
  es.addEventListener("error", (e) => {
    const me = e as MessageEvent;
    if (me.data) {
      try {
        error.value = JSON.parse(me.data).message;
      } catch {
        error.value = "运行出错";
      }
    } else if (running.value && !pending) {
      error.value = "连接中断";
    }
    cleanup();
    running.value = false;
  });
}

async function loadModels() {
  try {
    const res = await api.getModels(provider.value);
    models.value = res.models;
    modelSource.value = res.source;
    modelNote.value = res.note ?? "";
  } catch (e) {
    error.value = `加载模型失败：${(e as Error).message}`;
  }
}

onMounted(loadModels);
onUnmounted(cleanup);
</script>

<template>
  <div class="space-y-6">
    <!-- 模型目录 -->
    <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">路由池（按难度选模型）</h2>
        <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
          {{ modelSource === "live" ? "实时可用性" : "可用性未知" }}
        </span>
      </div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="m in models"
          :key="m.id"
          class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm"
          :class="m.available === false ? 'border-rose-200 bg-rose-50 opacity-60' : 'border-slate-200'"
        >
          <span>{{ m.displayName }}</span>
          <span :class="tierClass(m.tier)" class="rounded px-1.5 py-0.5 text-xs">{{ m.tier }}</span>
          <span v-if="m.available === false" class="rounded bg-rose-100 px-1 text-xs text-rose-600">禁用</span>
        </span>
      </div>
      <p class="mt-2 text-xs text-slate-400">
        按难度路由：easy→cheap、medium→mid、hard/评审→strong；某档全不可用时回退 auto。
        <span v-if="modelNote"> · {{ modelNote }}</span>
      </p>
    </section>

    <!-- 运行表单 -->
    <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 class="mb-1 text-lg font-semibold">自驱开发流水线</h2>
      <p class="mb-5 text-sm text-slate-500">
        难度评估 → 出方案 → 拆解成 N 个 3~5 工时任务 → 每个 TODO 自循环开发（开发→评审→矫正→通过）。
      </p>

      <label class="mb-1.5 block text-sm font-medium text-slate-700">引擎 Provider</label>
      <select
        v-model="provider"
        class="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        @change="loadModels"
      >
        <option value="cursor">Cursor SDK</option>
        <option value="claude-agent">Claude Agent SDK</option>
      </select>

      <label class="mb-1.5 block text-sm font-medium text-slate-700">需求</label>
      <textarea
        v-model="requirement"
        rows="2"
        class="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      ></textarea>

      <label class="mb-1.5 block text-sm font-medium text-slate-700">最终目标</label>
      <input
        v-model="goal"
        class="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />

      <label class="mb-1.5 block text-sm font-medium text-slate-700">工作目录 cwd（可选）</label>
      <input
        v-model="cwd"
        placeholder="/path/to/target-repo —— agent 在这个目录下开发代码"
        class="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />

      <div class="flex items-center justify-between">
        <label class="flex items-center gap-2 text-sm text-slate-600">
          <input v-model="dryRun" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
          dryRun（内置 mock，无需 SDK/SK）
        </label>
        <button
          type="button"
          :disabled="running"
          class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          @click="startRun"
        >
          {{ running ? "运行中…" : "评估并自驱运行" }}
        </button>
      </div>

      <div v-if="error" class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ error }}
      </div>
    </section>

    <!-- 实时观察 -->
    <section v-if="difficulty || live.length" class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 class="mb-4 text-lg font-semibold">实时自驱运行</h2>

      <div v-if="difficulty" class="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span class="text-slate-500">难度</span>
        <span :class="diffClass(difficulty.value)" class="rounded px-2 py-0.5 font-medium">{{ difficulty.value }}</span>
        <span class="text-slate-400">{{ difficulty.reason }}</span>
      </div>
      <div v-if="routing" class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span class="font-medium text-slate-600">路由方案（按用途）：</span>
        <span>出方案 <span class="font-mono text-slate-700">{{ routing.plan }}</span></span>
        <span>执行 <span class="font-mono text-slate-700">{{ routing.execute }}</span></span>
        <span>评审 <span class="font-mono text-slate-700">{{ routing.review }}</span></span>
        <span>测试 <span class="font-mono text-slate-700">{{ routing.test }}</span></span>
      </div>

      <div class="space-y-2">
        <template v-for="item in live" :key="item.key">
          <!-- 阶段头 -->
          <div v-if="item.kind === 'phase'" class="flex items-center gap-2 pt-2">
            <span class="h-px flex-1 bg-slate-200"></span>
            <span class="text-xs font-semibold tracking-wide text-slate-500">{{ item.name }}</span>
            <span class="h-px flex-1 bg-slate-200"></span>
          </div>

          <!-- TODO 列表 -->
          <div v-else-if="item.kind === 'todos'" class="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <div class="mb-2 text-sm font-semibold text-indigo-700">TODO 列表（{{ item.subtasks.length }} 项）</div>
            <ul class="space-y-1 text-sm">
              <li v-for="s in item.subtasks" :key="s.id" class="flex items-baseline gap-2">
                <span class="font-mono text-indigo-500">{{ s.id }}</span>
                <span class="font-medium">{{ s.title }}</span>
                <span class="rounded bg-white px-1.5 text-xs text-slate-500">{{ s.estimateHours }}h</span>
                <span class="text-xs text-slate-400">{{ s.acceptance }}</span>
              </li>
            </ul>
          </div>

          <!-- 节点卡片（打字机） -->
          <div v-else class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div class="mb-1.5 flex items-center gap-2 text-sm">
              <span class="font-mono font-medium">{{ item.id }}</span>
              <span :class="kindClass(item.nodeKind)" class="rounded px-1.5 py-0.5 text-xs">{{ item.nodeKind }}</span>
              <span v-if="item.iteration" class="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                第 {{ item.iteration }} 轮
              </span>
              <span :class="item.status === 'ok' ? 'text-emerald-600' : 'text-rose-600'" class="text-xs">
                {{ item.status }}
              </span>
            </div>
            <pre class="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700">{{ item.typed
              }}<span v-if="item.typed.length < item.full.length" class="animate-pulse">▋</span></pre>
          </div>
        </template>
      </div>

      <div
        v-if="finalDone"
        class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
      >
        完成 · 拆出 {{ finalDone.todos }} 个 TODO · 自循环开发完成 {{ finalDone.developed }} 个
      </div>
    </section>
  </div>
</template>
