/**
 * Sender 适配器 —— 编排层与 Cursor SDK 的接缝。
 * 把 SdkProvider.send 包成 runNode/runLoop 用的 Sender：
 * SendRequest 的 system+user 合并成一条提示词，cwd 透传到 provider（→ Agent 的 local.cwd）。
 */

import type { Sender } from "./run.js";
import type { SdkProvider } from "../provider.js";
import { getProvider } from "../registry.js";

/** 把任意实现了 send 的 Provider 适配成 Sender（便于注入 mock 做验证）。 */
export function providerSender(
  provider: Pick<SdkProvider, "send">,
  apiKey: string,
  opts: { defaultCwd?: string } = {},
): Sender {
  return async (req) => {
    const prompt = req.system ? `${req.system}\n\n${req.user}` : req.user;
    const r = await provider.send({
      prompt,
      cwd: req.cwd ?? opts.defaultCwd ?? process.cwd(),
      apiKey,
      model: req.model,
      mode: req.mode,
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
export function cursorSender(apiKey: string, opts?: { defaultCwd?: string }): Sender {
  return senderFor("cursor", apiKey, opts);
}

/** 用注册表里任意 provider 造 Sender（cursor / claude-agent / …）。 */
export function senderFor(providerId: string, apiKey: string, opts?: { defaultCwd?: string }): Sender {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`provider 未注册: ${providerId}`);
  return providerSender(provider, apiKey, opts);
}
