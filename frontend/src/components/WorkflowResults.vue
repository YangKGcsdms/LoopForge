<script setup lang="ts">
import { ref, computed, nextTick, onUpdated } from "vue";
import BaseCard from "./BaseCard.vue";
import StatusBadge from "./StatusBadge.vue";
import SectionTitle from "./SectionTitle.vue";
import { kindClass, diffClass } from "../lib/format";
import { type UseRunState } from "../composables/useRun";

interface Props {
  useRunState: UseRunState;
}

const props = defineProps<Props>();

// 根据 status 映射到 StatusBadge 需要的类型
const nodeStatusMap: Record<string, "completed" | "error"> = {
  ok: "completed",
  error: "error",
};

const getNodeStatus = (status: string) => {
  return nodeStatusMap[status] || ("idle" as const);
};

// 自动滚动引用和状态
const resultsContainer = ref<HTMLDivElement | null>(null);
const shouldAutoScroll = ref(true);

// 监听用户滚动，停止自动滚动
const handleScroll = () => {
  if (!resultsContainer.value) return;
  const el = resultsContainer.value;
  // 如果用户滚动到底部附近（100px以内），保持自动滚动
  const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  shouldAutoScroll.value = isNearBottom;
};

// 当新内容添加时自动滚动到底部
onUpdated(async () => {
  if (!shouldAutoScroll.value || !resultsContainer.value) return;
  await nextTick();
  const el = resultsContainer.value;
  // 使用 requestAnimationFrame 确保 DOM 已更新
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
});

// 计算当前状态
const currentStatus = computed(() => {
  if (props.useRunState.error.value) return "error";
  if (props.useRunState.finalDone.value) return "completed";
  if (props.useRunState.running.value) return "running";
  if (props.useRunState.live.value.length > 0) return "completed";
  return "empty";
});

// 状态描述
const statusDescriptions: Record<string, string> = {
  empty: "等待运行...",
  error: "运行出错",
  running: "正在运行...",
  completed: "运行完成",
};
</script>

<template>
  <div>
    <!-- 状态：空态 -->
    <BaseCard
      v-if="currentStatus === 'empty'"
      variant="default"
      size="lg"
      tone="neutral"
    >
      <div class="flex flex-col items-center justify-center gap-4 py-12">
        <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
          <svg class="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="text-center">
          <h3 class="text-sm font-semibold text-slate-900">等待运行</h3>
          <p class="mt-1 text-xs text-slate-700">在左侧表单中填写需求并点击运行按钮</p>
        </div>
      </div>
    </BaseCard>

    <!-- 状态：错误态 -->
    <BaseCard
      v-if="currentStatus === 'error'"
      variant="default"
      size="lg"
      tone="neutral"
    >
      <div class="flex flex-col gap-4">
        <div class="flex items-start gap-3 rounded-lg bg-rose-50 p-4">
          <div class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-rose-100">
            <svg class="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-rose-900">运行出错</h3>
            <p class="mt-1 whitespace-pre-wrap text-sm text-rose-800">{{ props.useRunState.error.value }}</p>
          </div>
        </div>
        <p class="text-xs text-slate-700">错误已捕获，不会阻塞后续运行。请修改参数后重试。</p>
      </div>
    </BaseCard>

    <!-- 状态：加载 + 运行中 + 完成（有内容显示） -->
    <BaseCard
      v-if="(currentStatus === 'running' || currentStatus === 'completed') && props.useRunState.live.value.length > 0"
      variant="default"
      size="lg"
      tone="neutral"
      class="flex flex-col"
    >
      <!-- 标题区与状态指示 -->
      <div class="mb-6 flex items-center justify-between">
        <SectionTitle
          title="实时自驱运行"
          level="h2"
          spacing="md"
          divider
          divider-color="neutral"
        />
        <StatusBadge
          :status="currentStatus === 'running' ? 'running' : 'completed'"
          :label="currentStatus === 'running' ? '运行中...' : '已完成'"
          compact
        />
      </div>

      <!-- 难度指标 -->
      <div v-if="props.useRunState.difficulty.value" class="mb-6">
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm font-medium text-slate-800">难度</span>
          <span
            :class="[
              diffClass(props.useRunState.difficulty.value.value),
              'rounded-sm px-3 py-1 text-sm font-semibold'
            ]"
          >
            {{ props.useRunState.difficulty.value.value }}
          </span>
          <span v-if="props.useRunState.difficulty.value.reason" class="text-sm text-slate-700">
            {{ props.useRunState.difficulty.value.reason }}
          </span>
        </div>
      </div>

      <!-- 路由方案 -->
      <div v-if="props.useRunState.routing.value" class="mb-6">
        <h3 class="mb-3 text-sm font-semibold text-slate-800">路由方案</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1 rounded-md bg-slate-50 p-3">
            <span class="text-xs font-medium text-slate-700">出方案</span>
            <span class="font-mono text-sm font-medium text-slate-900">
              {{ props.useRunState.routing.value.plan }}
            </span>
          </div>
          <div class="flex flex-col gap-1 rounded-md bg-slate-50 p-3">
            <span class="text-xs font-medium text-slate-700">执行</span>
            <span class="font-mono text-sm font-medium text-slate-900">
              {{ props.useRunState.routing.value.execute }}
            </span>
          </div>
          <div class="flex flex-col gap-1 rounded-md bg-slate-50 p-3">
            <span class="text-xs font-medium text-slate-700">评审</span>
            <span class="font-mono text-sm font-medium text-slate-900">
              {{ props.useRunState.routing.value.review }}
            </span>
          </div>
          <div class="flex flex-col gap-1 rounded-md bg-slate-50 p-3">
            <span class="text-xs font-medium text-slate-700">测试</span>
            <span class="font-mono text-sm font-medium text-slate-900">
              {{ props.useRunState.routing.value.test }}
            </span>
          </div>
        </div>
      </div>

      <!-- 动态内容流容器（带自动滚动） -->
      <div
        ref="resultsContainer"
        class="space-y-4 overflow-y-auto pr-2"
        style="max-height: 500px;"
        @scroll="handleScroll"
      >
        <template v-for="item in props.useRunState.live.value" :key="item.key">
          <!-- 阶段分隔符 -->
          <div v-if="item.kind === 'phase'" class="flex items-center gap-3 py-2">
            <span class="h-px flex-1 bg-slate-200"></span>
            <span class="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {{ (item as any).name }}
            </span>
            <span class="h-px flex-1 bg-slate-200"></span>
          </div>

          <!-- TODO 列表卡片 -->
          <BaseCard
            v-else-if="item.kind === 'todos'"
            variant="default"
            size="sm"
            tone="info"
          >
            <div class="mb-3 flex items-center justify-between">
              <h4 class="text-sm font-semibold text-slate-900">
                TODO 列表
              </h4>
              <span class="inline-flex items-center justify-center rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-900">
                {{ (item as any).subtasks.length }} 项
              </span>
            </div>
            <ul class="space-y-2">
              <li
                v-for="s in (item as any).subtasks"
                :key="s.id"
                class="flex flex-col gap-1.5 border-l-2 border-slate-400 pl-3 text-sm"
              >
                <div class="flex items-baseline gap-2">
                  <span class="font-mono font-semibold text-slate-900">{{ s.id }}</span>
                  <span class="font-medium text-slate-800">{{ s.title }}</span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-block rounded-sm bg-white px-2 py-1 text-xs font-medium text-slate-700">
                    {{ s.estimateHours }}h
                  </span>
                  <span class="text-xs text-slate-700">{{ s.acceptance }}</span>
                </div>
              </li>
            </ul>
          </BaseCard>

          <!-- 节点卡片（打字机流） -->
          <BaseCard
            v-else
            variant="default"
            size="sm"
            :tone="(item as any).status === 'error' ? 'default' : 'neutral'"
          >
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <span class="font-mono font-bold text-slate-950">{{ (item as any).id }}</span>
              <span
                :class="[
                  kindClass((item as any).nodeKind),
                  'rounded-sm px-2 py-0.5 text-xs font-semibold'
                ]"
              >
                {{ (item as any).nodeKind }}
              </span>
              <span
                v-if="(item as any).iteration"
                class="rounded-sm bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-800"
              >
                第 {{ (item as any).iteration }} 轮
              </span>
              <StatusBadge
                :status="getNodeStatus((item as any).status)"
                :label="(item as any).status"
                compact
              />
            </div>
            <pre
              :class="[
                'overflow-x-auto whitespace-pre-wrap rounded-sm font-mono text-xs leading-relaxed p-3',
                (item as any).status === 'error'
                  ? 'bg-rose-50 text-rose-800'
                  : 'bg-slate-50 text-slate-900'
              ]"
            >{{ (item as any).typed
              }}<span v-if="(item as any).typed.length < (item as any).full.length" class="animate-pulse text-slate-600">▋</span></pre>
          </BaseCard>
        </template>
      </div>

      <!-- 最终完成状态 -->
      <BaseCard
        v-if="props.useRunState.finalDone.value"
        variant="default"
        size="sm"
        tone="success"
        class="mt-4"
      >
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="font-semibold text-emerald-800">运行完成</span>
            <StatusBadge status="completed" label="✓ 完成" compact />
          </div>
          <div class="space-y-1 text-sm text-emerald-800">
            <p>拆出 <span class="font-semibold">{{ props.useRunState.finalDone.value.todos }}</span> 个 TODO</p>
            <p>自循环开发完成 <span class="font-semibold">{{ props.useRunState.finalDone.value.developed }}</span> 个</p>
          </div>
        </div>
      </BaseCard>
    </BaseCard>
  </div>
</template>
