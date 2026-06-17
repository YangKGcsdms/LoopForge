import type {
  AgentActOptions,
  AgentActResult,
  AgentSendOptions,
  AgentSendResult,
  ProviderInfo,
  SdkModelInfo,
  ValidateResult,
} from "./types.js";

/**
 * SdkProvider —— SDK 集成操作层的核心契约。
 *
 * 后端 API 壳只面向这个接口编程，不直接依赖 @cursor/sdk，
 * 因此未来接入别的 SDK 时，新增一个实现并注册到 registry 即可。
 *
 * ── 已落地的操作 ────────────────────────────────
 *   info()                当前 Provider 的展示元信息
 *   validateCredential()  校验一把 SK 是否可用
 *   listModels()          拉取可用模型目录
 *   send(opts)            Agent.create({local:{cwd}}) → send → wait（已落地，供编排层 Sender 用）
 *
 * ── 规划中的操作（后续按需补全，对应官方 SDK 原语）──
 *   stream(runId)         run.stream   —— 流式事件（补 usage / token-delta）
 *   resume(agentId)       Agent.resume —— 跨进程恢复会话
 *   cancel(runId)         run.cancel
 *   listAgents() / listRuns()
 * 这些先在接口层"占位"，待前端用得上时再逐个实现。
 */
export interface SdkProvider {
  /** 静态元信息，用于前端 Provider 列表。 */
  info(): ProviderInfo;

  /** 校验给定 SK 是否有效（不落盘，纯探测）。 */
  validateCredential(apiKey: string): Promise<ValidateResult>;

  /** 列出该 SK 可用的模型目录。 */
  listModels(apiKey: string): Promise<SdkModelInfo[]>;

  /**
   * think 原语：在指定工作目录下发一条提示词，单发、只读、等终态返回结构化字符串。
   * 编排层 think 节点（plan/decompose/各 reviewer）的 Sender 包的就是它。
   */
  send(opts: AgentSendOptions): Promise<AgentSendResult>;

  /**
   * act 原语（可选，仅有真工具循环的 provider 实现）：开真工具跑 agentic loop，
   * canUseTool 桥接审批，观测消息流聚合 evidence。编排层 act 节点（devStep/testWriter）用。
   * provider 未实现时，编排层把该 act 节点降级走 send（无证据），并应告警。
   */
  act?(opts: AgentActOptions): Promise<AgentActResult>;
}
