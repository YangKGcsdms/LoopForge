<script setup lang="ts">
/**
 * H5 结果流 —— 暖色账本风：全宽单列、占满高度、随新内容自动滚到底。
 * 数据与打字机逻辑复用 useRun（live / difficulty / routing / finalDone）。
 */
import { computed, nextTick, onUpdated, ref } from "vue";
import BaseTag from "../components/BaseTag.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { kindClass, diffClass } from "../lib/format";
import { type UseRunState } from "../composables/useRun";

const props = defineProps<{ runState: UseRunState }>();

const nodeStatusMap: Record<string, "completed" | "error"> = { ok: "completed", error: "error" };
const getNodeStatus = (status: string) => nodeStatusMap[status] || ("idle" as const);

const scroller = ref<HTMLDivElement | null>(null);
const autoScroll = ref(true);

function onScroll() {
  const el = scroller.value;
  if (!el) return;
  autoScroll.value = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
}

onUpdated(async () => {
  if (!autoScroll.value || !scroller.value) return;
  await nextTick();
  requestAnimationFrame(() => {
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  });
});

const routingRows = computed(() => {
  const r = props.runState.routing.value;
  if (!r) return [];
  return [
    { label: "出方案", value: r.plan },
    { label: "执行", value: r.execute },
    { label: "评审", value: r.review },
    { label: "测试", value: r.test },
  ];
});

const status = computed(() => {
  if (props.runState.error.value) return "error";
  if (props.runState.finalDone.value) return "completed";
  if (props.runState.running.value) return "running";
  if (props.runState.live.value.length > 0) return "completed";
  return "empty";
});
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 顶部状态条 -->
    <div class="flex flex-shrink-0 items-center justify-between border-b border-hair bg-paper px-4 py-3">
      <div class="section-label flex-1">
        <span class="ornament">·</span>
        <span class="caps">实时自驱运行</span>
      </div>
      <StatusBadge v-if="status === 'running'" status="running" label="运行中" compact />
      <StatusBadge v-else-if="status === 'completed'" status="completed" label="已完成" compact />
      <StatusBadge v-else-if="status === 'error'" status="error" label="出错" compact />
    </div>

    <!-- 滚动区 -->
    <div ref="scroller" class="flex-1 overflow-y-auto px-4 py-5" @scroll="onScroll">
      <!-- 空态 -->
      <div v-if="status === 'empty'" class="flex h-full flex-col items-center justify-center gap-3 text-center">
        <span class="font-serif text-[40px] font-light italic text-ink4">∅</span>
        <div>
          <h3 class="font-serif text-[18px] text-ink">等待运行</h3>
          <p class="mt-1 text-[12px] text-ink3">在「运行」页填写需求并点底部按钮</p>
        </div>
      </div>

      <!-- 错误态 -->
      <div v-else-if="status === 'error'" class="rounded-md border border-hair bg-down-bg p-4">
        <h3 class="label-caps text-down">运行出错</h3>
        <p class="mt-2 whitespace-pre-wrap font-serif text-[15px] text-ink">{{ runState.error.value }}</p>
        <p class="mt-2 text-[12px] text-ink3">错误已捕获，不会阻塞后续运行。改参数后重试。</p>
      </div>

      <!-- 运行中 / 完成 -->
      <template v-else>
        <!-- 难度 + 路由摘要 -->
        <div v-if="runState.difficulty.value" class="mb-4 flex flex-wrap items-baseline gap-2">
          <span class="label-caps">难度</span>
          <BaseTag :color="diffClass(runState.difficulty.value.value)">{{ runState.difficulty.value.value }}</BaseTag>
          <span v-if="runState.difficulty.value.reason" class="font-serif text-[13px] italic text-ink2">
            {{ runState.difficulty.value.reason }}
          </span>
        </div>

        <div v-if="routingRows.length" class="mb-5">
          <div class="section-label mb-1">
            <span class="caps">路由方案</span>
            <span class="rule"></span>
          </div>
          <div class="grid grid-cols-2 gap-x-6">
            <div
              v-for="r in routingRows"
              :key="r.label"
              class="flex items-baseline justify-between gap-2 border-t border-hair-soft py-2"
            >
              <span class="label-caps tracking-caps">{{ r.label }}</span>
              <span class="truncate font-mono text-[11px] text-ink">{{ r.value }}</span>
            </div>
          </div>
        </div>

        <!-- 内容流 -->
        <div class="space-y-3.5">
          <template v-for="item in runState.live.value" :key="item.key">
            <!-- 阶段分隔 -->
            <div v-if="item.kind === 'phase'" class="section-label pt-1">
              <span class="ornament">§</span>
              <span class="caps">{{ (item as any).name }}</span>
              <span class="rule"></span>
            </div>

            <!-- TODO 列表 -->
            <div v-else-if="item.kind === 'todos'" class="rounded-md border border-hair bg-brand-bg p-3.5">
              <div class="mb-2 flex items-baseline justify-between">
                <span class="label-caps">TODO 列表</span>
                <span class="font-serif text-[14px] italic text-ink2">{{ (item as any).subtasks.length }} 项</span>
              </div>
              <ul>
                <li
                  v-for="(s, i) in (item as any).subtasks"
                  :key="s.id"
                  class="grid grid-cols-[24px_1fr] gap-2.5 border-t border-hair-soft py-2 first:border-t-0"
                >
                  <span class="seq text-[14px]">{{ String(i + 1).padStart(2, "0") }}</span>
                  <div>
                    <div class="flex items-baseline gap-1.5">
                      <span class="font-mono text-[10px] text-ink3">{{ s.id }}</span>
                      <span class="font-serif text-[14px] text-ink">{{ s.title }}</span>
                    </div>
                    <div class="mt-1 flex flex-wrap items-center gap-1.5">
                      <BaseTag color="tone-mute" mono>{{ s.estimateHours }}h</BaseTag>
                      <span class="text-[11px] text-ink3">{{ s.acceptance }}</span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>

            <!-- 节点卡片（打字机流） -->
            <div
              v-else
              class="rounded-md border p-3.5"
              :class="(item as any).status === 'error' ? 'border-hair bg-down-bg' : 'border-hair bg-surface'"
            >
              <div class="mb-2 flex flex-wrap items-center gap-1.5">
                <span class="font-mono text-[12px] font-medium text-ink">{{ (item as any).id }}</span>
                <BaseTag :color="kindClass((item as any).nodeKind)">{{ (item as any).nodeKind }}</BaseTag>
                <BaseTag v-if="(item as any).iteration" color="tone-mute">第 {{ (item as any).iteration }} 轮</BaseTag>
                <span class="flex-1"></span>
                <StatusBadge :status="getNodeStatus((item as any).status)" :label="(item as any).status" compact />
              </div>
              <pre
                class="overflow-x-auto whitespace-pre-wrap rounded border border-hair-soft bg-surface2 p-2.5 font-mono text-[11px] leading-relaxed text-ink"
              >{{ (item as any).typed
                }}<span v-if="(item as any).typed.length < (item as any).full.length" class="animate-pulse text-brand">▋</span></pre>
            </div>
          </template>
        </div>

        <!-- 最终完成 -->
        <div v-if="runState.finalDone.value" class="mt-4 rounded-md border border-hair bg-up-bg p-4">
          <div class="mb-1.5 flex items-center justify-between">
            <span class="label-caps text-up">运行完成</span>
            <StatusBadge status="completed" label="完成" compact />
          </div>
          <p class="font-serif text-[15px] text-ink">
            拆出 <span class="font-serif text-[20px] font-light">{{ runState.finalDone.value.todos }}</span> 个 TODO，完成
            <span class="font-serif text-[20px] font-light">{{ runState.finalDone.value.developed }}</span> 个
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
