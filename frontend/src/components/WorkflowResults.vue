<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from "vue";
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

// 自动滚动状态（H5：整页滚动，不用内层嵌套滚动）
const shouldAutoScroll = ref(true);

// 监听用户滚动，离底则停止自动跟随
const handleScroll = () => {
  const scrollBottom = window.innerHeight + window.scrollY;
  const isNearBottom = document.documentElement.scrollHeight - scrollBottom < 120;
  shouldAutoScroll.value = isNearBottom;
};

onMounted(() => window.addEventListener("scroll", handleScroll, { passive: true }));
onUnmounted(() => window.removeEventListener("scroll", handleScroll));

// 自动滚动信号：流条目数 + 末条打字进度。
// 用 watch 精准追踪「内容增长」，避免 onUpdated 在每次无关重渲染（如徽标 hover）时全量触发。
const scrollSignal = computed(() => {
  const arr = props.useRunState.live.value;
  const last = arr[arr.length - 1];
  const typedLen = last && "typed" in last ? (last as { typed: string }).typed.length : 0;
  return arr.length * 1e7 + typedLen;
});

// 内容增长时自动滚动到底部（打字机逐字更新也需跟随）
watch(scrollSignal, async () => {
  if (!shouldAutoScroll.value) return;
  await nextTick();
  requestAnimationFrame(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  });
});

// ── 状态拆分：错误不再「替换」结果，而是以横幅叠加在已产出内容之上 ──
const hasLive = computed(() => props.useRunState.live.value.length > 0);
const hasResults = computed(
  () => hasLive.value || !!props.useRunState.finalDone.value,
);
// 连接中：已点运行但首个事件尚未到达
const connecting = computed(
  () =>
    props.useRunState.running.value &&
    !hasLive.value &&
    !props.useRunState.error.value,
);
// 空态：无运行、无结果、无错误
const showEmpty = computed(
  () =>
    !props.useRunState.error.value &&
    !props.useRunState.running.value &&
    !hasResults.value,
);
// 完成但无可执行任务
const isEmptyResult = computed(() => {
  const d = props.useRunState.finalDone.value;
  return !!d && d.developed === 0;
});
</script>

<template>
  <div class="space-y-4">
    <!-- 错误横幅：始终叠加在最上方，不吞掉已产出内容 -->
    <div
      v-if="props.useRunState.error.value"
      class="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4"
    >
      <div class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-rose-100">
        <svg class="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="flex-1">
        <h3 class="text-sm font-semibold text-rose-900">运行出错</h3>
        <p class="mt-1 whitespace-pre-wrap text-sm text-rose-800">{{ props.useRunState.error.value }}</p>
        <p class="mt-2 text-xs text-rose-700">错误已捕获，不会阻塞后续运行；已产出的内容仍保留在下方。</p>
      </div>
    </div>

    <!-- 状态：空态 -->
    <BaseCard
      v-if="showEmpty"
      variant="default"
      size="lg"
      tone="neutral"
    >
      <div class="flex flex-col items-center justify-center gap-4 py-12">
        <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
          <svg class="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="text-center">
          <h3 class="font-serif text-lg font-normal text-slate-900">等待运行</h3>
          <p class="mt-1 text-xs text-slate-600">在左侧表单中填写需求并点击运行按钮</p>
        </div>
      </div>
    </BaseCard>

    <!-- 状态：连接中 / 启动中（首个事件到达前的骨架） -->
    <BaseCard
      v-if="connecting"
      variant="default"
      size="lg"
      tone="neutral"
    >
      <div class="mb-6 flex items-center justify-between">
        <h3 class="font-serif text-xl font-normal tracking-tight text-slate-900">实时自驱运行</h3>
        <StatusBadge status="running" label="连接中…" compact />
      </div>
      <div class="space-y-3">
        <div class="h-3 w-1/3 animate-pulse rounded bg-slate-200"></div>
        <div class="h-20 animate-pulse rounded-md bg-slate-100"></div>
        <div class="h-3 w-1/4 animate-pulse rounded bg-slate-200"></div>
        <div class="h-16 animate-pulse rounded-md bg-slate-100"></div>
      </div>
      <p class="mt-4 text-xs text-slate-500">正在建立连接、评估难度，稍候片刻…</p>
    </BaseCard>

    <!-- 状态：运行中 / 完成（有内容显示） -->
    <BaseCard
      v-if="hasResults"
      variant="default"
      size="lg"
      tone="neutral"
      class="flex flex-col"
    >
      <!-- 标题区与状态指示 -->
      <div class="mb-6 flex items-center justify-between gap-3">
        <SectionTitle
          title="实时自驱运行"
          level="h2"
          spacing="md"
          divider
          divider-color="neutral"
          class="flex-1"
        />
        <StatusBadge
          :status="props.useRunState.running.value ? 'running' : 'completed'"
          :label="props.useRunState.running.value ? '运行中…' : '已完成'"
          compact
        />
      </div>

      <!-- 难度指标 -->
      <div v-if="props.useRunState.difficulty.value" class="mb-6">
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-xs font-medium uppercase tracking-widest text-slate-500">难度</span>
          <span
            :class="[
              diffClass(props.useRunState.difficulty.value.value),
              'rounded-sm px-3 py-1 font-serif text-base'
            ]"
          >
            {{ props.useRunState.difficulty.value.value }}
          </span>
          <span v-if="props.useRunState.difficulty.value.reason" class="text-sm text-slate-600">
            {{ props.useRunState.difficulty.value.reason }}
          </span>
        </div>
      </div>

      <!-- 路由方案 -->
      <div v-if="props.useRunState.routing.value" class="mb-6">
        <h3 class="mb-3 text-xs font-medium uppercase tracking-widest text-slate-500">路由方案</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50 p-3">
            <span class="text-xs font-medium text-slate-500">出方案</span>
            <span class="font-mono text-sm font-medium text-slate-900">
              {{ props.useRunState.routing.value.plan }}
            </span>
          </div>
          <div class="flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50 p-3">
            <span class="text-xs font-medium text-slate-500">执行</span>
            <span class="font-mono text-sm font-medium text-slate-900">
              {{ props.useRunState.routing.value.execute }}
            </span>
          </div>
          <div class="flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50 p-3">
            <span class="text-xs font-medium text-slate-500">评审</span>
            <span class="font-mono text-sm font-medium text-slate-900">
              {{ props.useRunState.routing.value.review }}
            </span>
          </div>
          <div class="flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50 p-3">
            <span class="text-xs font-medium text-slate-500">测试</span>
            <span class="font-mono text-sm font-medium text-slate-900">
              {{ props.useRunState.routing.value.test }}
            </span>
          </div>
        </div>
      </div>

      <!-- 动态内容流容器（整页滚动 + 自动跟随末条） -->
      <div class="space-y-4">
        <!-- 内容随整页滚动，autoscroll 监听 window -->
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
            tone="neutral"
          >
            <div class="mb-3 flex items-center justify-between">
              <h4 class="text-sm font-semibold text-slate-900">
                TODO 列表
              </h4>
              <span class="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-1 font-serif text-sm text-slate-900">
                {{ (item as any).subtasks.length }} 项
              </span>
            </div>
            <ul class="space-y-2">
              <li
                v-for="s in (item as any).subtasks"
                :key="s.id"
                class="flex flex-col gap-1.5 border-l-2 border-slate-300 pl-3 text-sm"
              >
                <div class="flex items-baseline gap-2">
                  <span class="font-mono font-semibold text-slate-900">{{ s.id }}</span>
                  <span class="font-medium text-slate-800">{{ s.title }}</span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-block rounded-sm bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {{ s.estimateHours }}h
                  </span>
                  <span class="text-xs text-slate-600">{{ s.acceptance }}</span>
                </div>
              </li>
            </ul>
          </BaseCard>

          <!-- 节点卡片（打字机流） -->
          <BaseCard
            v-else
            variant="default"
            size="sm"
            tone="neutral"
          >
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <span class="font-mono font-bold text-slate-900">{{ (item as any).id }}</span>
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
                class="rounded-sm bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
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
              }}<span v-if="(item as any).typed.length < (item as any).full.length" class="animate-pulse text-slate-500">▋</span></pre>
          </BaseCard>
        </template>
      </div>

      <!-- 最终完成状态 -->
      <BaseCard
        v-if="props.useRunState.finalDone.value"
        variant="default"
        size="sm"
        :tone="isEmptyResult ? 'warning' : 'success'"
        class="mt-4"
      >
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span v-if="isEmptyResult" class="font-semibold text-amber-800">无可执行任务</span>
            <span v-else class="font-semibold text-emerald-800">运行完成</span>
            <StatusBadge :status="isEmptyResult ? 'idle' : 'completed'" :label="isEmptyResult ? '空结果' : '✓ 完成'" compact />
          </div>
          <div v-if="isEmptyResult" class="text-sm text-amber-800">
            本次未拆出可执行的开发任务，请调整需求/目标后重试。
          </div>
          <div v-else class="space-y-1 text-sm text-emerald-800">
            <p>拆出 <span class="font-serif text-base">{{ props.useRunState.finalDone.value.todos }}</span> 个 TODO</p>
            <p>自循环开发完成 <span class="font-serif text-base">{{ props.useRunState.finalDone.value.developed }}</span> 个</p>
          </div>
        </div>
      </BaseCard>
    </BaseCard>
  </div>
</template>
