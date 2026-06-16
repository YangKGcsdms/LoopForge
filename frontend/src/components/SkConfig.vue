<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api, type ProviderInfo, type SkStatus } from "../api/client";
import { useProvider } from "../composables/useProvider";
import BaseButton from "./BaseButton.vue";
import BaseInput from "./BaseInput.vue";
import BaseCard from "./BaseCard.vue";
import BaseSelect from "./BaseSelect.vue";

type Tone = "idle" | "ok" | "error" | "info";

const providers = ref<ProviderInfo[]>([]);
// 所选引擎来自全局共享状态（落库持久化），运行页与配置页同步
const { provider: selectedProvider, load: loadProvider } = useProvider();
const apiKey = ref("");
const showKey = ref(false);
const status = ref<SkStatus | null>(null);

const busy = ref<null | "load" | "save" | "validate" | "clear">(null);
const message = ref("");
const tone = ref<Tone>("idle");

const supportedProviders = computed(() => providers.value.filter((p) => p.supported));
const unsupportedProviders = computed(() => providers.value.filter((p) => !p.supported));

const isClaude = computed(() => selectedProvider.value === "claude-agent");
const keyPlaceholder = computed(() =>
  isClaude.value
    ? "可留空（用本机 Claude Code 登录态），或粘贴 Anthropic API Key"
    : "粘贴你的 Cursor API Key（CURSOR_API_KEY）",
);
const providerHint = computed(() =>
  isClaude.value
    ? "Claude Agent SDK：SK 可留空，运行时用本机 Claude Code 登录态（订阅）。点「验证连接」会真去探测登录态。"
    : "Cursor SDK：需填 Cursor API Key（Dashboard 生成）。",
);

const messageClass = computed(() => {
  switch (tone.value) {
    case "ok":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "error":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "info":
      return "bg-sky-50 text-sky-700 border-sky-200";
    default:
      return "hidden";
  }
});

function notify(text: string, t: Tone) {
  message.value = text;
  tone.value = t;
}

async function loadProviders() {
  try {
    const res = await api.listProviders();
    providers.value = res.providers;
  } catch (err) {
    notify(`加载 Provider 列表失败：${(err as Error).message}`, "error");
  }
}

async function loadStatus() {
  busy.value = "load";
  try {
    status.value = await api.getSkStatus(selectedProvider.value);
  } catch (err) {
    notify(`读取配置状态失败：${(err as Error).message}`, "error");
  } finally {
    busy.value = null;
  }
}

async function save() {
  if (!apiKey.value.trim()) {
    notify("请输入 SK 后再保存。", "error");
    return;
  }
  busy.value = "save";
  try {
    status.value = await api.saveSk(selectedProvider.value, apiKey.value.trim());
    apiKey.value = "";
    notify("SK 已保存。", "ok");
  } catch (err) {
    notify(`保存失败：${(err as Error).message}`, "error");
  } finally {
    busy.value = null;
  }
}

async function validate() {
  busy.value = "validate";
  try {
    // 输入框有内容则校验输入的，否则校验已保存的
    const result = await api.validateSk(selectedProvider.value, apiKey.value.trim() || undefined);
    if (result.valid) {
      const who = result.identity?.userEmail ?? result.identity?.apiKeyName;
      notify(`${result.detail}${who ? ` 当前身份：${who}` : ""}`, "ok");
    } else {
      notify(result.detail, "error");
    }
  } catch (err) {
    notify(`校验失败：${(err as Error).message}`, "error");
  } finally {
    busy.value = null;
  }
}

async function clear() {
  busy.value = "clear";
  try {
    await api.clearSk(selectedProvider.value);
    status.value = await api.getSkStatus(selectedProvider.value);
    notify("已清除该 Provider 的 SK。", "info");
  } catch (err) {
    notify(`清除失败：${(err as Error).message}`, "error");
  } finally {
    busy.value = null;
  }
}

// 切换引擎：落库持久化 + 刷新该引擎的配置状态
// （v-model 已更新共享 ref，此处直接落库）
async function onProviderChange() {
  try {
    await api.savePreferences({ provider: selectedProvider.value });
  } catch {
    // 落库失败不阻塞切换
  }
  await loadStatus();
}

onMounted(async () => {
  await loadProvider();
  await loadProviders();
  await loadStatus();
});
</script>

<template>
  <BaseCard variant="default" size="lg">
    <div class="mb-6">
      <h2 class="font-serif text-xl font-normal tracking-tight text-slate-900">SK 配置</h2>
      <p class="mt-1 text-sm text-slate-700">配置访问密钥（Secret Key）以驱动 SDK 集成层。</p>
    </div>

    <!-- Provider 选择 -->
    <div class="mb-5">
      <label class="mb-1.5 block text-sm font-medium text-slate-800">Provider</label>
      <BaseSelect
        v-model="selectedProvider"
        fullWidth
        @change="onProviderChange"
      >
        <option v-for="p in supportedProviders" :key="p.id" :value="p.id">
          {{ p.displayName }}
        </option>
        <option v-for="p in unsupportedProviders" :key="p.id" :value="p.id" disabled>
          {{ p.displayName }} —— {{ p.note ?? "暂不支持" }}
        </option>
      </BaseSelect>
      <p class="mt-2 flex items-start gap-1.5 text-xs text-amber-900">
        <span class="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600"></span>
        {{ providerHint }}
      </p>
    </div>

    <!-- 当前状态 -->
    <div class="mb-5 rounded-lg bg-slate-50 px-4 py-3 text-sm">
      <span class="text-slate-700">当前状态：</span>
      <template v-if="status?.configured">
        <span class="font-medium text-emerald-600">已配置</span>
        <span class="ml-2 font-mono text-slate-800">{{ status.maskedKey }}</span>
        <span v-if="status.source === 'env'" class="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-800">
          来自环境变量
        </span>
        <span v-if="status.updatedAt" class="ml-2 text-xs text-slate-600">
          更新于 {{ new Date(status.updatedAt).toLocaleString() }}
        </span>
      </template>
      <span v-else class="font-medium text-slate-600">未配置</span>
    </div>

    <!-- SK 输入 -->
    <div class="mb-5">
      <label class="mb-1.5 block text-sm font-medium text-slate-800">Secret Key</label>
      <div class="flex gap-2">
        <BaseInput
          v-model="apiKey"
          :type="showKey ? 'text' : 'password'"
          :placeholder="keyPlaceholder"
          class="font-mono"
          fullWidth
        />
        <BaseButton
          type="button"
          variant="secondary"
          @click="showKey = !showKey"
        >
          {{ showKey ? "隐藏" : "显示" }}
        </BaseButton>
      </div>
      <p class="mt-1.5 text-xs text-slate-600">SK 仅发送到本地后端并落盘于 backend/.data，不经第三方。</p>
    </div>

    <!-- 操作按钮 -->
    <div class="flex flex-wrap gap-3">
      <BaseButton
        type="button"
        variant="primary"
        :disabled="busy !== null"
        @click="save"
      >
        {{ busy === "save" ? "保存中…" : "保存" }}
      </BaseButton>
      <BaseButton
        type="button"
        variant="secondary"
        :disabled="busy !== null"
        @click="validate"
      >
        {{ busy === "validate" ? "校验中…" : "验证连接" }}
      </BaseButton>
      <BaseButton
        type="button"
        variant="danger"
        class="ml-auto"
        :disabled="busy !== null"
        @click="clear"
      >
        {{ busy === "clear" ? "清除中…" : "清除" }}
      </BaseButton>
    </div>

    <!-- 消息提示 -->
    <div v-if="tone !== 'idle'" :class="messageClass" class="mt-5 rounded-lg border px-4 py-3 text-sm">
      {{ message }}
    </div>
  </BaseCard>
</template>
