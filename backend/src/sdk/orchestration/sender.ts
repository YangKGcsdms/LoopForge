/**
 * Sender 适配器 —— 编排层与 SDK provider 的接缝（think / act 两条）。
 *
 * think-sender（providerSender）：把 SendRequest 收口成 provider.send，**只读**（readOnly），
 *   think 节点（plan/decompose/各 reviewer）用，永不弹审批、不改文件。
 * act-runner（providerActSender）：把 ActRequest 收口成 provider.act，开真工具 + 绑定 approve（飞书审批）+
 *   返回 evidence。act 节点（devStep/testWriter）用。provider 没实现 act 时降级走 send（无证据，告警）。
 */

import type { ActResult, ActSender, Sender } from "./run.js";
import type { SdkProvider } from "../provider.js";
import type { ToolApprover } from "../types.js";
import { getProvider } from "../registry.js";

/** Sender 装配选项：工作目录 + 工具放行/审批（透传到 provider）。 */
export interface SenderOpts {
  defaultCwd?: string;
  /** 免审批放行的安全工具；其余需批准的工具走 approve（仅 act 路径用）。 */
  allowedTools?: string[];
  /** 工具审批回调（如飞书审批，仅 act 路径用）。 */
  approve?: ToolApprover;
}

/** think-sender：provider.send（只读单发）。think 节点不改文件、不审批。 */
export function providerSender(
  provider: Pick<SdkProvider, "send">,
  apiKey: string,
  opts: SenderOpts = {},
): Sender {
  return async (req) => {
    const prompt = req.system ? `${req.system}\n\n${req.user}` : req.user;
    const r = await provider.send({
      prompt,
      cwd: req.cwd ?? opts.defaultCwd ?? process.cwd(),
      apiKey,
      model: req.model,
      mode: req.mode,
      allowedTools: opts.allowedTools,
      readOnly: true, // think = 只读，禁改文件/执行
    });
    return {
      result: r.result,
      requestId: r.requestId,
      usage: r.usage,
      model: r.model ? { id: r.model } : req.model,
      durationMs: r.durationMs,
    };
  };
}

/** act-runner：provider.act（真工具+审批+证据）。provider 没实现 act → 降级 send，无证据。 */
export function providerActSender(
  provider: Pick<SdkProvider, "send" | "act">,
  apiKey: string,
  opts: SenderOpts = {},
): ActSender {
  return async (req) => {
    const prompt = req.system ? `${req.system}\n\n${req.user}` : req.user;
    const cwd = req.cwd ?? opts.defaultCwd ?? process.cwd();
    if (!provider.act) {
      const r = await provider.send({
        prompt,
        cwd,
        apiKey,
        model: req.model,
        mode: "agent",
        allowedTools: opts.allowedTools,
        approve: opts.approve,
      });
      return {
        result: r.result,
        requestId: r.requestId,
        usage: r.usage,
        model: r.model ? { id: r.model } : req.model,
        durationMs: r.durationMs,
        evidence: { toolCalls: [], filesTouched: [], bashRuns: [] },
      } satisfies ActResult;
    }
    const r = await provider.act({
      prompt,
      cwd,
      apiKey,
      model: req.model,
      mode: "agent",
      allowedTools: opts.allowedTools,
      approve: opts.approve,
    });
    return {
      result: r.result,
      requestId: r.requestId,
      usage: r.usage,
      model: r.model ? { id: r.model } : req.model,
      durationMs: r.durationMs,
      evidence: r.evidence,
    } satisfies ActResult;
  };
}

/** 用注册表里任意 provider 造 think-sender（默认 claude-agent）。 */
export function senderFor(providerId: string, apiKey: string, opts?: SenderOpts): Sender {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`provider 未注册: ${providerId}`);
  return providerSender(provider, apiKey, opts);
}

/** 用注册表里任意 provider 造 act-runner（默认 claude-agent）。 */
export function actSenderFor(providerId: string, apiKey: string, opts?: SenderOpts): ActSender {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`provider 未注册: ${providerId}`);
  return providerActSender(provider, apiKey, opts);
}
