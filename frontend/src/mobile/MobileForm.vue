<script setup lang="ts">
/**
 * H5 运行表单 —— 纯任务入口（需求/目标/cwd/dryRun + 吸底主操作）。
 * 核心 Agent 选择 / 路由 / 模型已挪到「配置」tab（SkConfig）。
 */
import { type UseRunState, type UseRunActions } from "../composables/useRun";
import { type WorkflowForm } from "../composables/useWorkflowForm";

const props = defineProps<{
  runState: UseRunState & UseRunActions;
  formState: WorkflowForm;
}>();

const { provider, requirement, goal, cwd, dryRun } = props.formState;

function handleStartRun() {
  props.runState.startRun({
    requirement: requirement.value,
    goal: goal.value,
    provider: provider.value,
    dryRun: dryRun.value,
    cwd: cwd.value,
  });
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-1 space-y-6 overflow-y-auto px-4 py-5">
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
            <label class="label-caps mb-1.5 block">
              工作目录 cwd<span class="ml-1 normal-case tracking-normal text-ink3">（可选）</span>
            </label>
            <input
              v-model="cwd"
              placeholder="/path/to/target-repo"
              class="h-12 w-full rounded-md border border-hair-strong bg-surface px-3 font-mono text-sm text-ink"
            />
          </div>
          <label class="flex cursor-pointer items-start gap-3 rounded-md border border-hair bg-surface2 px-3 py-3">
            <input v-model="dryRun" type="checkbox" class="mt-0.5 h-5 w-5 accent-[var(--brand)]" />
            <span class="leading-snug">
              <span class="block text-sm font-medium text-ink">dryRun 演示模式</span>
              <span class="mt-0.5 block text-[12px] text-ink3">内置 mock，无需 SDK / SK / 登录态。</span>
            </span>
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
