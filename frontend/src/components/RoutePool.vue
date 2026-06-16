<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { api, type CatalogModel } from "../api/client";
import { tierClass } from "../lib/format";
import BaseCard from "./BaseCard.vue";

const props = defineProps<{ provider: string }>();

const models = ref<CatalogModel[]>([]);
const modelSource = ref("");
const modelNote = ref("");
const poolRouting = ref<Record<string, string> | null>(null);

async function loadModels() {
  try {
    const res = await api.getModels(props.provider);
    models.value = res.models;
    modelSource.value = res.source;
    modelNote.value = res.note ?? "";
    poolRouting.value = res.routing ?? null;
  } catch {
    models.value = [];
    poolRouting.value = null;
    modelSource.value = "";
    modelNote.value = "";
  }
}

// 路由卡片跟随所选 SDK 切换
watch(() => props.provider, loadModels);
onMounted(loadModels);

const routeLabels: { key: string; label: string }[] = [
  { key: "plan", label: "出方案" },
  { key: "execute", label: "执行" },
  { key: "review", label: "评审" },
  { key: "test", label: "测试" },
];
</script>

<template>
  <BaseCard variant="default" size="md">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-serif text-xl font-normal tracking-tight text-slate-900">
        路由池 · {{ provider === "cursor" ? "Cursor SDK" : "Claude Agent SDK" }}
      </h2>
      <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
        {{ modelSource === "live" ? "实时可用性" : "可用性未知" }}
      </span>
    </div>

    <!-- 按用途路由（list-row 风格） -->
    <div v-if="poolRouting" class="mb-4 space-y-0">
      <div
        v-for="r in routeLabels"
        :key="r.key"
        class="flex items-baseline justify-between border-t border-slate-200/70 py-2.5 first:border-t-0"
      >
        <span class="label-caps">{{ r.label }}</span>
        <span class="font-mono text-sm text-slate-900">{{ poolRouting[r.key] }}</span>
      </div>
    </div>

    <!-- 模型池 chips -->
    <div class="mb-1 label-caps">模型池</div>
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
      <span v-if="models.length === 0" class="text-sm text-slate-500">
        暂无模型信息（请先在上方配置并保存该引擎的 SK）
      </span>
    </div>

    <p class="mt-3 text-xs text-slate-500">
      按用途路由，Cursor 与 Claude 各一套、互不相同；切换上方引擎即换池与策略。
      <span v-if="modelNote"> · {{ modelNote }}</span>
    </p>
  </BaseCard>
</template>
