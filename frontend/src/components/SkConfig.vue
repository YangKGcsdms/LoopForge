<script setup lang="ts">
/**
 * 配置 tab —— 核心 Agent 选择 + 按用途路由/模型池 + SK 凭据配置。
 * provider 取自共享 formState（与运行同一实例）；cursor 已冻结(unsupported)，不展示。
 * 刷新/切 Agent 时自动探测登录态，结果通过 validated 事件抛给操作台 tab 显示状态点。
 */
import { computed, onMounted, ref } from "vue";
import { api, type ProviderInfo, type SkStatus, type FeishuStatus } from "../api/client";
import { tierClass } from "../lib/format";
import { useModels } from "../composables/useModels";
import { type WorkflowForm } from "../composables/useWorkflowForm";
import BaseButton from "./BaseButton.vue";
import BaseInput from "./BaseInput.vue";
import BaseSelect from "./BaseSelect.vue";
import BaseTag from "./BaseTag.vue";

type Tone = "idle" | "ok" | "error" | "info";

const props = defineProps<{ formState: WorkflowForm }>();
const emit = defineEmits<{ validated: [result: { valid: boolean; detail: string }] }>();

// 核心 Agent = 运行用的 provider（共享 formState 实例）。
const { provider } = props.formState;

const providers = ref<ProviderInfo[]>([]);
const agents = computed(() => providers.value.filter((p) => p.supported)); // cursor 冻结=unsupported，自动排除

const apiKey = ref("");
const showKey = ref(false);
const status = ref<SkStatus | null>(null);
const busy = ref<null | "load" | "save" | "validate" | "clear">(null);
const message = ref("");
const tone = ref<Tone>("idle");

const { models, modelSource, modelNote, poolRouting, loadError, load } = useModels();

// ── 飞书审批配置 ──
const feishu = ref<FeishuStatus | null>(null);
const fsAppId = ref("");
const fsAppSecret = ref("");
const fsReceiveId = ref("");
const fsReceiveIdType = ref("user_id");
const fsBusy = ref<null | "save" | "test" | "clear">(null);
const fsMessage = ref("");
const fsTone = ref<Tone>("idle");
const receiveIdTypes = ["user_id", "open_id", "union_id", "chat_id", "email"];

const isClaude = computed(() => provider.value === "claude-agent");
const keyPlaceholder = computed(() =>
  isClaude.value ? "可留空（用本机 Claude Code 登录态），或粘贴 Anthropic API Key" : "粘贴该 Agent 的 API Key",
);
const providerHint = computed(() =>
  isClaude.value
    ? "Claude Code SDK：SK 可留空，运行时用本机 Claude Code 登录态（订阅）。刷新会自动探测登录态。"
    : "需填该 Agent 的 API Key。",
);

const routingLabels: Record<string, string> = {
  plan: "出方案",
  control: "管控",
  execute: "执行",
  validate: "校验",
  review: "评审",
  test: "测试",
};
const routingRows = computed(() =>
  poolRouting.value
    ? Object.entries(poolRouting.value).map(([key, value]) => ({ key, label: routingLabels[key] ?? key, value }))
    : [],
);

function toneClass(t: Tone): string {
  switch (t) {
    case "ok":
      return "bg-up-bg text-up border-hair";
    case "error":
      return "bg-down-bg text-down border-hair";
    case "info":
      return "bg-brand-bg text-brand-ink border-hair";
    default:
      return "hidden";
  }
}
const messageClass = computed(() => toneClass(tone.value));
const fsMessageClass = computed(() => toneClass(fsTone.value));

function notify(text: string, t: Tone) {
  message.value = text;
  tone.value = t;
}

function fsNotify(text: string, t: Tone) {
  fsMessage.value = text;
  fsTone.value = t;
}

async function loadProviders() {
  try {
    providers.value = (await api.listProviders()).providers;
  } catch (err) {
    notify(`加载 Agent 列表失败：${(err as Error).message}`, "error");
  }
}

async function loadStatus() {
  busy.value = "load";
  try {
    status.value = await api.getSkStatus(provider.value);
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
    status.value = await api.saveSk(provider.value, apiKey.value.trim());
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
    // 输入框有内容则校验输入的，否则校验已保存的（claude-agent 留空则探本机登录态）
    const result = await api.validateSk(provider.value, apiKey.value.trim() || undefined);
    if (result.valid) {
      const who = result.identity?.userEmail ?? result.identity?.apiKeyName;
      notify(`${result.detail}${who ? ` 当前身份：${who}` : ""}`, "ok");
    } else {
      notify(result.detail, "error");
    }
    emit("validated", { valid: result.valid, detail: result.detail });
  } catch (err) {
    const detail = `校验失败：${(err as Error).message}`;
    notify(detail, "error");
    emit("validated", { valid: false, detail });
  } finally {
    busy.value = null;
  }
}

async function clear() {
  busy.value = "clear";
  try {
    await api.clearSk(provider.value);
    status.value = await api.getSkStatus(provider.value);
    notify("已清除该 Agent 的 SK。", "info");
  } catch (err) {
    notify(`清除失败：${(err as Error).message}`, "error");
  } finally {
    busy.value = null;
  }
}

/** 切换核心 Agent / 刷新：重载模型池 + SK 状态 + 自动探测登录态。 */
async function refreshAgent() {
  await load(provider.value);
  await loadStatus();
  await validate();
}

function selectAgent(id: string) {
  if (provider.value === id) return;
  provider.value = id;
  void refreshAgent();
}

async function loadFeishu() {
  try {
    feishu.value = await api.getFeishuStatus();
    if (feishu.value?.receiveIdType) fsReceiveIdType.value = feishu.value.receiveIdType;
  } catch {
    /* 状态读不到不影响其它配置 */
  }
}

async function saveFeishu() {
  fsBusy.value = "save";
  try {
    feishu.value = await api.saveFeishu({
      appId: fsAppId.value.trim() || undefined,
      appSecret: fsAppSecret.value.trim() || undefined,
      receiveId: fsReceiveId.value.trim() || undefined,
      receiveIdType: fsReceiveIdType.value,
    });
    fsAppSecret.value = ""; // 保存后不在内存里留 secret
    fsNotify("飞书配置已保存，下次运行即生效。", "ok");
  } catch (err) {
    fsNotify(`保存失败：${(err as Error).message}`, "error");
  } finally {
    fsBusy.value = null;
  }
}

async function testFeishu() {
  fsBusy.value = "test";
  try {
    const r = await api.testFeishu();
    fsNotify(r.detail, r.ok ? "ok" : "error");
  } catch (err) {
    fsNotify(`测试失败：${(err as Error).message}`, "error");
  } finally {
    fsBusy.value = null;
  }
}

async function clearFeishu() {
  fsBusy.value = "clear";
  try {
    await api.clearFeishu();
    feishu.value = await api.getFeishuStatus();
    fsNotify("已清除飞书配置。", "info");
  } catch (err) {
    fsNotify(`清除失败：${(err as Error).message}`, "error");
  } finally {
    fsBusy.value = null;
  }
}

onMounted(async () => {
  await loadProviders();
  await refreshAgent();
  await loadFeishu();
});
</script>

<template>
  <section class="space-y-9">
    <!-- ── 核心 Agent + 路由/模型 ── -->
    <div>
      <div class="section-label mb-4">
        <span class="ornament">·</span>
        <span class="caps">核心 Agent · Core Agent</span>
        <span class="rule"></span>
        <span class="label-caps shrink-0 normal-case tracking-wide">
          {{ modelSource === "live" ? "实时可用" : "可用性未知" }}
        </span>
      </div>

      <div class="grid grid-cols-1 gap-2.5">
        <button
          v-for="a in agents"
          :key="a.id"
          type="button"
          :class="[
            'flex items-center gap-2.5 rounded-md border px-3.5 py-3 text-left transition-colors',
            provider === a.id ? 'border-brand bg-brand-bg' : 'border-hair hover:border-hair-strong',
          ]"
          @click="selectAgent(a.id)"
        >
          <span :class="['h-1.5 w-1.5 rounded-full', provider === a.id ? 'bg-brand' : 'bg-ink4']"></span>
          <span :class="['text-sm font-medium', provider === a.id ? 'text-ink' : 'text-ink2']">{{ a.displayName }}</span>
        </button>
      </div>

      <div class="mt-5">
        <div class="section-label mb-1">
          <span class="caps">按用途路由 · Routing</span>
          <span class="rule"></span>
        </div>
        <div v-if="routingRows.length" class="grid grid-cols-2 gap-x-8">
          <div
            v-for="row in routingRows"
            :key="row.key"
            class="flex items-baseline justify-between gap-3 border-t border-hair-soft py-2.5"
          >
            <span class="label-caps tracking-caps">{{ row.label }}</span>
            <span class="truncate font-mono text-[12px] text-ink">{{ row.value }}</span>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-1.5">
          <span
            v-for="m in models"
            :key="m.id"
            class="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[12px]"
            :class="m.available === false ? 'border-hair-soft text-ink3 opacity-60' : 'border-hair text-ink2'"
          >
            <span class="font-mono">{{ m.displayName }}</span>
            <BaseTag :color="tierClass(m.tier)">{{ m.tier }}</BaseTag>
            <BaseTag v-if="m.available === false" color="tone-down">禁用</BaseTag>
          </span>
        </div>
        <p class="mt-3 text-[12px] leading-relaxed text-ink3">
          按节点用途路由模型控成本。<span v-if="modelNote"> · {{ modelNote }}</span>
        </p>
        <p v-if="loadError" class="mt-2 text-[12px] text-down">{{ loadError }}</p>
      </div>
    </div>

    <!-- ── SK 凭据 ── -->
    <div class="border-t border-hair pt-7">
      <div class="section-label mb-4">
        <span class="ornament">·</span>
        <span class="caps">SK 配置 · Credential</span>
        <span class="rule"></span>
      </div>
      <p class="mb-4 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink3">
        <span class="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-brand"></span>
        {{ providerHint }}
      </p>

      <!-- 当前状态 -->
      <div class="mb-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-hair-soft py-3 text-sm">
        <span class="label-caps">当前状态</span>
        <template v-if="status?.configured">
          <span class="font-medium text-up">已配置</span>
          <span class="font-mono text-[12px] text-ink2">{{ status.maskedKey }}</span>
          <BaseTag v-if="status.source === 'env'" color="tone-mute">来自环境变量</BaseTag>
          <span v-if="status.updatedAt" class="font-mono text-[11px] text-ink3">
            更新于 {{ new Date(status.updatedAt).toLocaleString() }}
          </span>
        </template>
        <span v-else class="text-ink3">未配置</span>
      </div>

      <!-- SK 输入 -->
      <div class="mb-5">
        <label class="label-caps mb-2 block">Secret Key</label>
        <div class="flex gap-2">
          <BaseInput
            v-model="apiKey"
            :type="showKey ? 'text' : 'password'"
            :placeholder="keyPlaceholder"
            class="font-mono"
            fullWidth
          />
          <BaseButton type="button" variant="secondary" @click="showKey = !showKey">
            {{ showKey ? "隐藏" : "显示" }}
          </BaseButton>
        </div>
        <p class="mt-2 text-[12px] text-ink3">SK 仅发送到本地后端并落盘于 backend/.data，不经第三方。</p>
      </div>

      <!-- 操作按钮 -->
      <div class="flex flex-wrap gap-2.5">
        <BaseButton type="button" variant="primary" :disabled="busy !== null" @click="save">
          {{ busy === "save" ? "保存中…" : "保存" }}
        </BaseButton>
        <BaseButton type="button" variant="secondary" :disabled="busy !== null" @click="validate">
          {{ busy === "validate" ? "校验中…" : "验证连接" }}
        </BaseButton>
        <BaseButton type="button" variant="danger" class="ml-auto" :disabled="busy !== null" @click="clear">
          {{ busy === "clear" ? "清除中…" : "清除" }}
        </BaseButton>
      </div>

      <!-- 消息提示 -->
      <div v-if="tone !== 'idle'" :class="messageClass" class="mt-5 rounded-md border px-4 py-3 text-[13px]">
        {{ message }}
      </div>
    </div>

    <!-- ── 飞书审批 ── -->
    <div class="border-t border-hair pt-7">
      <div class="section-label mb-4">
        <span class="ornament">·</span>
        <span class="caps">飞书审批 · Feishu Approval</span>
        <span class="rule"></span>
        <span v-if="feishu?.configured" class="label-caps shrink-0 normal-case tracking-wide text-up">已配置</span>
      </div>
      <p class="mb-4 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink3">
        <span class="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-brand"></span>
        act 节点跑 Bash 等需审批的工具时，会发互动卡到飞书，点「同意 / 拒绝」远程裁决（走长连接回调，无需公网 webhook）。
      </p>

      <!-- 当前状态 -->
      <div
        v-if="feishu?.configured"
        class="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-hair-soft py-3 text-sm"
      >
        <span class="label-caps">当前</span>
        <span class="font-mono text-[12px] text-ink2">App {{ feishu.appId }}</span>
        <span class="font-mono text-[12px] text-ink2">· {{ feishu.receiveIdType }}={{ feishu.receiveId }}</span>
        <BaseTag v-if="feishu.source === 'env'" color="tone-mute">来自环境变量</BaseTag>
      </div>

      <div class="space-y-3">
        <div>
          <label class="label-caps mb-1.5 block">App ID</label>
          <BaseInput v-model="fsAppId" placeholder="cli_xxxxxxxx" class="font-mono" fullWidth />
        </div>
        <div>
          <label class="label-caps mb-1.5 block">App Secret</label>
          <BaseInput
            v-model="fsAppSecret"
            type="password"
            placeholder="保存后不回显；留空＝不改动已存的"
            class="font-mono"
            fullWidth
          />
        </div>
        <div class="flex gap-2">
          <div class="min-w-0 flex-1">
            <label class="label-caps mb-1.5 block">Receive ID</label>
            <BaseInput v-model="fsReceiveId" placeholder="你的飞书用户 id" class="font-mono" fullWidth />
          </div>
          <div class="w-32 shrink-0">
            <label class="label-caps mb-1.5 block">类型</label>
            <BaseSelect v-model="fsReceiveIdType" fullWidth>
              <option v-for="t in receiveIdTypes" :key="t" :value="t">{{ t }}</option>
            </BaseSelect>
          </div>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2.5">
        <BaseButton type="button" variant="primary" :disabled="fsBusy !== null" @click="saveFeishu">
          {{ fsBusy === "save" ? "保存中…" : "保存" }}
        </BaseButton>
        <BaseButton type="button" variant="secondary" :disabled="fsBusy !== null" @click="testFeishu">
          {{ fsBusy === "test" ? "发送中…" : "发送测试卡" }}
        </BaseButton>
        <BaseButton type="button" variant="danger" class="ml-auto" :disabled="fsBusy !== null" @click="clearFeishu">
          {{ fsBusy === "clear" ? "清除中…" : "清除" }}
        </BaseButton>
      </div>

      <div v-if="fsTone !== 'idle'" :class="fsMessageClass" class="mt-4 rounded-md border px-4 py-3 text-[13px]">
        {{ fsMessage }}
      </div>
    </div>
  </section>
</template>
