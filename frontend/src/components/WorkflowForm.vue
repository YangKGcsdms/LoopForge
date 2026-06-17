<script setup lang="ts">
/** 提交任务 —— 纯任务入口（需求/目标/cwd/dryRun + 运行）。核心 Agent 选择已挪到「配置」tab。 */
import { type UseRunState, type UseRunActions } from "../composables/useRun";
import { type WorkflowForm } from "../composables/useWorkflowForm";
import BaseInput from "./BaseInput.vue";

interface Props {
  useRunState: UseRunState & UseRunActions;
  formState: WorkflowForm;
}

const props = defineProps<Props>();
// 共享表单字段（App 持有，与 H5 版同一实例）；provider 由「配置」tab 设定。
const { provider, requirement, goal, cwd, dryRun } = props.formState;

function handleStartRun() {
  props.useRunState.startRun({
    requirement: requirement.value,
    goal: goal.value,
    provider: provider.value,
    dryRun: dryRun.value,
    cwd: cwd.value,
  });
}
</script>

<template>
  <section>
    <p class="kicker mb-2.5">★ Pipeline · 自驱开发</p>
    <h2 class="font-serif text-[28px] font-light leading-[1.15] tracking-tight text-ink">
      自驱开发<em class="italic text-brand">流水线</em>。
    </h2>
    <p class="mt-2 max-w-md font-serif text-[15px] font-light leading-relaxed text-ink2">
      难度评估 → 出方案 → 拆解成 N 个 3~5 工时任务 → 每个 TODO <em class="italic text-ink">自循环</em>开发（开发→评审→矫正→通过）。
    </p>

    <div class="mt-7 space-y-5">
      <div>
        <label class="label-caps mb-2 block">需求</label>
        <textarea
          v-model="requirement"
          rows="4"
          class="w-full rounded-md border border-hair-strong bg-surface px-3.5 py-3 text-sm leading-relaxed text-ink transition-colors focus:border-brand focus:outline-none"
        ></textarea>
      </div>

      <div>
        <label class="label-caps mb-2 block">最终目标</label>
        <BaseInput v-model="goal" fullWidth />
      </div>

      <div>
        <label class="label-caps mb-2 block">
          工作目录 cwd<span class="ml-1 normal-case tracking-normal text-ink3">（可选）</span>
        </label>
        <BaseInput
          v-model="cwd"
          placeholder="/path/to/target-repo —— agent 在这个目录下开发代码"
          class="font-mono"
          fullWidth
        />
      </div>

      <!-- 运行选项：dryRun 卡片化，主次清晰 -->
      <label class="flex cursor-pointer items-start gap-3 rounded-md border border-hair bg-surface2 px-3.5 py-3 transition-colors hover:border-hair-strong">
        <input v-model="dryRun" type="checkbox" class="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
        <span class="leading-snug">
          <span class="block text-sm font-medium text-ink">dryRun 演示模式</span>
          <span class="mt-0.5 block text-[12px] text-ink3">内置 mock，无需 SDK / SK / 登录态即可跑通整条流水线。</span>
        </span>
      </label>
    </div>

    <!-- 编辑感 CTA -->
    <button
      type="button"
      :disabled="props.useRunState.running.value"
      class="mt-7 flex h-[52px] w-full items-center justify-center gap-3 rounded-md border border-brand bg-brand font-serif text-[17px] text-[#faf5f0] transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
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
</template>
