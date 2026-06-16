/**
 * 前置模型评估器 + 路由 —— 评估任务难度，按 (难度, 节点类型) 路由模型。
 * 难度评估是模糊活（用便宜的小模型节点）；难度→模型是确定性映射（普通代码）。
 */

import { defineContract, type ContractResult } from "../contract.js";
import type { ModelRef, NodeKind, NodePurpose, NodeTemplate } from "../node.js";

export type Difficulty = "easy" | "medium" | "hard";
export type ModelTier = "cheap" | "mid" | "strong";

export interface CatalogModel {
  id: string;
  displayName: string;
  tier: ModelTier;
}

/**
 * 路由池（allowlist）—— 只在这些模型里按难度路由。
 * admin 禁用的模型（如 claude-fable-5）不在池内，永远不会被选到。
 * 真跑时再与实时可用列表取交集（availablePool）双保险；某档全不可用时 routeModel 回退 { id: "auto" }。
 */
export const MODEL_POOL: CatalogModel[] = [
  { id: "composer-2.5", displayName: "Composer 2.5", tier: "cheap" },
  { id: "kimi-k2.5", displayName: "Kimi K2.5", tier: "cheap" },
  { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", tier: "cheap" },
  { id: "gpt-5.5", displayName: "GPT-5.5", tier: "mid" },
  { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", tier: "mid" },
  { id: "claude-opus-4-8", displayName: "Claude Opus 4.8", tier: "strong" },
];

/** 路由池按实时可用性过滤；live 不可知（未配 SK / 取不到）时返回整池。 */
export function availablePool(liveIds: Set<string> | null, pool: CatalogModel[] = MODEL_POOL): CatalogModel[] {
  return liveIds ? pool.filter((m) => liveIds.has(m.id)) : pool;
}

/**
 * Claude Agent SDK 的路由池 —— 用 Claude Code 的模型别名（opus/sonnet/haiku），
 * 这是 `--model` 接受的写法，且"取最新版"、不随日期版本变；不是 Cursor 目录里的 claude-opus-4-8。
 */
export const CLAUDE_POOL: CatalogModel[] = [
  { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", tier: "cheap" },
  { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", tier: "mid" },
  { id: "claude-opus-4-8", displayName: "Claude Opus 4.8", tier: "strong" },
];

/** 按 provider 选路由池。purposeModel 的退档逻辑会自动把 Cursor 专属 id 退到同档 Claude 模型。 */
export function poolFor(providerId: string): CatalogModel[] {
  return providerId === "claude-agent" ? CLAUDE_POOL : MODEL_POOL;
}

/** 按 id 关键词粗分档位。 */
export function tierOf(id: string): ModelTier {
  const s = id.toLowerCase();
  if (s.includes("opus") || (s.includes("claude") && !s.includes("haiku"))) return "strong";
  if (s.includes("gpt") || s.includes("gemini") || s.includes("sonnet")) return "mid";
  return "cheap";
}

/** 把 provider 拿到的实时模型列表归一成带档位的目录。 */
export function catalogFromModels(models: Array<{ id: string; displayName?: string }>): CatalogModel[] {
  return models.map((m) => ({ id: m.id, displayName: m.displayName ?? m.id, tier: tierOf(m.id) }));
}

/** 难度 + 节点类型 → 模型（确定性）。评审一律用强模型，产出按难度切。 */
export function routeModel(difficulty: Difficulty, kind: NodeKind, models: CatalogModel[]): ModelRef {
  const byTier = (tier: ModelTier): ModelRef => {
    const m = models.find((x) => x.tier === tier) ?? models.find((x) => x.tier === "cheap");
    return m ? { id: m.id } : { id: "auto" };
  };
  if (kind === "evaluator") return byTier("strong"); // 评审质量决定流水线可靠性
  if (difficulty === "hard") return byTier("strong");
  if (difficulty === "medium") return byTier("mid");
  return byTier("cheap");
}

/** 造一个按难度路由的 resolveModel（保留备用；pipeline 现在默认走 purposeResolver）。 */
export function modelResolver(difficulty: Difficulty, models: CatalogModel[]) {
  return (info: { id: string; kind: NodeKind }): ModelRef => routeModel(difficulty, info.kind, models);
}

/**
 * 两套独立的路由策略 —— 各 provider 一张「用途 → 模型」表，用各自 SDK 的真实模型名，互不收敛。
 * 选 cursor 走 CURSOR_ROUTING，选 claude-agent 走 CLAUDE_ROUTING，是两套策略。
 */
export const CURSOR_ROUTING: Record<NodePurpose, string> = {
  plan: "claude-opus-4-8",
  control: "claude-opus-4-8",
  execute: "composer-2.5",
  validate: "composer-2.5",
  review: "claude-sonnet-4-6",
  test: "kimi-k2.5",
};

export const CLAUDE_ROUTING: Record<NodePurpose, string> = {
  plan: "claude-opus-4-8",
  control: "claude-opus-4-8",
  execute: "claude-haiku-4-5",
  validate: "claude-haiku-4-5",
  review: "claude-sonnet-4-6",
  test: "claude-haiku-4-5",
};

/** 按 provider 选路由策略。 */
export function routingFor(providerId: string): Record<NodePurpose, string> {
  return providerId === "claude-agent" ? CLAUDE_ROUTING : CURSOR_ROUTING;
}

/** 无 purpose 的节点：评审类按 review，其余按 execute。 */
function defaultPurpose(kind: NodeKind): NodePurpose {
  return kind === "evaluator" ? "review" : "execute";
}

/** 按 provider 的路由策略产出 resolveModel。 */
export function resolverFor(providerId: string) {
  const map = routingFor(providerId);
  return (info: { id: string; kind: NodeKind; purpose?: NodePurpose }): ModelRef => ({
    id: map[info.purpose ?? defaultPurpose(info.kind)],
  });
}

/** 该 provider 的完整路由方案（purpose → 模型 id），供前端展示。 */
export function routingScheme(providerId: string): Record<NodePurpose, string> {
  return routingFor(providerId);
}

export interface DifficultyInput {
  task: string;
  goal?: string;
}

export interface DifficultyOutput {
  difficulty: Difficulty;
  reason: string;
}

const difficultyContract = defineContract<DifficultyOutput>({
  name: "difficulty.output",
  schema: `{ "difficulty": "easy" | "medium" | "hard", "reason": string }`,
  validate(data): ContractResult<DifficultyOutput> {
    const d = data as Partial<DifficultyOutput>;
    if (d.difficulty !== "easy" && d.difficulty !== "medium" && d.difficulty !== "hard") {
      return { ok: false, errors: ["difficulty 必须是 easy / medium / hard"] };
    }
    if (typeof d.reason !== "string") return { ok: false, errors: ["reason 必须是 string"] };
    return { ok: true, value: data as DifficultyOutput };
  },
});

/** 前置难度评估器：用便宜模型，自己别花太多 token。 */
export const difficultyAssessor: NodeTemplate<DifficultyInput, DifficultyOutput> = {
  id: "difficulty-assessor",
  kind: "producer",
  purpose: "validate",
  role: "你是技术评估员，做开发任务的难度评估。",
  output: difficultyContract,
  render(input, _ctx) {
    return {
      static:
        "按 easy / medium / hard 评估：easy=单点改动；medium=涉及多模块或审批流；hard=涉及复杂状态机、并发或数据迁移。",
      dynamic: `任务：${input.task}${input.goal ? `\n目标：${input.goal}` : ""}`,
    };
  },
};
