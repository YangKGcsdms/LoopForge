import type { SdkProvider } from "./provider.js";
import type { ProviderInfo } from "./types.js";
import { CursorProvider } from "./cursor/cursorProvider.js";
import { ClaudeAgentProvider } from "./claude/claudeProvider.js";

/**
 * Provider 注册表 —— 集成操作层的入口。
 * 当前仅注册 Cursor；未来新增 Provider 在此登记即可。
 */
const providers = new Map<string, SdkProvider>();

function register(provider: SdkProvider): void {
  providers.set(provider.info().id, provider);
}

register(new CursorProvider());
register(new ClaudeAgentProvider());

/** 取某个 Provider 实现；不存在返回 undefined。 */
export function getProvider(id: string): SdkProvider | undefined {
  return providers.get(id);
}

/**
 * 列出所有 Provider 的展示元信息。
 * 这里附带追加"敬请期待"的占位项，让前端能明确传达"目前仅支持 Cursor SDK"。
 */
export function listProviderInfos(): ProviderInfo[] {
  const supported: ProviderInfo[] = [...providers.values()].map((p) => p.info());
  const comingSoon: ProviderInfo[] = [
    { id: "openai", displayName: "OpenAI", supported: false, note: "敬请期待" },
  ];
  return [...supported, ...comingSoon];
}
