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

/** 工具审批请求 —— Claude 想用某个需批准的工具（如 Bash）时发起。 */
export interface ToolApprovalRequest {
  /** 工具名（Claude 侧大写名：Bash / Write / Edit …）。 */
  tool: string;
  /** Claude 传给该工具的参数（如 Bash 的 { command }）。 */
  input: unknown;
  /** 当前工作目录，便于审批时判断影响范围。 */
  cwd?: string;
  /** 取消信号：run 被取消时一并中止等待中的审批。 */
  signal?: AbortSignal;
}

/** 工具审批结果。deny 时 reason 会回给 Claude，让它调整做法。 */
export interface ToolApprovalResult {
  allow: boolean;
  reason?: string;
}

/** 审批器：把一次工具使用请求交给外部（飞书卡片 / 终端 / 自动策略）裁决。 */
export type ToolApprover = (req: ToolApprovalRequest) => Promise<ToolApprovalResult>;

/** agent 一次运行的入参（编排层 Sender 适配器调用）。 */
export interface AgentSendOptions {
  /** 完整提示词（system + user 合并后的单条消息）。 */
  prompt: string;
  /** 工作目录，映射成 Agent 的 local.cwd。 */
  cwd: string;
  apiKey: string;
  model?: { id: string; params?: Array<{ id: string; value: string }> };
  mode?: "plan" | "agent";
  /** 免审批放行的工具（安全只读/编辑类）；其余需批准的工具走 approve 回调。 */
  allowedTools?: string[];
  /** 工具审批回调；提供时用 permissionMode:"default" + canUseTool 桥接到它。 */
  approve?: ToolApprover;
}

/** agent 一次运行的结果。 */
export interface AgentSendResult {
  result: string;
  requestId?: string;
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number };
  model?: string;
  durationMs: number;
}
