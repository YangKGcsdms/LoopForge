/**
 * 出方案节点 —— 强化 flow 开端：拆解之前先给整体实现方案（spec），拆解再依据它做。
 * purpose=plan → 路由到强模型（opus）。这是"总体把控"的高价值一步。
 */

import { defineContract, type ContractResult } from "../contract.js";
import type { NodeTemplate } from "../node.js";
import type { Difficulty } from "./router.js";

export interface PlanInput {
  requirement: string;
  goal: string;
  difficulty: Difficulty;
}

export interface PlanOutput {
  approach: string; // 总体实现思路
  keyDecisions: string[]; // 关键技术决策
  risks: string[]; // 风险与依赖
  phases: string[]; // 推进阶段顺序
  acceptance: string[]; // 整体验收要点
  openQuestions: string[]; // 待澄清问题
}

const planContract = defineContract<PlanOutput>({
  name: "plan.output",
  schema: `{
  "approach": string,
  "keyDecisions": string[],
  "risks": string[],
  "phases": string[],
  "acceptance": string[],
  "openQuestions": string[]
}`,
  validate(data): ContractResult<PlanOutput> {
    const d = data as Partial<PlanOutput>;
    const errors: string[] = [];
    if (typeof d.approach !== "string") errors.push("approach 必须是 string");
    for (const k of ["keyDecisions", "risks", "phases", "acceptance", "openQuestions"] as const) {
      if (!Array.isArray(d[k])) errors.push(`${k} 必须是数组`);
    }
    if (errors.length) return { ok: false, errors };
    return { ok: true, value: data as PlanOutput };
  },
});

/** 在拆解前产出整体实现方案，指导后续拆解。 */
export const planNode: NodeTemplate<PlanInput, PlanOutput> = {
  id: "plan",
  kind: "producer",
  purpose: "plan",
  role: "你是资深架构师/技术负责人，在动手拆解前先给出整体实现方案。",
  output: planContract,
  mode: "plan",
  render(input, _ctx) {
    return {
      static:
        "先通读相关代码与文档，产出能指导后续拆解的整体方案：approach 总体思路、keyDecisions 关键技术决策、risks 风险与依赖、phases 推进阶段顺序、acceptance 整体验收要点、openQuestions 待澄清问题。",
      dynamic: `需求：${input.requirement}\n最终目标：${input.goal}\n难度评估：${input.difficulty}`,
    };
  },
};
