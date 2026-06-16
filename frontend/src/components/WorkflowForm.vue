<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, type CatalogModel } from "../api/client";
import { tierClass } from "../lib/format";
import { type UseRunState, type UseRunActions } from "../composables/useRun";
import BaseButton from "./BaseButton.vue";
import BaseInput from "./BaseInput.vue";
import BaseCard from "./BaseCard.vue";
import BaseSelect from "./BaseSelect.vue";

interface Props {
  useRunState: UseRunState & UseRunActions;
}

const props = defineProps<Props>();

const models = ref<CatalogModel[]>([]);
const modelSource = ref("");
const modelNote = ref("");
const poolRouting = ref<Record<string, string> | null>(null);

const provider = ref("cursor");
const requirement = ref("检查当前项目新版本的 oa-system-ui 前台权限系统");
const goal = ref("评估 RBAC/ABAC 权限系统进展，缺的补齐，确保能推进");
const cwd = ref("");
const dryRun = ref(true);

async function loadModels() {
  try {
    const res = await api.getModels(provider.value);
    models.value = res.models;
    modelSource.value = res.source;
    modelNote.value = res.note ?? "";
    poolRouting.value = res.routing ?? null;
  } catch (e) {
    props.useRunState.error.value = `加载模型失败：${(e as Error).message}`;
  }
}

function handleStartRun() {
  props.useRunState.startRun({
    requirement: requirement.value,
    goal: goal.value,
    provider: provider.value,
    dryRun: dryRun.value,
    cwd: cwd.value,
  });
}

onMounted(loadModels);
</script>

<template>
  <div class="space-y-6">
    <!-- 路由池：跟随所选引擎（两套策略各一套） -->
    <BaseCard variant="default" size="md">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg font-semibold">
          路由池 · {{ provider === "cursor" ? "Cursor SDK" : "Claude Agent SDK" }}
        </h2>
        <div class="flex flex-wrap items-center gap-2">
          <BaseSelect
            v-model="provider"
            size="sm"
            @change="loadModels"
          >
            <option value="cursor">Cursor SDK</option>
            <option value="claude-agent">Claude Agent SDK</option>
          </BaseSelect>
          <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {{ modelSource === "live" ? "实时可用性" : "可用性未知" }}
          </span>
        </div>
      </div>

      <div v-if="poolRouting" class="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>出方案 <span class="font-mono text-slate-900">{{ poolRouting.plan }}</span></span>
        <span>执行 <span class="font-mono text-slate-900">{{ poolRouting.execute }}</span></span>
        <span>评审 <span class="font-mono text-slate-900">{{ poolRouting.review }}</span></span>
        <span>测试 <span class="font-mono text-slate-900">{{ poolRouting.test }}</span></span>
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
      <p class="mt-2 text-xs text-slate-600">
        按用途路由，Cursor 与 Claude 各一套、互不相同；切上方引擎即换池与策略。
        <span v-if="modelNote"> · {{ modelNote }}</span>
      </p>
    </BaseCard>

    <!-- 运行表单 -->
    <BaseCard variant="default" size="md">
      <h2 class="mb-1 text-lg font-semibold">自驱开发流水线</h2>
      <p class="mb-5 text-sm text-slate-500">
        难度评估 → 出方案 → 拆解成 N 个 3~5 工时任务 → 每个 TODO 自循环开发（开发→评审→矫正→通过）。
      </p>

      <label class="mb-1.5 block text-sm font-medium text-slate-800">需求</label>
      <textarea
        v-model="requirement"
        rows="2"
        class="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      ></textarea>

      <label class="mb-1.5 block text-sm font-medium text-slate-800">最终目标</label>
      <BaseInput v-model="goal" class="mb-4" fullWidth />

      <label class="mb-1.5 block text-sm font-medium text-slate-800">工作目录 cwd（可选）</label>
      <BaseInput
        v-model="cwd"
        placeholder="/path/to/target-repo —— agent 在这个目录下开发代码"
        class="mb-4 font-mono"
        fullWidth
      />

      <div class="flex items-center justify-between">
        <label class="flex items-center gap-2 text-sm text-slate-800">
          <input v-model="dryRun" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
          dryRun（内置 mock，无需 SDK/SK）
        </label>
        <BaseButton :disabled="props.useRunState.running.value" @click="handleStartRun">
          {{ props.useRunState.running.value ? "运行中…" : "评估并自驱运行" }}
        </BaseButton>
      </div>

      <div v-if="props.useRunState.error.value" class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ props.useRunState.error.value }}
      </div>
    </BaseCard>
  </div>
</template>
