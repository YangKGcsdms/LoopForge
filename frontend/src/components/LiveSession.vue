<script setup lang="ts">
/**
 * 运行中节点的内部 SDK session 实时转写 —— 类 GUI Claude Code 的"开发中"终端。
 * 消费 useRun 的 activeNode：思考/正文流式追加，工具调用 + 结果成对呈现，ask_human 高亮。
 */
import { ref, nextTick, onUpdated } from "vue";
import BaseTag from "./BaseTag.vue";
import { kindClass } from "../lib/format";
import type { ActiveNode } from "../composables/useRun";

defineProps<{ node: ActiveNode }>();

const scroller = ref<HTMLDivElement | null>(null);
onUpdated(async () => {
  await nextTick();
  const el = scroller.value;
  if (el) el.scrollTop = el.scrollHeight;
});
</script>

<template>
  <div class="rounded-md border border-brand bg-surface2">
    <div class="flex items-center gap-2 border-b border-hair px-4 py-2.5">
      <span class="relative flex h-2 w-2">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60"></span>
        <span class="relative inline-flex h-2 w-2 rounded-full bg-brand"></span>
      </span>
      <span class="font-mono text-[13px] font-medium text-ink">{{ node.id }}</span>
      <BaseTag :color="kindClass(node.kind)">{{ node.kind }}</BaseTag>
      <BaseTag v-if="node.iteration" color="tone-mute">第 {{ node.iteration }} 轮</BaseTag>
      <span class="flex-1"></span>
      <span class="label-caps text-brand">{{ node.status === "starting" ? "启动中" : "运行中" }} · LIVE</span>
    </div>

    <div ref="scroller" class="space-y-2 overflow-y-auto p-4 font-mono text-[12px] leading-relaxed" style="max-height: 40vh">
      <template v-for="(en, i) in node.entries" :key="i">
        <!-- 思考 -->
        <p v-if="en.t === 'think'" class="whitespace-pre-wrap italic text-ink3">💭 {{ en.text }}</p>

        <!-- 正文 -->
        <p v-else-if="en.t === 'say'" class="whitespace-pre-wrap text-ink">{{ en.text }}</p>

        <!-- 工具调用 + 结果 -->
        <div v-else-if="en.t === 'tool'" class="rounded border border-hair-soft bg-surface px-3 py-2">
          <div class="flex items-center gap-2">
            <span
              class="inline-block h-1.5 w-1.5 rounded-full"
              :class="en.ok === null ? 'animate-pulse bg-brand' : en.ok ? 'bg-up' : 'bg-down'"
            ></span>
            <span class="font-medium text-brand">{{ en.tool }}</span>
            <span class="truncate text-ink2">{{ en.input }}</span>
          </div>
          <p v-if="en.preview" class="mt-1 truncate pl-3.5 text-[11px] text-ink3">{{ en.preview }}</p>
        </div>

        <!-- 人工问询 -->
        <div v-else-if="en.t === 'ask'" class="rounded border border-brand bg-brand-bg px-3 py-2">
          <span class="label-caps text-brand">需要你拍板</span>
          <p class="mt-1 whitespace-pre-wrap text-ink">{{ en.question }}</p>
          <p class="mt-1 text-[11px] text-ink3">已发飞书卡片，等待回调…</p>
        </div>
      </template>

      <!-- 还没有产出：加载态（think 节点没有流式，停在这里直到产出） -->
      <p v-if="!node.entries.length" class="flex items-center gap-2 text-ink3">
        <span class="flex gap-1">
          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" style="animation-delay: 0ms"></span>
          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" style="animation-delay: 150ms"></span>
          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" style="animation-delay: 300ms"></span>
        </span>
        {{ node.kind === "evaluator" ? "评审中…" : node.kind === "gate" ? "裁决中…" : "思考中…" }}
      </p>
      <span v-else class="animate-pulse text-brand">▋</span>
    </div>
  </div>
</template>
