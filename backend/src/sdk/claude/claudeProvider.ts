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
   * act 原语：开真工具跑 agentic loop，canUseTool 桥接审批，观测消息流聚合 evidence。
   * 与 send 的区别：永远开真工具（不 readOnly）、返回 evidence。permissionMode：有 approve 走
   * default（未放行工具弹审批），否则 acceptEdits（信任本地工作目录、自动放行编辑）。
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
      const canUseTool = makeCanUseTool(opts);
      const permissionMode = canUseTool ? "default" : "acceptEdits";
      for await (const message of loaded.sdk.query({
        prompt: opts.prompt,
        options: {
          cwd: opts.cwd,
          model: opts.model?.id,
          permissionMode,
          ...(opts.allowedTools ? { allowedTools: opts.allowedTools } : {}),
          ...(canUseTool ? { canUseTool } : {}),
        },
      })) {
        applyMessage(acc, message); // 边消费边聚合证据
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
