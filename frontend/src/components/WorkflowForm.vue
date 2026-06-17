<script setup lang="ts">
import { computed, onMounted } from "vue";
import { tierClass } from "../lib/format";
import { type UseRunState, type UseRunActions } from "../composables/useRun";
import { type WorkflowForm } from "../composables/useWorkflowForm";
import { useModels } from "../composables/useModels";
import BaseInput from "./BaseInput.vue";
import BaseTag from "./BaseTag.vue";

interface Props {
  useRunState: UseRunState & UseRunActions;
  formState: WorkflowForm;
}

const props = defineProps<Props>();
// 共享表单字段（App 持有，与 H5 版同一实例）。
const { provider, requirement, goal, cwd, dryRun } = props.formState;

const { models, modelSource, modelNote, poolRouting, loadError, load } = useModels();

const engines = [
  { id: "cursor", name: "Cursor SDK" },
  { id: "claude-agent", name: "Claude Agent SDK" },
];

function selectProvider(p: string) {
  if (provider.value === p) return;
  provider.value = p;
  void load(p);
}

const routingLabels: Record<string, string> = {
  plan: "出方案",
  control: "管控",
  execute: "执行",
  validate: "校验",
  review: "评审",
  test: "测试",
};
const routingRows = computed(() =>
  poolRouting.value
    ? Object.entries(poolRouting.value).map(([key, value]) => ({ key, label: routingLabels[key] ?? key, value }))
    : [],
);

function handleStartRun() {
  props.useRunState.startRun({
    requirement: requirement.value,
    goal: goal.value,
    provider: provider.value,
    dryRun: dryRun.value,
    cwd: cwd.value,
  });
}

onMounted(() => void load(provider.value));
</script>

<template>
  <div class="space-y-10">
    <!-- ── 引擎 + 路由池 ── -->
    <section>
      <div class="section-label mb-4">
        <span class="ornament">·</span>
        <span class="caps">编码引擎 · Engine</span>
        <span class="rule"></span>
        <span class="label-caps shrink-0 normal-case tracking-wide">
          {{ modelSource === "live" ? "实时可用" : "可用性未知" }}
        </span>
      </div>

      <!-- 引擎段控件：terracotta 单点聚焦 -->
      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="e in engines"
          :key="e.id"
          type="button"
          :class="[
            'flex items-center gap-2.5 rounded-md border px-3.5 py-3 text-left transition-colors',
            provider === e.id ? 'border-brand bg-brand-bg' : 'border-hair hover:border-hair-strong',
          ]"
          @click="selectProvider(e.id)"
        >
          <span
            :class="['h-1.5 w-1.5 rounded-full', provider === e.id ? 'bg-brand' : 'bg-ink4']"
          ></span>
          <span :class="['text-sm font-medium', provider === e.id ? 'text-ink' : 'text-ink2']">{{ e.name }}</span>
        </button>
      </div>

      <!-- 按用途路由：发丝线账本 -->
      <div class="mt-6">
        <div class="section-label mb-1">
          <span class="caps">按用途路由 · Routing</span>
          <span class="rule"></span>
        </div>
        <div v-if="routingRows.length" class="grid grid-cols-2 gap-x-8">
          <div
            v-for="row in routingRows"
            :key="row.key"
            class="flex items-baseline justify-between gap-3 border-t border-hair-soft py-2.5"
          >
            <span class="label-caps tracking-caps">{{ row.label }}</span>
            <span class="truncate font-mono text-[12px] text-ink">{{ row.value }}</span>
          </div>
        </div>

        <!-- 模型池 chips -->
        <div class="mt-4 flex flex-wrap gap-1.5">
          <span
            v-for="m in models"
            :key="m.id"
            class="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[12px]"
            :class="m.available === false ? 'border-hair-soft text-ink3 opacity-60' : 'border-hair text-ink2'"
          >
            <span class="font-mono">{{ m.displayName }}</span>
            <BaseTag :color="tierClass(m.tier)">{{ m.tier }}</BaseTag>
            <BaseTag v-if="m.available === false" color="tone-down">禁用</BaseTag>
          </span>
        </div>
        <p class="mt-3 text-[12px] leading-relaxed text-ink3">
          Cursor 与 Claude 各一套、互不相同；切引擎即换池与策略。
          <span v-if="modelNote"> · {{ modelNote }}</span>
        </p>
        <p v-if="loadError" class="mt-2 text-[12px] text-down">{{ loadError }}</p>
      </div>
    </section>

    <!-- ── 运行表单 ── -->
    <section>
      <p class="kicker mb-2.5">★ Pipeline · 自驱开发</p>
      <h2 class="font-serif text-[28px] font-light leading-[1.15] tracking-tight text-ink">
        自驱开发<em class="italic text-brand">流水线</em>。
      </h2>
      <p class="mt-2 max-w-md font-serif text-[15px] font-light leading-relaxed text-ink2">
        难度评估 → 出方案 → 拆解成 N 个 3~5 工时任务 → 每个 TODO <em class="italic text-ink">自循环</em>开发（开发→评审→矫正→通过）。
      </p>

      <div class="mt-6 space-y-5">
        <div>
          <label class="label-caps mb-2 block">需求</label>
          <textarea
            v-model="requirement"
            rows="3"
            class="w-full rounded-md border border-hair-strong bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink transition-colors"
          ></textarea>
        </div>

        <div>
          <label class="label-caps mb-2 block">最终目标</label>
          <BaseInput v-model="goal" fullWidth />
        </div>

        <div>
          <label class="label-caps mb-2 block">工作目录 cwd（可选）</label>
          <BaseInput
            v-model="cwd"
            placeholder="/path/to/target-repo —— agent 在这个目录下开发代码"
            class="font-mono"
            fullWidth
          />
        </div>

        <label class="flex items-center gap-2.5 text-sm text-ink2">
          <input v-model="dryRun" type="checkbox" class="h-4 w-4" />
          dryRun（内置 mock，无需 SDK/SK）
        </label>
      </div>

      <!-- 编辑感 CTA -->
      <button
        type="button"
        :disabled="props.useRunState.running.value"
        class="mt-6 flex h-[52px] w-full items-center justify-center gap-3 rounded-md border border-brand bg-brand font-serif text-[17px] text-[#faf5f0] transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
        @click="handleStartRun"
      >
        <span>{{ props.useRunState.running.value ? "运行中…" : "评估并自驱运行" }}</span>
        <span v-if="!props.useRunState.running.value" class="font-light italic">→</span>
      </button>

      <div
        v-if="props.useRunState.error.value"
        class="mt-4 rounded-md border border-hair bg-down-bg px-4 py-3 text-[13px] text-down"
      >
        {{ props.useRunState.error.value }}
      </div>
    </section>
  </div>
</template>
