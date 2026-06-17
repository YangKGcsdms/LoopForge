<script setup lang="ts">
/**
 * H5 运行表单 —— 暖色账本风的单列展示层（触控友好、底部吸底主操作）。
 * 业务态复用：formState（与桌面同实例）+ useModels + useRun。
 */
import { computed, onMounted } from "vue";
import { tierClass } from "../lib/format";
import { type UseRunState, type UseRunActions } from "../composables/useRun";
import { type WorkflowForm } from "../composables/useWorkflowForm";
import { useModels } from "../composables/useModels";
import BaseTag from "../components/BaseTag.vue";

const props = defineProps<{
  runState: UseRunState & UseRunActions;
  formState: WorkflowForm;
}>();

const { provider, requirement, goal, cwd, dryRun } = props.formState;
const { models, modelSource, modelNote, poolRouting, loadError, load } = useModels();

const engines = [
  { id: "cursor", name: "Cursor SDK" },
  { id: "claude-agent", name: "Claude Agent SDK" },
];

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

function selectProvider(p: string) {
  if (provider.value === p) return;
  provider.value = p;
  void load(p);
}

function handleStartRun() {
  props.runState.startRun({
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
  <div class="flex h-full flex-col">
    <div class="flex-1 space-y-8 overflow-y-auto px-4 py-5">
      <!-- 引擎 -->
      <section>
        <div class="section-label mb-3">
          <span class="ornament">·</span>
          <span class="caps">编码引擎</span>
          <span class="rule"></span>
          <span class="text-[10px] text-ink3">{{ modelSource === "live" ? "实时可用" : "可用性未知" }}</span>
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          <button
            v-for="e in engines"
            :key="e.id"
            type="button"
            :class="[
              'flex items-center gap-2 rounded-md border px-3 py-3 transition-colors',
              provider === e.id ? 'border-brand bg-brand-bg' : 'border-hair',
            ]"
            @click="selectProvider(e.id)"
          >
            <span :class="['h-1.5 w-1.5 rounded-full', provider === e.id ? 'bg-brand' : 'bg-ink4']"></span>
            <span :class="['text-[13px] font-medium', provider === e.id ? 'text-ink' : 'text-ink2']">{{ e.name }}</span>
          </button>
        </div>
      </section>

      <!-- 路由池 -->
      <section>
        <div class="section-label mb-1">
          <span class="caps">按用途路由</span>
          <span class="rule"></span>
        </div>
        <div v-if="routingRows.length" class="grid grid-cols-2 gap-x-6">
          <div
            v-for="row in routingRows"
            :key="row.key"
            class="flex items-baseline justify-between gap-2 border-t border-hair-soft py-2"
          >
            <span class="label-caps tracking-caps">{{ row.label }}</span>
            <span class="truncate font-mono text-[11px] text-ink">{{ row.value }}</span>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <span
            v-for="m in models"
            :key="m.id"
            class="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px]"
            :class="m.available === false ? 'border-hair-soft text-ink3 opacity-60' : 'border-hair text-ink2'"
          >
            <span class="font-mono">{{ m.displayName }}</span>
            <BaseTag :color="tierClass(m.tier)">{{ m.tier }}</BaseTag>
          </span>
        </div>
        <p class="mt-2 text-[11px] leading-relaxed text-ink3">
          Cursor 与 Claude 各一套、互不相同；切引擎即换池。<span v-if="modelNote"> · {{ modelNote }}</span>
        </p>
        <p v-if="loadError" class="mt-2 text-[11px] text-down">{{ loadError }}</p>
      </section>

      <!-- 需求输入 -->
      <section>
        <p class="kicker mb-2">★ Pipeline · 自驱开发</p>
        <h2 class="font-serif text-[24px] font-light leading-tight tracking-tight text-ink">
          自驱开发<em class="italic text-brand">流水线</em>。
        </h2>
        <p class="mt-1.5 font-serif text-[14px] font-light leading-relaxed text-ink2">
          难度评估 → 出方案 → 拆 TODO → 每个 TODO 自循环开发。
        </p>

        <div class="mt-5 space-y-4">
          <div>
            <label class="label-caps mb-1.5 block">需求</label>
            <textarea
              v-model="requirement"
              rows="3"
              class="w-full rounded-md border border-hair-strong bg-surface px-3 py-2.5 text-base leading-relaxed text-ink"
            ></textarea>
          </div>
          <div>
            <label class="label-caps mb-1.5 block">最终目标</label>
            <input
              v-model="goal"
              class="h-12 w-full rounded-md border border-hair-strong bg-surface px-3 text-base text-ink"
            />
          </div>
          <div>
            <label class="label-caps mb-1.5 block">工作目录 cwd（可选）</label>
            <input
              v-model="cwd"
              placeholder="/path/to/target-repo"
              class="h-12 w-full rounded-md border border-hair-strong bg-surface px-3 font-mono text-sm text-ink"
            />
          </div>
          <label class="flex items-center gap-2.5 text-sm text-ink2">
            <input v-model="dryRun" type="checkbox" class="h-5 w-5" />
            dryRun（内置 mock，无需 SDK/SK）
          </label>
        </div>
      </section>
    </div>

    <!-- 吸底主操作 -->
    <div class="flex-shrink-0 border-t border-hair bg-surface px-4 py-3">
      <div
        v-if="runState.error.value"
        class="mb-2 rounded-md border border-hair bg-down-bg px-3 py-2 text-[12px] text-down"
      >
        {{ runState.error.value }}
      </div>
      <button
        type="button"
        :disabled="runState.running.value"
        class="flex h-[52px] w-full items-center justify-center gap-3 rounded-md border border-brand bg-brand font-serif text-[17px] text-[#faf5f0] transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
        @click="handleStartRun"
      >
        <span>{{ runState.running.value ? "运行中…" : "评估并自驱运行" }}</span>
        <span v-if="!runState.running.value" class="font-light italic">→</span>
      </button>
    </div>
  </div>
</template>
