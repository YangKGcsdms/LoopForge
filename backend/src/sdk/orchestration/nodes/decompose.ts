/**
 * 拆解 loop 的两个节点：产出（把需求拆到 3~5 工时）+ 评审（是否已收敛）。
 */

import { defineContract, type ContractResult } from "../contract.js";
import type { EvaluatorNode, NodeTemplate } from "../node.js";
import { verdictContract } from "./contracts.js";

export interface DecomposeInput {
  requirement: string;
  goal: string;
  /** 来自出方案节点的整体方案摘要，拆解据此进行。 */
  planSummary?: string;
}

export interface Subtask {
  id: string;
  title: string;
  estimateHours: number;
  acceptance: string;
}

/** 拆解输出：子任务 + 你列的三类产物（不明确 / 断层 / 待补充）。 */
export interface DecomposeOutput {
  subtasks: Subtask[];
  ambiguities: string[];
  gaps: string[];
  toSupplement: string[];
}

const decomposeContract = defineContract<DecomposeOutput>({
  name: "decompose.output",
  schema: `{
  "subtasks": [{ "id": string, "title": string, "estimateHours": number, "acceptance": string }],
  "ambiguities": string[],   // 不明确的地方
  "gaps": string[],          // 断层的地方
  "toSupplement": string[]   // 待补充的内容
}`,
  validate(data): ContractResult<DecomposeOutput> {
    const d = data as Partial<DecomposeOutput>;
    const errors: string[] = [];
    if (!Array.isArray(d.subtasks)) errors.push("subtasks 必须是数组");
    for (const key of ["ambiguities", "gaps", "toSupplement"] as const) {
      if (!Array.isArray(d[key])) errors.push(`${key} 必须是数组`);
    }
    if (errors.length) return { ok: false, errors };
    return { ok: true, value: data as DecomposeOutput };
  },
});

/** 产出节点：把需求拆到 3~5 工时，并暴露不明确 / 断层 / 待补充。 */
export const decomposeNode: NodeTemplate<DecomposeInput, DecomposeOutput> = {
  id: "decompose",
  kind: "producer",
  purpose: "plan",
  role: "你是资深技术负责人，把需求拆成可执行的子任务。",
  output: decomposeContract,
  mode: "plan",
  render(input, ctx) {
    return {
      static:
        "拆解原则：每个子任务控制在 3~5 工时；说不清的进 ambiguities，缺口进 gaps，需要补的进 toSupplement。",
      dynamic: ctx.priorVerdict
        ? `上一轮评审指出需修复：\n${ctx.priorVerdict.requiredFixes.join("\n")}\n据此细化拆解。`
        : `${input.planSummary ? `整体方案：\n${input.planSummary}\n\n` : ""}需求：${input.requirement}\n最终目标：${input.goal}`,
    };
  },
};

/** 评审节点：判断拆解是否已收敛到可直接开发的粒度。 */
export const decomposeReviewer: EvaluatorNode<DecomposeOutput> = {
  id: "decompose-reviewer",
  kind: "evaluator",
  purpose: "review",
  role: "你是评审员，判断需求拆解是否已收敛到可直接开发的粒度。",
  output: verdictContract,
  render(input, _ctx) {
    return {
      static:
        "判据：每个子任务 ≤5 工时且有明确验收标准，ambiguities 必须清空才算收敛。completion.done = 是否收敛；deviation.score = 偏离「可直接开发的拆解」的程度；requiredFixes 指出哪些子任务要再拆、哪些不明确要追问补充。",
      dynamic: `待评审的拆解：\n${JSON.stringify(input, null, 2)}`,
    };
  },
};
