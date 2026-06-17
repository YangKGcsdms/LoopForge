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

/**
 * 人工问询请求 —— act 默认全自动（bypassPermissions），不再逐工具弹卡；
 * 只有 agent 自己"纠结/做不下去"时主动调 ask_human 工具，才发飞书卡片求人裁决。
 */
export interface AskHumanRequest {
  /** agent 的提问（为什么纠结、想确认什么）。 */
  question: string;
  /** 可选：给人选的几个选项（卡片渲染成按钮），人点一个即作为答复。 */
  options?: string[];
  /** 可选：补充上下文（已尝试过什么）。 */
  context?: string;
  cwd?: string;
  signal?: AbortSignal;
}

/** 人工问询结果。answer 回填给 agent 作为 ask_human 工具的结果，让它据此继续。 */
export interface AskHumanResult {
  answer: string;
}

/** 问询器：把 agent 的一次"求助"交给外部（飞书卡片）作答。 */
export type AskHuman = (req: AskHumanRequest) => Promise<AskHumanResult>;

/**
 * 内部 SDK session 的流式事件 —— act 跑 agentic loop 时实时往外抛，
 * 让前端呈现"类 GUI Claude Code"的运行中输出。归一化自 SDK 的消息流。
 */
export type AgentStreamEvent =
  | { kind: "text"; delta: string }
  | { kind: "thinking"; delta: string }
  | { kind: "tool_use"; tool: string; input: unknown }
  | { kind: "tool_result"; ok: boolean | null; preview?: string }
  | { kind: "ask_human"; question: string };

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
  /** 工具审批回调；提供时用 permissionMode:"default" + canUseTool 桥接到它（think/旧路径用）。 */
  approve?: ToolApprover;
  /**
   * 人工问询回调；提供时 act 注入 ask_human 工具，agent 纠结时主动调它发飞书卡片求人。
   * 与 approve 互斥：act 默认全自动（bypassPermissions），靠 ask_human 而非逐工具审批。
   */
  askHuman?: AskHuman;
  /** 内部 SDK session 流式事件回调（text/tool_use/tool_result）；act 据此实时推前端。 */
  onMessage?: (event: AgentStreamEvent) => void;
  /** think 节点专用：禁掉一切改文件/执行类工具（Edit/Write/Bash…），保证只读无副作用。 */
  readOnly?: boolean;
}

/** agent 一次运行的结果。 */
export interface AgentSendResult {
  result: string;
  requestId?: string;
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number };
  model?: string;
  durationMs: number;
}

/** act 入参 = send 入参（act 永远开真工具，approve/allowedTools 决定哪些需审批）。 */
export type AgentActOptions = AgentSendOptions;

/** 一次工具调用的记录（从 tool_use / tool_result 消息流聚合）。 */
export interface ToolCallRecord {
  /** 工具名（Claude 大写名：Bash / Edit / Write …）。 */
  tool: string;
  input: unknown;
  /** 结果是否成功（tool_result.is_error 取反）；还没收到结果为 null。 */
  ok: boolean | null;
  /** 结果预览（截断），调试/留痕。 */
  resultPreview?: string;
}

/**
 * act 证据 —— agent 在本次运行里实际做了什么（地面真值的一半，另一半是 verify 的独立校验）。
 * 注意：bashRuns 的 ok 是 agent 工具回报，仍是"agent 自己说的"，最终信号以编排层 verify 为准。
 */
export interface AgentEvidence {
  toolCalls: ToolCallRecord[];
  /** 从 Edit/Write/MultiEdit/NotebookEdit 的 file_path 聚合的改动文件。 */
  filesTouched: string[];
  /** Bash 调用：命令 + 是否成功 + 输出预览。 */
  bashRuns: Array<{ command: string; ok: boolean | null; output?: string }>;
}

/** act 一次运行的结果 = send 结果 + 采集到的证据。 */
export interface AgentActResult extends AgentSendResult {
  evidence: AgentEvidence;
}
