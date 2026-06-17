/**
 * 飞书审批器 —— 把 Claude 的工具使用请求（Bash 等）发成飞书互动卡片，
 * 经长连接（WSClient）接收卡片按钮回调（card.action.trigger），人点「同意/拒绝」后 resolve。
 *
 * 不需要公网 webhook：回调走长连接。一个 pendingApprovals 表用 reqId 关联卡片与挂起的 Promise。
 * 关键：canUseTool 的 Promise 可以无限挂起，agent 会停在那等审批（见 docs/claude-agent-sdk/03-权限与安全.md）。
 */

import * as lark from "@larksuiteoapi/node-sdk";
import { randomUUID } from "node:crypto";
import type {
  AskHuman,
  AskHumanRequest,
  AskHumanResult,
  ToolApprovalRequest,
  ToolApprovalResult,
  ToolApprover,
} from "../types.js";

export interface FeishuApproverConfig {
  appId: string;
  appSecret: string;
  /** 审批人/群标识：open_id / user_id / union_id / chat_id / email。 */
  receiveId: string;
  receiveIdType: "open_id" | "user_id" | "union_id" | "chat_id" | "email";
  /** 单轮等待超时(ms)，超时则标记旧卡过期并重发新卡。默认 60 分钟。 */
  timeoutMs?: number;
  /** 最多发几轮卡（含首轮）；连续无人理满 maxRounds 轮后自动继续。默认 2。 */
  maxRounds?: number;
}

export interface FeishuApprover {
  approve: ToolApprover;
  /** 人工问询：agent 纠结时发问询卡，人点选项作答。act 默认 auto，只走这条而非逐工具审批。 */
  ask: AskHuman;
  /** 启动长连接，开始接收卡片回调。整条服务起一次即可。 */
  start(): void;
  /** 关闭长连接并把挂起审批全部拒绝（配置变更重建时调用）。 */
  stop(): void;
  /** 待处理审批数（调试用）。 */
  pendingCount(): number;
}

/** 一个挂起的问询：可能跨多轮重发，记录所有已发卡片以便结算时统一更新。 */
type Pending = {
  resolve: (r: { answer: string }) => void;
  /** 取消当前轮的等待计时器（重发时换新计时器、结算时清掉）。 */
  clearTimer: () => void;
  title: string;
  body: string;
  /** 已发出的所有卡片 message_id（结算/过期时全部 patch 成终态，防止旧卡误触）。 */
  messageIds: string[];
};

/** 回调时间戳（本地时区，人读用）。 */
function nowText(): string {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

/** 把工具入参压成一行人能看懂的预览。 */
function previewInput(tool: string, input: unknown): string {
  const o = (input ?? {}) as Record<string, unknown>;
  if (tool === "Bash" && typeof o.command === "string") return o.command;
  if ((tool === "Write" || tool === "Edit") && typeof o.file_path === "string") return String(o.file_path);
  try {
    return JSON.stringify(o).slice(0, 300);
  } catch {
    return String(o);
  }
}

/** 一个可点的选项：展示文案 + 回填给 agent 的答复文本。 */
interface CardOption {
  label: string;
  answer: string;
  type?: "primary" | "danger" | "default";
}

/** 构造带选项按钮的互动卡片；按钮 value 里带 reqId + answer，回调时据此定位并回填。 */
export function buildCard(
  reqId: string,
  opts: { title: string; body: string; options: CardOption[]; template?: string },
) {
  return {
    config: { wide_screen_mode: true },
    header: {
      template: opts.template ?? "orange",
      title: { tag: "plain_text", content: opts.title },
    },
    elements: [
      { tag: "div", text: { tag: "lark_md", content: opts.body } },
      {
        tag: "action",
        actions: opts.options.map((o) => ({
          tag: "button",
          text: { tag: "plain_text", content: o.label },
          type: o.type ?? "default",
          value: { reqId, answer: o.answer },
        })),
      },
    ],
  };
}

/** 回调后的「已回调」卡：保留标题/正文，按钮区换成只读结论 + 时间，防重复点击。 */
export function buildRespondedCard(opts: { title: string; body: string; answer: string; at: string }) {
  return {
    config: { wide_screen_mode: true },
    header: { template: "grey", title: { tag: "plain_text", content: opts.title } },
    elements: [
      { tag: "div", text: { tag: "lark_md", content: opts.body } },
      { tag: "hr" },
      { tag: "div", text: { tag: "lark_md", content: `✅ **已回调**：${opts.answer}\n<font color="grey">${opts.at}</font>` } },
    ],
  };
}

/** 卡片过期/终态：保留标题正文，按钮区换成只读说明（防重复点击 + 状态对齐）。 */
export function buildExpiredCard(opts: { title: string; body: string; note: string; at: string }) {
  return {
    config: { wide_screen_mode: true },
    header: { template: "grey", title: { tag: "plain_text", content: opts.title } },
    elements: [
      { tag: "div", text: { tag: "lark_md", content: opts.body } },
      { tag: "hr" },
      { tag: "div", text: { tag: "lark_md", content: `⏱ ${opts.note}\n<font color="grey">${opts.at}</font>` } },
    ],
  };
}

/** act 工具审批正文。 */
function approvalBody(tool: string, preview: string, cwd?: string): string {
  return `**工具**：\`${tool}\`\n**内容**：\n\`\`\`\n${preview}\n\`\`\`${cwd ? `\n**目录**：${cwd}` : ""}`;
}

/** ask_human 问询正文。 */
function askBody(req: AskHumanRequest): string {
  return [`**Agent 求助**：\n${req.question}`, req.context ? `\n**已尝试**：${req.context}` : ""].filter(Boolean).join("");
}

export function createFeishuApprover(cfg: FeishuApproverConfig): FeishuApprover {
  const client = new lark.Client({ appId: cfg.appId, appSecret: cfg.appSecret });
  const wsClient = new lark.WSClient({ appId: cfg.appId, appSecret: cfg.appSecret });
  const pending = new Map<string, Pending>();
  const timeoutMs = cfg.timeoutMs ?? 3_600_000; // 默认单轮 60 分钟
  const maxRounds = Math.max(1, cfg.maxRounds ?? 2);
  let seq = 0;

  /** 更新一张已发出的卡片（best-effort，失败忽略——卡片更新不是关键路径）。 */
  async function patchCard(messageId: string, card: unknown): Promise<void> {
    try {
      await client.im.message.patch({ path: { message_id: messageId }, data: { content: JSON.stringify(card) } });
    } catch {
      /* best-effort：网络/权限问题不阻塞主流程 */
    }
  }

  /**
   * 结算一个挂起问询：清计时器、出表、resolve，并把**所有**已发卡片更新为「已回调」只读态
   * （含被重发的旧卡——旧卡迟点也只会看到终态，不会再卡住）。返回元信息。
   */
  function settle(reqId: string, answer: string): Pending | undefined {
    const p = pending.get(reqId);
    if (!p) return undefined;
    p.clearTimer();
    pending.delete(reqId);
    p.resolve({ answer });
    const at = nowText();
    for (const mid of p.messageIds) void patchCard(mid, buildRespondedCard({ title: p.title, body: p.body, answer, at }));
    return p;
  }

  function start(): void {
    const dispatcher = new lark.EventDispatcher({}).register({
      "card.action.trigger": async (data: unknown) => {
        const value = ((data as { action?: { value?: { reqId?: string; answer?: string } } })?.action?.value) ?? {};
        if (!value.reqId || typeof value.answer !== "string") {
          return { toast: { type: "error", content: "无效的回调" } };
        }
        const meta = settle(value.reqId, value.answer);
        if (!meta) return { toast: { type: "info", content: "该卡片已处理或已过期" } };
        // 回调后把原卡更新为「已回调」只读态（按钮消失，防重复点击）。
        return {
          toast: { type: "success", content: "已回调" },
          card: {
            type: "raw",
            data: buildRespondedCard({ title: meta.title, body: meta.body, answer: value.answer, at: nowText() }),
          },
        };
      },
    });
    wsClient.start({ eventDispatcher: dispatcher });
  }

  /**
   * 通用发卡 + 挂起（可跨多轮）：返回 agent 的答复文本。
   * 单轮超时 → 把当轮卡标记「已过期」；还有剩余轮次就重发新卡再等，否则以兜底答复 resolve。
   * 发卡失败/取消同样以兜底答复 resolve —— **绝不永久挂起**。同一 reqId 贯穿所有轮，旧卡迟点也能命中。
   */
  function sendAndWait(
    reqId: string,
    title: string,
    body: string,
    makeCard: (round: number) => unknown,
    fallback: string,
    signal?: AbortSignal,
  ): Promise<{ answer: string }> {
    return new Promise<{ answer: string }>((resolve) => {
      const messageIds: string[] = [];
      let timer: ReturnType<typeof setTimeout> | undefined;
      let round = 0;
      pending.set(reqId, { resolve, clearTimer: () => clearTimeout(timer), title, body, messageIds });
      signal?.addEventListener("abort", () => settle(reqId, "运行已取消"));

      const onTimeout = () => {
        if (!pending.has(reqId)) return;
        const lastMid = messageIds[messageIds.length - 1];
        const more = round < maxRounds;
        if (lastMid) {
          void patchCard(lastMid, buildExpiredCard({
            title,
            body,
            note: more ? "本轮无人响应，已重发提醒卡。" : "无人响应，已自动按默认继续。",
            at: nowText(),
          }));
        }
        if (more) void sendRound();
        else settle(reqId, fallback);
      };

      const sendRound = async () => {
        round += 1;
        try {
          const resp = (await client.im.message.create({
            params: { receive_id_type: cfg.receiveIdType },
            data: {
              receive_id: cfg.receiveId,
              msg_type: "interactive",
              content: JSON.stringify(makeCard(round)),
              uuid: randomUUID(),
            },
          })) as { data?: { message_id?: string } };
          const mid = resp?.data?.message_id;
          if (mid) messageIds.push(mid);
        } catch (err) {
          settle(reqId, `飞书发卡失败：${err instanceof Error ? err.message : String(err)}`);
          return;
        }
        if (pending.has(reqId)) timer = setTimeout(onTimeout, timeoutMs);
      };

      void sendRound();
    });
  }

  const approve: ToolApprover = async (req: ToolApprovalRequest): Promise<ToolApprovalResult> => {
    const reqId = `appr-${Date.now()}-${++seq}`;
    const title = `🛠 工具审批：${req.tool}`;
    const body = approvalBody(req.tool, previewInput(req.tool, req.input), req.cwd);
    const makeCard = (round: number) =>
      buildCard(reqId, {
        title: round > 1 ? `${title}（第 ${round} 次提醒）` : title,
        body,
        options: [
          { label: "✅ 同意", answer: "allow", type: "primary" },
          { label: "⛔ 拒绝", answer: "deny", type: "danger" },
        ],
      });
    const { answer } = await sendAndWait(reqId, title, body, makeCard, "deny", req.signal);
    return answer === "allow" ? { allow: true } : { allow: false, reason: answer === "deny" ? "飞书审批：已拒绝" : answer };
  };

  const ask: AskHuman = async (req: AskHumanRequest): Promise<AskHumanResult> => {
    const reqId = `ask-${Date.now()}-${++seq}`;
    const title = "🤔 Agent 求助";
    const body = askBody(req);
    // 有显式选项就用它，否则给「继续 / 换思路」两个默认选项。
    const options: CardOption[] =
      req.options && req.options.length
        ? req.options.map((o, i) => ({ label: o, answer: o, type: i === 0 ? "primary" : "default" }))
        : [
            { label: "✅ 可以，继续", answer: "可以，按你的判断继续。", type: "primary" },
            { label: "🔄 换个思路", answer: "这个方向不行，请换一个思路。", type: "default" },
          ];
    const makeCard = (round: number) =>
      buildCard(reqId, {
        title: round > 1 ? `${title}（第 ${round} 次提醒）` : title,
        body,
        options,
        template: "blue",
      });
    const { answer } = await sendAndWait(reqId, title, body, makeCard, "人未在限时内答复，已按默认继续。", req.signal);
    return { answer };
  };

  function stop(): void {
    // 把挂起卡片全部以兜底答复结算（别让旧 loop 永久等待），再尽力关闭长连接。
    for (const reqId of [...pending.keys()]) settle(reqId, "审批通道已重建/关闭");
    try {
      (wsClient as unknown as { stop?: () => void }).stop?.();
    } catch {
      /* best-effort：SDK 无 stop 则忽略 */
    }
  }

  return { approve, ask, start, stop, pendingCount: () => pending.size };
}

/** 测试卡：确认 aksk + receive_id 能把卡片发到目标飞书（不等回调，仅验证发送链路）。 */
function buildTestCard() {
  return {
    config: { wide_screen_mode: true },
    header: { template: "green", title: { tag: "plain_text", content: "✅ 飞书审批连通测试" } },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content:
            "**LoopForge 已接通飞书。**\n后续 act 节点跑 **Bash 等需审批的工具**时，会把审批卡发到这里，点「✅ 同意 / ⛔ 拒绝」即可远程裁决（走长连接回调，无需公网 webhook）。",
        },
      },
    ],
  };
}

/** 真发一张测试卡，验证 aksk/receive_id 配置可用。返回是否成功 + 说明。 */
export async function sendFeishuTest(cfg: FeishuApproverConfig): Promise<{ ok: boolean; detail: string }> {
  const client = new lark.Client({ appId: cfg.appId, appSecret: cfg.appSecret });
  try {
    const r = (await client.im.message.create({
      params: { receive_id_type: cfg.receiveIdType },
      data: { receive_id: cfg.receiveId, msg_type: "interactive", content: JSON.stringify(buildTestCard()), uuid: randomUUID() },
    })) as { code?: number; msg?: string };
    if (typeof r?.code === "number" && r.code !== 0) {
      return { ok: false, detail: `飞书返回 code=${r.code}：${r.msg ?? "见飞书开放平台错误码"}` };
    }
    return { ok: true, detail: `测试卡片已发往 ${cfg.receiveIdType}=${cfg.receiveId}，请到飞书查收。` };
  } catch (err) {
    return { ok: false, detail: `发送失败：${err instanceof Error ? err.message : String(err)}` };
  }
}
