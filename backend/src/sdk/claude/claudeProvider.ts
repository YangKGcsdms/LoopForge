import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SdkProvider } from "../provider.js";
import type {
  AgentSendOptions,
  AgentSendResult,
  ProviderInfo,
  SdkModelInfo,
  ValidateResult,
} from "../types.js";

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
      // 官方原语：query({ prompt, options }) 返回异步消息流，最终 result 在 type==="result" 的消息里。
      for await (const message of loaded.sdk.query({
        prompt: opts.prompt,
        options: {
          cwd: opts.cwd,
          model: opts.model?.id,
          permissionMode: opts.mode === "plan" ? "plan" : "acceptEdits",
        },
      })) {
        const m = message as { type?: string; result?: string; usage?: { input_tokens?: number; output_tokens?: number } };
        if (m.type === "result") {
          if (typeof m.result === "string") result = m.result;
          if (m.usage) usage = { inputTokens: m.usage.input_tokens ?? 0, outputTokens: m.usage.output_tokens ?? 0 };
        }
      }
      return { result, model: opts.model?.id, usage, durationMs: Date.now() - started };
    } finally {
      if (opts.apiKey) {
        if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
        else process.env.ANTHROPIC_API_KEY = prev;
      }
    }
  }
}
