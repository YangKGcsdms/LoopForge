<script setup lang="ts">
import { ref, watch } from "vue";
import { api, type FsListResult } from "../api/client";

const props = defineProps<{ open: boolean; initial?: string }>();
const emit = defineEmits<{ "update:open": [v: boolean]; pick: [path: string] }>();

const data = ref<FsListResult | null>(null);
const loading = ref(false);
const err = ref("");

async function load(path?: string) {
  loading.value = true;
  err.value = "";
  try {
    data.value = await api.listDir(path);
  } catch (e) {
    err.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

// 打开时从 initial（或 home）开始
watch(
  () => props.open,
  (open) => {
    if (open) void load(props.initial?.trim() || undefined);
  },
);

function close() {
  emit("update:open", false);
}
function choose() {
  if (data.value) {
    emit("pick", data.value.path);
    close();
  }
}
</script>

<template>
  <div v-if="open" class="sheet-mask" @click.self="close">
    <div class="sheet">
      <div class="sheet__grabber" />
      <h3 class="mb-1 font-serif text-xl font-normal tracking-tight text-slate-900">选择工作目录</h3>

      <!-- 当前路径 -->
      <div class="mb-3 flex items-center gap-2">
        <span class="label-caps shrink-0">当前</span>
        <span class="truncate font-mono text-xs text-slate-700" dir="rtl">{{ data?.path ?? "…" }}</span>
      </div>

      <!-- 快捷：Home / 上一级 -->
      <div class="mb-3 flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
          @click="load(data?.home)"
        >
          ⌂ Home
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 disabled:opacity-40"
          :disabled="!data?.parent"
          @click="data?.parent && load(data.parent)"
        >
          ↑ 上一级
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
          @click="load(data?.path)"
        >
          ↻ 刷新
        </button>
      </div>

      <!-- 目录列表 -->
      <div class="min-h-[160px] rounded-lg border border-slate-200 bg-white">
        <p v-if="loading" class="px-4 py-6 text-center text-sm text-slate-400">加载中…</p>
        <p v-else-if="err" class="px-4 py-6 text-center text-sm text-rose-600">{{ err }}</p>
        <p v-else-if="data && data.entries.length === 0" class="px-4 py-6 text-center text-sm text-slate-400">
          该目录下没有子文件夹
        </p>
        <ul v-else class="max-h-[40vh] overflow-y-auto">
          <li
            v-for="entry in data?.entries ?? []"
            :key="entry.path"
            class="flex cursor-pointer items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-sm first:border-t-0 hover:bg-slate-50"
            @click="load(entry.path)"
          >
            <svg class="h-4 w-4 shrink-0 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            <span class="truncate text-slate-800">{{ entry.name }}</span>
            <span class="ml-auto text-slate-300">›</span>
          </li>
        </ul>
      </div>

      <!-- 操作 -->
      <div class="mt-4 flex gap-3">
        <button
          type="button"
          class="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          @click="close"
        >
          取消
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-slate-50 hover:bg-violet-700 disabled:opacity-50"
          :disabled="!data"
          @click="choose"
        >
          选择此目录
        </button>
      </div>
    </div>
  </div>
</template>
