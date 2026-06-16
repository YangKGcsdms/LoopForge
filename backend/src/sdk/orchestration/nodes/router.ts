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
  { id: "haiku", displayName: "Claude Haiku 4.5", tier: "cheap" },
  { id: "sonnet", displayName: "Claude Sonnet 4.6", tier: "mid" },
  { id: "opus", displayName: "Claude Opus 4.8", tier: "strong" },
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
 * 按用途路由的偏好：每个 purpose 的首选模型 + 退档。
 * 出方案/把控用强模型(opus)，执行/校验最便宜(composer)，评审用中(sonnet)，测试用 kimi。
 */
const PURPOSE_PREF: Record<NodePurpose, { model: string; tier: ModelTier }> = {
  plan: { model: "claude-opus-4-8", tier: "strong" },
  control: { model: "claude-opus-4-8", tier: "strong" },
  execute: { model: "composer-2.5", tier: "cheap" },
  validate: { model: "composer-2.5", tier: "cheap" },
  review: { model: "claude-sonnet-4-6", tier: "mid" },
  test: { model: "kimi-k2.5", tier: "cheap" },
};

/** 用途 → 模型：首选模型在池内则用它，否则退到同档，再退 cheap，最后 auto。 */
export function purposeModel(purpose: NodePurpose, pool: CatalogModel[]): ModelRef {
  const pref = PURPOSE_PREF[purpose];
  if (pool.some((m) => m.id === pref.model)) return { id: pref.model };
  const sameTier = pool.find((m) => m.tier === pref.tier);
  if (sameTier) return { id: sameTier.id };
  const cheap = pool.find((m) => m.tier === "cheap");
  return cheap ? { id: cheap.id } : { id: "auto" };
}

/** 按节点用途路由的 resolveModel。无 purpose 的节点：评审类按 review，其余按 execute。 */
export function purposeResolver(pool: CatalogModel[]) {
  return (info: { id: string; kind: NodeKind; purpose?: NodePurpose }): ModelRef =>
    purposeModel(info.purpose ?? (info.kind === "evaluator" ? "review" : "execute"), pool);
}

/** 当前池下的完整路由方案（purpose → 实际模型 id），供前端展示。 */
export function routingScheme(pool: CatalogModel[]): Record<NodePurpose, string> {
  const purposes: NodePurpose[] = ["plan", "control", "execute", "validate", "review", "test"];
  return Object.fromEntries(purposes.map((p) => [p, purposeModel(p, pool).id])) as Record<NodePurpose, string>;
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
  model: { id: "composer-2.5" },
  render(input, _ctx) {
    return {
      static:
        "按 easy / medium / hard 评估：easy=单点改动；medium=涉及多模块或审批流；hard=涉及复杂状态机、并发或数据迁移。",
      dynamic: `任务：${input.task}${input.goal ? `\n目标：${input.goal}` : ""}`,
    };
  },
};
