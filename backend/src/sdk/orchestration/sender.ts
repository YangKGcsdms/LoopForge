/**
 * Sender 适配器 —— 编排层与 Cursor SDK 的接缝。
 * 把 SdkProvider.send 包成 runNode/runLoop 用的 Sender：
 * SendRequest 的 system+user 合并成一条提示词，cwd 透传到 provider（→ Agent 的 local.cwd）。
 */

import type { Sender } from "./run.js";
import type { SdkProvider } from "../provider.js";
import type { ToolApprover } from "../types.js";
import { getProvider } from "../registry.js";

/** Sender 装配选项：工作目录 + 工具放行/审批（透传到 provider.send）。 */
export interface SenderOpts {
  defaultCwd?: string;
  /** 免审批放行的安全工具；其余需批准的工具走 approve。 */
  allowedTools?: string[];
  /** 工具审批回调（如飞书审批）。 */
  approve?: ToolApprover;
}

/** 把任意实现了 send 的 Provider 适配成 Sender（便于注入 mock 做验证）。 */
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
      approve: opts.approve,
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

/** 便捷：用注册表里的 cursor provider 造 Sender。 */
export function cursorSender(apiKey: string, opts?: SenderOpts): Sender {
  return senderFor("cursor", apiKey, opts);
}

/** 用注册表里任意 provider 造 Sender（cursor / claude-agent / …）。 */
export function senderFor(providerId: string, apiKey: string, opts?: SenderOpts): Sender {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`provider 未注册: ${providerId}`);
  return providerSender(provider, apiKey, opts);
}
