/**
 * SDK 集成操作层 —— 与具体 Provider 无关的类型。
 * 目前仅落地 Cursor，但接口按"可扩展多 Provider"设计。
 */

/** 前端「SK 配置」下拉里展示的 Provider 元信息。 */
export interface ProviderInfo {
  id: string;
  displayName: string;
  /** 是否已支持。当前只有 cursor 为 true。 */
  supported: boolean;
  /** 给前端展示的补充说明（如"敬请期待"）。 */
  note?: string;
}

/** 凭据校验结果。 */
export interface ValidateResult {
  valid: boolean;
  /** 人类可读的结论，成功失败都填。 */
  detail: string;
  /** 校验通过时返回的账号身份信息（脱敏后可展示）。 */
  identity?: {
    apiKeyName?: string;
    userEmail?: string;
  };
}

/** 模型目录项（来自 Cursor.models.list 的精简投影）。 */
export interface SdkModelInfo {
  id: string;
  displayName: string;
  description?: string;
}

/** agent 一次运行的入参（编排层 Sender 适配器调用）。 */
export interface AgentSendOptions {
  /** 完整提示词（system + user 合并后的单条消息）。 */
  prompt: string;
  /** 工作目录，映射成 Agent 的 local.cwd。 */
  cwd: string;
  apiKey: string;
  model?: { id: string; params?: Array<{ id: string; value: string }> };
  mode?: "plan" | "agent";
}

/** agent 一次运行的结果。 */
export interface AgentSendResult {
  result: string;
  requestId?: string;
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number };
  model?: string;
  durationMs: number;
}
