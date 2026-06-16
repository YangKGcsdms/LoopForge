/**
 * 通用节点模板的契约 —— 这一文件就是整套设计的地基。
 *
 * 一个节点 = 配好角色 + 输入/输出契约 + 钩子的具名 invoke。
 * 三型节点（产出 / 评审 / 闸门）都用同一个 NodeTemplate<I, O>，
 * 评审和闸门只是把输出类型 O 固定成 Verdict / Decision。
 * 7 个 loop（拆解/开发/单测/测试/环境/DB/e2e）各自只是换契约的事。
 */

import type { Contract } from "./contract.js";

/** 节点三型：产出干活、评审打分、闸门放行。 */
export type NodeKind = "producer" | "evaluator" | "gate";

/**
 * 节点用途 —— 路由模型的主依据（按角色分配，控制成本）。
 * plan 出方案 / control 总体把控 → 强模型；execute 执行 / validate 校验 → 便宜；
 * review 评审回顾 → 中；test 测试 → 便宜。
 */
export type NodePurpose = "plan" | "control" | "execute" | "validate" | "review" | "test";

/** 规划 or 实施；产出节点常 plan→agent。 */
export type Mode = "plan" | "agent";

/** 模型引用，不依赖 @cursor/sdk；落地时映射成 SDK 的 ModelSelection。 */
export interface ModelRef {
  id: string;
  params?: Array<{ id: string; value: string }>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/**
 * 工作区 —— 项目指定的工作目录，节点在这个目录下读写代码。
 * 对应 Cursor SDK 的 local.cwd；落地时由 Sender 创建/复用对应 cwd 的 Agent。
 */
export interface Workspace {
  /** 工作目录绝对路径。开发/测试节点只在这个目录范围内改代码。 */
  cwd: string;
  /** 可选：git worktree 分支等隔离信息（后续多会话用）。 */
  branch?: string;
}

/** 运行时上下文：loop 把它喂进节点，render / 钩子靠它组装动态上下文。 */
export interface NodeRunContext {
  loopId?: string;
  iteration?: number;
  /** 项目指定的工作目录；开发/测试节点据此在某个目录下开发代码。 */
  workspace?: Workspace;
  /** 上一轮评审结论，开发 loop 的矫正靠它。 */
  priorVerdict?: EvaluatorVerdict;
  /** 事实总线 / 状态库的只读快照，动态上下文的来源。 */
  facts?: Readonly<Record<string, unknown>>;
}

/**
 * render 的产物：静态 / 动态两遍组装，对抗 context rot。
 * static 可缓存（角色、契约、长期事实），dynamic 每轮都变（loop 状态、上一轮评审）。
 */
export interface PromptParts {
  static: string;
  dynamic: string;
}

/**
 * 节点模板 —— 通用节点的契约本体。
 * I = 输入类型，O = 输出类型。评审/闸门会把 O 固定成下面的 Verdict / Decision。
 */
export interface NodeTemplate<I, O> {
  readonly id: string;
  readonly kind: NodeKind;
  /** 节点用途，路由模型按它分配（控制成本）。省略则按 kind 取保守默认。 */
  readonly purpose?: NodePurpose;
  /** 系统角色设定。 */
  readonly role: string;
  /** 输出契约：节点必须吐的固定结构（核心）。 */
  readonly output: Contract<O>;
  /** 可选输入契约：声明并校验入参，兼做文档与防御。 */
  readonly input?: Contract<I>;
  /** 把输入 + 上下文渲染成提示词（静/动两遍）。 */
  render(input: I, ctx: NodeRunContext): PromptParts;
  /** 该节点用的模型；省略则用 loop 默认。难活用强模型，铺量用便宜的。 */
  readonly model?: ModelRef;
  readonly mode?: Mode;
  /** 允许的工具 / customTool 名；副作用节点（DB 写入、触发 e2e）挂在这。 */
  readonly tools?: string[];
  /** 契约校验失败时的修复重试上限，默认 2。 */
  readonly maxRepairs?: number;
  /** 输入/输出钩子链；默认链含落库的 persistHook。 */
  readonly hooks?: NodeHook[];
}

/** 评审节点：输出固定为双维度判定。 */
export type EvaluatorNode<I> = NodeTemplate<I, EvaluatorVerdict>;
/** 闸门节点：输出固定为放行决定。 */
export type GateNode<I> = NodeTemplate<I, GateDecision>;

/** 双维度评审判定 —— 评审节点的输出契约。 */
export interface EvaluatorVerdict {
  /** 维度一·完成情况：真做完没、测试真过没。治「谎报完成」。 */
  completion: { done: boolean; evidence: string };
  /** 维度二·目标偏差：0(贴合)~1(跑偏)。治「越做越偏」。 */
  deviation: { score: number; reason: string };
  /** 综合是否通过。 */
  pass: boolean;
  /** 不通过时的必须修复项，喂给下一轮矫正。 */
  requiredFixes: string[];
}

/** 闸门决定 —— 闸门节点的输出契约。 */
export interface GateDecision {
  action: "allow" | "block" | "reassign";
  reason: string;
  /** 命中硬红线（删库/危险 shell/未授权写）时填；命中即 block，不看 agent 判断。 */
  hardRuleHit?: string;
}

/** 一次节点执行的结果。 */
export interface NodeResult<O> {
  nodeId: string;
  kind: NodeKind;
  status: "ok" | "repair_exhausted" | "error";
  output?: O;
  /** 模型原始字符串，调试/留痕。 */
  raw?: string;
  /** 实际修复重试次数。 */
  repairs: number;
  model?: ModelRef;
  usage?: TokenUsage;
  requestId?: string;
  durationMs: number;
  /** 小模型生成的一句话输出总结，落库用。 */
  summary?: string;
  /** status==="error" 时的原因。 */
  error?: string;
}

/** 输入钩子事件。 */
export interface NodeInputEvent<I> {
  nodeId: string;
  kind: NodeKind;
  ctx: NodeRunContext;
  input: I;
  prompt: PromptParts;
}

/** 输出钩子事件。 */
export interface NodeOutputEvent<I, O> {
  nodeId: string;
  kind: NodeKind;
  ctx: NodeRunContext;
  input: I;
  result: NodeResult<O>;
}

/** 节点钩子：可叠加的链，默认链含落库的 persistHook。 */
export interface NodeHook {
  readonly name: string;
  onInput?(evt: NodeInputEvent<unknown>): void | Promise<void>;
  onOutput?(evt: NodeOutputEvent<unknown, unknown>): void | Promise<void>;
}

/** 落库记录 —— 只记摘要 + 总结，不记每行 diff，让库里是人能扫的时间线。 */
export interface NodeRunRecord {
  id: string;
  nodeId: string;
  kind: NodeKind;
  loopId?: string;
  iteration?: number;
  /** 入参摘要（截断），不存全量。 */
  inputDigest: string;
  /** 小模型一句话输出总结。 */
  outputSummary: string;
  /** 评审节点：两维判定。 */
  verdict?: EvaluatorVerdict;
  /** 闸门节点：放行决定。 */
  decision?: GateDecision;
  status: NodeResult<unknown>["status"];
  model?: string;
  usage?: TokenUsage;
  requestId?: string;
  durationMs: number;
  createdAt: string;
}

/** 落库后端契约。起步用 SQLite/JSONL，可换 Postgres，不动调用方。 */
export interface NodeRunStore {
  append(record: NodeRunRecord): Promise<void>;
  list(filter?: { loopId?: string; nodeId?: string; limit?: number }): Promise<NodeRunRecord[]>;
}
