<script setup lang="ts">
import { ref, computed, nextTick, onUpdated } from "vue";
import BaseTag from "./BaseTag.vue";
import StatusBadge from "./StatusBadge.vue";
import LiveSession from "./LiveSession.vue";
import { kindClass, diffClass } from "../lib/format";
import { type UseRunState } from "../composables/useRun";

interface Props {
  useRunState: UseRunState;
}

const props = defineProps<Props>();

const nodeStatusMap: Record<string, "completed" | "error"> = { ok: "completed", error: "error" };
const getNodeStatus = (status: string) => nodeStatusMap[status] || ("idle" as const);

const resultsContainer = ref<HTMLDivElement | null>(null);
const shouldAutoScroll = ref(true);

const handleScroll = () => {
  if (!resultsContainer.value) return;
  const el = resultsContainer.value;
  shouldAutoScroll.value = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
};

onUpdated(async () => {
  if (!shouldAutoScroll.value || !resultsContainer.value) return;
  await nextTick();
  const el = resultsContainer.value;
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
});

const routingRows = computed(() => {
  const r = props.useRunState.routing.value;
  if (!r) return [];
  return [
    { label: "出方案", value: r.plan },
    { label: "执行", value: r.execute },
    { label: "评审", value: r.review },
    { label: "测试", value: r.test },
  ];
});

const currentStatus = computed(() => {
  if (props.useRunState.error.value) return "error";
  if (props.useRunState.finalDone.value) return "completed";
  if (props.useRunState.running.value) return "running";
  if (props.useRunState.live.value.length > 0) return "completed";
  return "empty";
});
</script>

<template>
  <div class="rounded-lg border border-hair bg-surface">
    <!-- 顶部状态条 -->
    <div class="flex items-center justify-between border-b border-hair px-6 py-4">
      <div class="section-label flex-1">
        <span class="ornament">·</span>
        <span class="caps">实时自驱运行 · Live Run</span>
      </div>
      <StatusBadge v-if="currentStatus === 'running'" status="running" label="运行中" compact />
      <StatusBadge v-else-if="currentStatus === 'completed'" status="completed" label="已完成" compact />
      <StatusBadge v-else-if="currentStatus === 'error'" status="error" label="出错" compact />
    </div>

    <div class="p-6">
      <!-- 空态 -->
      <div v-if="currentStatus === 'empty'" class="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <span class="font-serif text-[40px] font-light italic text-ink4">∅</span>
        <div>
          <h3 class="font-serif text-[20px] font-normal text-ink">等待运行</h3>
          <p class="mt-1.5 text-[13px] text-ink3">在左侧表单中填写需求并点击「评估并自驱运行」</p>
        </div>
      </div>

      <!-- 错误态 -->
      <div v-else-if="currentStatus === 'error'" class="rounded-md border border-hair bg-down-bg p-5">
        <h3 class="label-caps text-down">运行出错</h3>
        <p class="mt-2 whitespace-pre-wrap font-serif text-[15px] text-ink">{{ props.useRunState.error.value }}</p>
        <p class="mt-3 text-[12px] text-ink3">错误已捕获，不会阻塞后续运行。请修改参数后重试。</p>
      </div>

      <!-- 运行中 / 完成 -->
      <template v-else>
        <!-- 难度 + 路由摘要 -->
        <div v-if="props.useRunState.difficulty.value" class="mb-5 flex flex-wrap items-baseline gap-2.5">
          <span class="label-caps">难度</span>
          <BaseTag :color="diffClass(props.useRunState.difficulty.value.value)">
            {{ props.useRunState.difficulty.value.value }}
          </BaseTag>
          <span v-if="props.useRunState.difficulty.value.reason" class="font-serif text-[14px] italic text-ink2">
            {{ props.useRunState.difficulty.value.reason }}
          </span>
        </div>

        <div v-if="routingRows.length" class="mb-6">
          <div class="section-label mb-1">
            <span class="caps">路由方案</span>
            <span class="rule"></span>
          </div>
          <div class="grid grid-cols-2 gap-x-8">
            <div
              v-for="r in routingRows"
              :key="r.label"
              class="flex items-baseline justify-between gap-3 border-t border-hair-soft py-2.5"
            >
              <span class="label-caps tracking-caps">{{ r.label }}</span>
              <span class="truncate font-mono text-[12px] text-ink">{{ r.value }}</span>
            </div>
          </div>
        </div>

        <!-- 运行中节点：加载态 + 内部 SDK session 实时输出（类 GUI Claude Code） -->
        <div v-if="props.useRunState.activeNodes.value.length" class="mb-4 space-y-3">
          <LiveSession
            v-for="n in props.useRunState.activeNodes.value"
            :key="`${n.id}#${n.iteration}`"
            :node="n"
          />
        </div>

        <!-- 内容流 -->
        <div ref="resultsContainer" class="space-y-4 overflow-y-auto pr-1" style="max-height: 56vh" @scroll="handleScroll">
          <template v-for="item in props.useRunState.live.value" :key="item.key">
            <!-- 阶段分隔（section-label） -->
            <div v-if="item.kind === 'phase'" class="section-label pt-2">
              <span class="ornament">§</span>
              <span class="caps">{{ (item as any).name }}</span>
              <span class="rule"></span>
            </div>

            <!-- TODO 列表：编辑感序号账本 -->
            <div v-else-if="item.kind === 'todos'" class="rounded-md border border-hair bg-brand-bg p-4">
              <div class="mb-3 flex items-baseline justify-between">
                <span class="label-caps">TODO 列表</span>
                <span class="font-serif text-[15px] italic text-ink2">{{ (item as any).subtasks.length }} 项</span>
              </div>
              <ul>
                <li
                  v-for="(s, i) in (item as any).subtasks"
                  :key="s.id"
                  class="grid grid-cols-[28px_1fr] gap-3 border-t border-hair-soft py-2.5 first:border-t-0"
                >
                  <span class="seq text-[15px]">{{ String(i + 1).padStart(2, "0") }}</span>
                  <div>
                    <div class="flex items-baseline gap-2">
                      <span class="font-mono text-[11px] text-ink3">{{ s.id }}</span>
                      <span class="font-serif text-[15px] text-ink">{{ s.title }}</span>
                    </div>
                    <div class="mt-1 flex flex-wrap items-center gap-2">
                      <BaseTag color="tone-mute" mono>{{ s.estimateHours }}h</BaseTag>
                      <span class="text-[12px] text-ink3">{{ s.acceptance }}</span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>

            <!-- 节点卡片（打字机流） -->
            <div
              v-else
              class="rounded-md border p-4"
              :class="(item as any).status === 'error' ? 'border-hair bg-down-bg' : 'border-hair bg-surface'"
            >
              <div class="mb-2.5 flex flex-wrap items-center gap-2">
                <span class="font-mono text-[13px] font-medium text-ink">{{ (item as any).id }}</span>
                <BaseTag :color="kindClass((item as any).nodeKind)">{{ (item as any).nodeKind }}</BaseTag>
                <BaseTag v-if="(item as any).iteration" color="tone-mute">第 {{ (item as any).iteration }} 轮</BaseTag>
                <span class="flex-1"></span>
                <StatusBadge :status="getNodeStatus((item as any).status)" :label="(item as any).status" compact />
              </div>
              <pre
                class="overflow-x-auto whitespace-pre-wrap rounded border border-hair-soft bg-surface2 p-3 font-mono text-[12px] leading-relaxed text-ink"
              >{{ (item as any).typed
                }}<span v-if="(item as any).typed.length < (item as any).full.length" class="animate-pulse text-brand">▋</span></pre>
            </div>
          </template>
        </div>

        <!-- 最终完成 -->
        <div v-if="props.useRunState.finalDone.value" class="mt-5 rounded-md border border-hair bg-up-bg p-5">
          <div class="mb-2 flex items-center justify-between">
            <span class="label-caps text-up">运行完成</span>
            <StatusBadge status="completed" label="完成" compact />
          </div>
          <p class="font-serif text-[16px] text-ink">
            拆出 <span class="font-serif text-[22px] font-light">{{ props.useRunState.finalDone.value.todos }}</span> 个 TODO，
            自循环开发完成
            <span class="font-serif text-[22px] font-light">{{ props.useRunState.finalDone.value.developed }}</span> 个
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
