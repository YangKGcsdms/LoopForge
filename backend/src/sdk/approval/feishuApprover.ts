/**
 * 飞书审批器 —— 把 Claude 的工具使用请求（Bash 等）发成飞书互动卡片，
 * 经长连接（WSClient）接收卡片按钮回调（card.action.trigger），人点「同意/拒绝」后 resolve。
 *
 * 不需要公网 webhook：回调走长连接。一个 pendingApprovals 表用 reqId 关联卡片与挂起的 Promise。
 * 关键：canUseTool 的 Promise 可以无限挂起，agent 会停在那等审批（见 docs/claude-agent-sdk/03-权限与安全.md）。
 */

import * as lark from "@larksuiteoapi/node-sdk";
import { randomUUID } from "node:crypto";
import type { ToolApprovalRequest, ToolApprovalResult, ToolApprover } from "../types.js";

export interface FeishuApproverConfig {
  appId: string;
  appSecret: string;
  /** 审批人/群标识：open_id / user_id / union_id / chat_id / email。 */
  receiveId: string;
  receiveIdType: "open_id" | "user_id" | "union_id" | "chat_id" | "email";
  /** 审批超时(ms)，超时自动拒绝。默认 10 分钟。 */
  timeoutMs?: number;
}

export interface FeishuApprover {
  approve: ToolApprover;
  /** 启动长连接，开始接收卡片回调。整条服务起一次即可。 */
  start(): void;
  /** 关闭长连接并把挂起审批全部拒绝（配置变更重建时调用）。 */
  stop(): void;
  /** 待处理审批数（调试用）。 */
  pendingCount(): number;
}

type Pending = { resolve: (r: ToolApprovalResult) => void; timer: ReturnType<typeof setTimeout> };

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

/** 构造带「同意/拒绝」按钮的互动卡片；按钮 value 里带 reqId + decision，回调时据此定位。 */
function buildCard(reqId: string, tool: string, preview: string, cwd?: string) {
  return {
    config: { wide_screen_mode: true },
    header: {
      template: "orange",
      title: { tag: "plain_text", content: `🛠 工具审批：${tool}` },
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**工具**：\`${tool}\`\n**内容**：\n\`\`\`\n${preview}\n\`\`\`${cwd ? `\n**目录**：${cwd}` : ""}`,
        },
      },
      {
        tag: "action",
        actions: [
          { tag: "button", text: { tag: "plain_text", content: "✅ 同意" }, type: "primary", value: { reqId, decision: "allow" } },
          { tag: "button", text: { tag: "plain_text", content: "⛔ 拒绝" }, type: "danger", value: { reqId, decision: "deny" } },
        ],
      },
    ],
  };
}

export function createFeishuApprover(cfg: FeishuApproverConfig): FeishuApprover {
  const client = new lark.Client({ appId: cfg.appId, appSecret: cfg.appSecret });
  const wsClient = new lark.WSClient({ appId: cfg.appId, appSecret: cfg.appSecret });
  const pending = new Map<string, Pending>();
  const timeoutMs = cfg.timeoutMs ?? 600_000;
  let seq = 0;

  function settle(reqId: string, result: ToolApprovalResult): boolean {
    const p = pending.get(reqId);
    if (!p) return false;
    clearTimeout(p.timer);
    pending.delete(reqId);
    p.resolve(result);
    return true;
  }

  function start(): void {
    const dispatcher = new lark.EventDispatcher({}).register({
      "card.action.trigger": async (data: unknown) => {
        const value = ((data as { action?: { value?: { reqId?: string; decision?: string } } })?.action?.value) ?? {};
        if (value.reqId) {
          settle(
            value.reqId,
            value.decision === "allow" ? { allow: true } : { allow: false, reason: "飞书审批：已拒绝" },
          );
        }
        return {
          toast: {
            type: value.decision === "allow" ? "success" : "error",
            content: value.decision === "allow" ? "已批准" : "已拒绝",
          },
        };
      },
    });
    wsClient.start({ eventDispatcher: dispatcher });
  }

  const approve: ToolApprover = (req: ToolApprovalRequest) =>
    new Promise<ToolApprovalResult>((resolve) => {
      const reqId = `appr-${Date.now()}-${++seq}`;
      const card = buildCard(reqId, req.tool, previewInput(req.tool, req.input), req.cwd);
      const timer = setTimeout(() => settle(reqId, { allow: false, reason: "飞书审批：超时未响应" }), timeoutMs);
      pending.set(reqId, { resolve, timer });

      req.signal?.addEventListener("abort", () => settle(reqId, { allow: false, reason: "运行已取消" }));

      client.im.message
        .create({
          params: { receive_id_type: cfg.receiveIdType },
          data: { receive_id: cfg.receiveId, msg_type: "interactive", content: JSON.stringify(card), uuid: randomUUID() },
        })
        .catch((err: unknown) => {
          // 发卡失败 → 直接拒绝并说明原因，别让 loop 永久挂起
          settle(reqId, { allow: false, reason: `飞书发卡失败：${err instanceof Error ? err.message : String(err)}` });
        });
    });

  function stop(): void {
    // 把挂起审批全部拒绝（别让旧 loop 永久等待），再尽力关闭长连接。
    for (const reqId of [...pending.keys()]) settle(reqId, { allow: false, reason: "审批通道已重建/关闭" });
    try {
      (wsClient as unknown as { stop?: () => void }).stop?.();
    } catch {
      /* best-effort：SDK 无 stop 则忽略 */
    }
  }

  return { approve, start, stop, pendingCount: () => pending.size };
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
