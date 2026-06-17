<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { api } from "../api/client";
import { type UseRunState, type UseRunActions } from "../composables/useRun";
import { useProvider } from "../composables/useProvider";
import BaseButton from "./BaseButton.vue";
import BaseInput from "./BaseInput.vue";
import BaseCard from "./BaseCard.vue";
import FolderPicker from "./FolderPicker.vue";

interface Props {
  useRunState: UseRunState & UseRunActions;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "go-config": [] }>();

// 所选引擎来自全局共享状态（在「配置」页选择并落库）
const { provider, load: loadProvider } = useProvider();

const requirement = ref("检查当前项目新版本的 oa-system-ui 前台权限系统");
const goal = ref("评估 RBAC/ABAC 权限系统进展，缺的补齐，确保能推进");
const cwd = ref("");
const dryRun = ref(true);
const pickerOpen = ref(false);

// SK 配置状态（用于提交前置校验）
const skConfigured = ref(false);

// Cursor 必须配置 SK；Claude Agent 可留空（用本机登录态），故不前置拦截。
const needsSk = computed(() => provider.value === "cursor");
// 非 dryRun 且需要 SK 但未配置 → 阻止提交
const skMissing = computed(() => !dryRun.value && needsSk.value && !skConfigured.value);
const canRun = computed(() => !props.useRunState.running.value && !skMissing.value);

const engineName = computed(() =>
  provider.value === "cursor" ? "Cursor SDK" : "Claude Agent SDK",
);

async function loadSkStatus() {
  try {
    const s = await api.getSkStatus(provider.value);
    skConfigured.value = !!s.configured;
  } catch {
    skConfigured.value = false;
  }
}

function handleStartRun() {
  if (skMissing.value) return;
  // 提交即把输入与所选目录落库，下次打开自动回填
  void api.savePreferences({
    lastRequirement: requirement.value,
    lastGoal: goal.value,
    lastCwd: cwd.value,
  });
  props.useRunState.startRun({
    requirement: requirement.value,
    goal: goal.value,
    provider: provider.value,
    dryRun: dryRun.value,
    cwd: cwd.value,
  });
}

// 引擎切换 / 取消 dryRun 时重新探测 SK 状态
watch(provider, loadSkStatus);
watch(dryRun, (val) => {
  if (!val) void loadSkStatus();
});

onMounted(async () => {
  await loadProvider();
  void loadSkStatus();
  // 回填上次提交的输入与目录
  try {
    const prefs = await api.getPreferences();
    if (prefs.lastRequirement) requirement.value = prefs.lastRequirement;
    if (prefs.lastGoal) goal.value = prefs.lastGoal;
    if (prefs.lastCwd) cwd.value = prefs.lastCwd;
  } catch {
    // 忽略：拿不到偏好时保留默认值
  }
});
</script>

<template>
  <!-- 运行表单：输入内容置顶 -->
  <BaseCard variant="default" size="md">
    <div class="mb-1 flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="font-serif text-xl font-normal tracking-tight text-slate-900">自驱开发流水线</h2>
      <button
        type="button"
        class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
        @click="emit('go-config')"
      >
        引擎 · {{ engineName }} ›
      </button>
    </div>
    <p class="mb-5 text-sm text-slate-500">
      难度评估 → 出方案 → 拆解成 N 个 3~5 工时任务 → 每个 TODO 自循环开发（开发→评审→矫正→通过）。
    </p>

    <label class="mb-1.5 block text-sm font-medium text-slate-800">需求</label>
    <textarea
      v-model="requirement"
      rows="2"
      class="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
    ></textarea>

    <label class="mb-1.5 block text-sm font-medium text-slate-800">最终目标</label>
    <BaseInput v-model="goal" class="mb-4" fullWidth />

    <label class="mb-1.5 block text-sm font-medium text-slate-800">工作目录 cwd（可选）</label>
    <div class="mb-4 flex gap-2">
      <BaseInput
        v-model="cwd"
        placeholder="/path/to/target-repo —— agent 在这个目录下开发代码"
        class="font-mono"
        fullWidth
      />
      <BaseButton type="button" variant="secondary" @click="pickerOpen = true">浏览</BaseButton>
    </div>
    <FolderPicker v-model:open="pickerOpen" :initial="cwd" @pick="(p) => (cwd = p)" />

    <label class="mb-4 flex items-center gap-2 text-sm text-slate-800">
      <input v-model="dryRun" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
      dryRun（内置 mock，无需 SDK/SK）
    </label>
    <BaseButton :disabled="!canRun" full-width size="lg" @click="handleStartRun">
      {{ props.useRunState.running.value ? "运行中…" : "评估并自驱运行" }}
    </BaseButton>

    <!-- SK 未配置前置提示（仅 Cursor 且非 dryRun 时拦截） -->
    <div
      v-if="skMissing"
      class="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <span class="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600"></span>
      <span>
        当前引擎（Cursor SDK）尚未配置 SK，无法真实运行。请到
        <button type="button" class="font-medium underline" @click="emit('go-config')">「配置」</button>
        保存密钥，或勾选 <span class="font-medium">dryRun</span> 用内置 mock 体验流程。
      </span>
    </div>

    <div v-if="props.useRunState.error.value" class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ props.useRunState.error.value }}
    </div>
  </BaseCard>
</template>
