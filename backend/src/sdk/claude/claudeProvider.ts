import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SdkProvider } from "../provider.js";
import type {
  AgentActOptions,
  AgentActResult,
  AgentSendOptions,
  AgentSendResult,
  ProviderInfo,
  SdkModelInfo,
  ValidateResult,
} from "../types.js";
import { z } from "zod";
import { applyMessage, finalizeEvidence, newEvidence } from "./evidence.js";

/** think（只读）节点禁用的工具：任何会改文件 / 执行命令的都不给。 */
const READONLY_DISALLOWED = ["Edit", "Write", "MultiEdit", "NotebookEdit", "Bash"];

/**
 * 审批桥接：提供 approve 时用 default 模式 + canUseTool 把需批准的工具交外部裁决；
 * allowedTools 里的安全工具自动放行、不触发审批。send（think）与 act 共用。
 */
function makeCanUseTool(opts: AgentSendOptions) {
  if (!opts.approve) return undefined;
  return async (toolName: string, input: unknown, o?: { signal?: AbortSignal }) => {
    const decision = await opts.approve!({ tool: toolName, input, cwd: opts.cwd, signal: o?.signal });
    return decision.allow
      ? { behavior: "allow" as const, updatedInput: input as Record<string, unknown> }
      : { behavior: "deny" as const, message: decision.reason ?? "审批未通过" };
  };
}

/**
 * 构造 ask_human MCP 工具 —— act 默认全自动，不逐工具弹卡；agent 只在"纠结/做不下去"时
 * 主动调这个工具，处理器把问题交给 opts.askHuman（飞书卡片）作答，答复回填给 agent。
 * 返回 { mcpServers, toolName } 供 query options 装配；没给 askHuman 则返回 undefined。
 */
function makeAskHumanServer(sdk: any, opts: AgentActOptions, onMessage?: AgentSendOptions["onMessage"]) {
  if (!opts.askHuman) return undefined;
  const tool = sdk.tool(
    "ask_human",
    "当你遇到方案分叉、缺少关键信息、或反复尝试仍做不下去、必须人来拍板时，调用此工具向人发起问询并等待答复。" +
      "非必要不要调用——能自己判断就自己做。question 写清楚你的纠结点；options 可给人几个候选答案。",
    {
      question: z.string().describe("你的纠结点 / 要确认的问题"),
      options: z.array(z.string()).optional().describe("可选：给人选的候选答案"),
      context: z.string().optional().describe("可选：你已经尝试过什么"),
    },
    async (args: { question?: string; options?: string[]; context?: string }) => {
      const question = String(args?.question ?? "（未给出问题）");
      onMessage?.({ kind: "ask_human", question });
      const { answer } = await opts.askHuman!({
        question,
        options: Array.isArray(args?.options) ? args.options : undefined,
        context: typeof args?.context === "string" ? args.context : undefined,
        cwd: opts.cwd,
      });
      return { content: [{ type: "text", text: answer }] };
    },
  );
  const server = sdk.createSdkMcpServer({ name: "askhuman", version: "1.0.0", tools: [tool] });
  return { mcpServers: { askhuman: server }, toolName: "mcp__askhuman__ask_human" };
}

/**
 * 把一条 SDK 消息归一化成 AgentStreamEvent 推给 onMessage（流式呈现用）。
 * 文本走 partial 的 text_delta；tool_use / tool_result 走完整 assistant / user 消息。
 */
function emitStream(message: any, onMessage: NonNullable<AgentSendOptions["onMessage"]>): void {
  if (message?.type === "stream_event") {
    const ev = message.event;
    if (ev?.type === "content_block_delta") {
      if (ev.delta?.type === "text_delta" && typeof ev.delta.text === "string") {
        onMessage({ kind: "text", delta: ev.delta.text });
      } else if (ev.delta?.type === "thinking_delta" && typeof ev.delta.thinking === "string") {
        onMessage({ kind: "thinking", delta: ev.delta.thinking });
      }
    }
    return;
  }
  if (message?.type === "assistant") {
    for (const block of message.message?.content ?? []) {
      if (block?.type === "tool_use") onMessage({ kind: "tool_use", tool: block.name, input: block.input });
    }
    return;
  }
  if (message?.type === "user") {
    for (const block of message.message?.content ?? []) {
      if (block?.type === "tool_result") {
        const preview =
          typeof block.content === "string"
            ? block.content
            : Array.isArray(block.content)
              ? block.content.map((c: any) => (typeof c?.text === "string" ? c.text : "")).join("")
              : undefined;
        onMessage({ kind: "tool_result", ok: block.is_error ? false : true, preview: preview?.slice(0, 600) });
      }
    }
  }
}

/**
 * Claude Agent SDK Provider —— 封装 @anthropic-ai/claude-agent-sdk 的 query()。
 *
 * 与 CursorProvider 同样懒加载、未装时优雅降级。
 * 认证：opts.apiKey 非空 → 设 ANTHROPIC_API_KEY 走 API 计费；留空 → 用本机已登录的
 * Claude Code 订阅态。注意：临时改全局 env 不是并发安全的，pipeline 串行调用没问题。
 * 激活：npm i -w backend @anthropic-ai/claude-agent-sdk
 */

type LoadResult = { ok: true; sdk: any } | { ok: false; reason: string };

async function loadClaudeSdk(): Promise<LoadResult> {
  const specifier = "@anthropic-ai/claude-agent-sdk";
  try {
    const sdk: any = await import(specifier);
    return { ok: true, sdk };
  } catch {
    return {
      ok: false,
      reason: "@anthropic-ai/claude-agent-sdk 尚未安装。请运行：npm i -w backend @anthropic-ai/claude-agent-sdk",
    };
  }
}

/** Agent SDK 没有 models.list；列出 Claude Code 的模型别名（与路由池一致）。 */
const CLAUDE_MODELS: SdkModelInfo[] = [
  { id: "claude-opus-4-8", displayName: "Claude Opus 4.8" },
  { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5" },
];

export class ClaudeAgentProvider implements SdkProvider {
  info(): ProviderInfo {
    return { id: "claude-agent", displayName: "Claude Agent SDK", supported: true };
  }

  async validateCredential(apiKey: string): Promise<ValidateResult> {
    const loaded = await loadClaudeSdk();
    if (!loaded.ok) return { valid: false, detail: loaded.reason };
    // 真探测：发一个极小请求，在 system init（带 model）处即返回 → 确认认证可用（含本机登录态）。
    const prev = process.env.ANTHROPIC_API_KEY;
    if (apiKey) process.env.ANTHROPIC_API_KEY = apiKey;
    const cwd = mkdtempSync(join(tmpdir(), "lf-claude-validate-"));
    try {
      let model: string | undefined;
      for await (const message of loaded.sdk.query({ prompt: "ok", options: { cwd, permissionMode: "plan", maxTurns: 1 } })) {
        const m = message as { model?: string };
        if (typeof m.model === "string") {
          model = m.model;
          break; // 拿到 model 即认证成功，无需等生成
        }
      }
      return {
        valid: true,
        detail: apiKey
          ? `API key 可用${model ? `（模型 ${model}）` : ""}。`
          : `本机 Claude Code 登录态可用${model ? `（模型 ${model}）` : ""}。`,
      };
    } catch (err) {
      return { valid: false, detail: `认证失败：${err instanceof Error ? err.message : String(err)}` };
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      if (apiKey) {
        if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
        else process.env.ANTHROPIC_API_KEY = prev;
      }
    }
  }

  async listModels(_apiKey: string): Promise<SdkModelInfo[]> {
    return CLAUDE_MODELS;
  }

  async send(opts: AgentSendOptions): Promise<AgentSendResult> {
    const loaded = await loadClaudeSdk();
    if (!loaded.ok) throw new Error(loaded.reason);
    const started = Date.now();
    const prev = process.env.ANTHROPIC_API_KEY;
    if (opts.apiKey) process.env.ANTHROPIC_API_KEY = opts.apiKey;
    try {
      let result = "";
      let usage: AgentSendResult["usage"];
      let model = opts.model?.id;
      // think 路径：readOnly 时禁掉一切改文件/执行类工具，保证只读无副作用。
      const canUseTool = makeCanUseTool(opts);
      const permissionMode = canUseTool ? "default" : opts.readOnly ? "plan" : opts.mode === "plan" ? "plan" : "acceptEdits";
      // 官方原语：query({ prompt, options }) 返回异步消息流；system(init) 带真实 model，result 带终态。
      for await (const message of loaded.sdk.query({
        prompt: opts.prompt,
        options: {
          cwd: opts.cwd,
          model: opts.model?.id,
          permissionMode,
          ...(opts.allowedTools ? { allowedTools: opts.allowedTools } : {}),
          ...(opts.readOnly ? { disallowedTools: READONLY_DISALLOWED } : {}),
          ...(canUseTool ? { canUseTool } : {}),
        },
      })) {
        const m = message as {
          type?: string;
          subtype?: string;
          model?: string;
          result?: string;
          is_error?: boolean;
          errors?: string[];
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        if (m.type === "system" && typeof m.model === "string") model = m.model;
        if (m.type === "result") {
          // 错误结果（error_during_execution / error_max_turns 等）：抛真因，别静默变成空串。
          if (m.is_error || (m.subtype && m.subtype !== "success")) {
            throw new Error(m.errors?.join("；") || `Claude 运行错误（${m.subtype ?? "unknown"}）`);
          }
          if (typeof m.result === "string") result = m.result;
          if (m.usage) usage = { inputTokens: m.usage.input_tokens ?? 0, outputTokens: m.usage.output_tokens ?? 0 };
        }
      }
      return { result, model, usage, durationMs: Date.now() - started };
    } finally {
      if (opts.apiKey) {
        if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
        else process.env.ANTHROPIC_API_KEY = prev;
      }
    }
  }

  /**
   * act 原语：开真工具跑 agentic loop，观测消息流聚合 evidence + 流式推 onMessage。
   * 与 send 的区别：永远开真工具（不 readOnly）、返回 evidence。
   * 权限：**默认全自动**（permissionMode:"bypassPermissions"，不逐工具弹卡）——
   * 信任轴落在事后 verify 的地面真值，而非事前逐工具点头。给了 askHuman 则注入 ask_human 工具，
   * agent 只在"纠结/做不下去"时主动调它发飞书卡片求人（非必要不问）。
   */
  async act(opts: AgentActOptions): Promise<AgentActResult> {
    const loaded = await loadClaudeSdk();
    if (!loaded.ok) throw new Error(loaded.reason);
    const started = Date.now();
    const prev = process.env.ANTHROPIC_API_KEY;
    if (opts.apiKey) process.env.ANTHROPIC_API_KEY = opts.apiKey;
    const acc = newEvidence();
    try {
      let result = "";
      let usage: AgentSendResult["usage"];
      let model = opts.model?.id;
      const ask = makeAskHumanServer(loaded.sdk, opts, opts.onMessage);
      const allowed = [...(opts.allowedTools ?? []), ...(ask ? [ask.toolName] : [])];
      for await (const message of loaded.sdk.query({
        prompt: opts.prompt,
        options: {
          cwd: opts.cwd,
          model: opts.model?.id,
          permissionMode: "bypassPermissions", // 默认全自动；纠结才走 ask_human
          includePartialMessages: !!opts.onMessage, // 开了流式回调才订阅 partial（省开销）
          ...(allowed.length ? { allowedTools: allowed } : {}),
          ...(ask ? { mcpServers: ask.mcpServers } : {}),
        },
      })) {
        applyMessage(acc, message); // 边消费边聚合证据
        if (opts.onMessage) emitStream(message, opts.onMessage); // 边消费边推流式事件
        const m = message as {
          type?: string;
          subtype?: string;
          model?: string;
          result?: string;
          is_error?: boolean;
          errors?: string[];
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        if (m.type === "system" && typeof m.model === "string") model = m.model;
        if (m.type === "result") {
          if (m.is_error || (m.subtype && m.subtype !== "success")) {
            throw new Error(m.errors?.join("；") || `Claude 运行错误（${m.subtype ?? "unknown"}）`);
          }
          if (typeof m.result === "string") result = m.result;
          if (m.usage) usage = { inputTokens: m.usage.input_tokens ?? 0, outputTokens: m.usage.output_tokens ?? 0 };
        }
      }
      return { result, model, usage, evidence: finalizeEvidence(acc), durationMs: Date.now() - started };
    } finally {
      if (opts.apiKey) {
        if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
        else process.env.ANTHROPIC_API_KEY = prev;
      }
    }
  }
}
