import type { SdkProvider } from "../provider.js";
import type {
  AgentSendOptions,
  AgentSendResult,
  ProviderInfo,
  SdkModelInfo,
  ValidateResult,
} from "../types.js";

/**
 * Cursor Provider —— 封装 @cursor/sdk。
 *
 * 【已冻结】项目收敛为"协助 CC 工作流的壳"，只走 Claude 路线。
 * 本 provider 代码休眠保留（`info().supported=false`，编排层/路由不再选它），
 * 别删别引用——理由见 docs/架构设计_CC壳与节点切分.md。
 * 冻结原因：Cursor headless 无可编程审批回调（canUseTool），接不上飞书审批，
 * 且与 Claude Agent SDK 能力面差异过大，统一 provider 会两头失血。
 *
 * 关键设计：@cursor/sdk 通过「动态 import」按需加载，未安装时优雅降级。
 * 激活真实 SDK：`npm i -w backend @cursor/sdk`
 */

type LoadResult =
  | { ok: true; sdk: any }
  | { ok: false; reason: string };

/** 动态加载 @cursor/sdk。用变量做 specifier，避免未安装时的静态解析报错。 */
async function loadCursorSdk(): Promise<LoadResult> {
  const specifier = "@cursor/sdk";
  try {
    const sdk: any = await import(specifier);
    return { ok: true, sdk };
  } catch {
    return {
      ok: false,
      reason: "@cursor/sdk 尚未安装。请运行：npm i -w backend @cursor/sdk",
    };
  }
}

export class CursorProvider implements SdkProvider {
  info(): ProviderInfo {
    return {
      id: "cursor",
      displayName: "Cursor SDK",
      supported: false,
      note: "已冻结：项目只走 Claude 路线",
    };
  }

  async validateCredential(apiKey: string): Promise<ValidateResult> {
    if (!apiKey) {
      return { valid: false, detail: "未提供 SK。" };
    }

    const loaded = await loadCursorSdk();
    if (!loaded.ok) {
      return { valid: false, detail: loaded.reason };
    }

    try {
      // 官方原语：Cursor.me() 用于读取当前 API Key 对应的身份信息。
      const user = await loaded.sdk.Cursor.me({ apiKey });
      return {
        valid: true,
        detail: "SK 校验通过。",
        identity: {
          apiKeyName: user?.apiKeyName,
          userEmail: user?.userEmail,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { valid: false, detail: `SK 校验失败：${message}` };
    }
  }

  async listModels(apiKey: string): Promise<SdkModelInfo[]> {
    const loaded = await loadCursorSdk();
    if (!loaded.ok) {
      throw new Error(loaded.reason);
    }
    // 官方原语：Cursor.models.list() 动态发现可用模型与参数。
    const models: any[] = await loaded.sdk.Cursor.models.list({ apiKey });
    return models.map((m) => ({
      id: m.id,
      displayName: m.displayName ?? m.id,
      description: m.description,
    }));
  }

  async send(opts: AgentSendOptions): Promise<AgentSendResult> {
    const loaded = await loadCursorSdk();
    if (!loaded.ok) {
      throw new Error(loaded.reason);
    }
    const started = Date.now();
    // 官方原语：Agent.create({ local: { cwd } }) → agent.send → run.wait。
    const agent = await loaded.sdk.Agent.create({
      apiKey: opts.apiKey,
      model: opts.model ?? { id: "composer-2.5" },
      mode: opts.mode,
      local: { cwd: opts.cwd },
    });
    try {
      const run = await agent.send(opts.prompt);
      const result = await run.wait();
      return {
        result: result.result ?? "",
        requestId: result.requestId,
        model: result.model?.id,
        durationMs: result.durationMs ?? (Date.now() - started),
        // usage 走 turn-ended 流事件，wait() 拿不到；后续接 stream 再补。
      };
    } finally {
      agent.close?.();
    }
  }
}
