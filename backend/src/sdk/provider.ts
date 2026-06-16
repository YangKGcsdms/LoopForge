import type {
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
   * 跑一次 agent：在指定工作目录下发一条提示词，等待终态，返回结构化结果。
   * 编排层的 Sender 适配器包的就是它（Agent.create({local:{cwd}}) → send → wait）。
   */
  send(opts: AgentSendOptions): Promise<AgentSendResult>;
}
