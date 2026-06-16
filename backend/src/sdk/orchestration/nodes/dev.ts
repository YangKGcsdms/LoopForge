/**
 * 开发 loop 的两个节点：开发步进（在指定工作目录下实现子任务）+ 双维度评审。
 * 工作目录来自 ctx.workspace.cwd —— 项目指定要在哪个目录下开发代码。
 */

import { defineContract, type ContractResult } from "../contract.js";
import type { EvaluatorNode, NodeTemplate } from "../node.js";
import type { Subtask } from "./decompose.js";
import { verdictContract } from "./contracts.js";

export interface DevStepInput {
  task: Subtask;
}

export interface DevStepOutput {
  taskId: string;
  filesTouched: string[];
  summary: string;
  testsRun: { passed: number; failed: number } | null;
  selfCheck: string;
}

const devStepContract = defineContract<DevStepOutput>({
  name: "dev-step.output",
  schema: `{
  "taskId": string,
  "filesTouched": string[],
  "summary": string,
  "testsRun": { "passed": number, "failed": number } | null,
  "selfCheck": string
}`,
  validate(data): ContractResult<DevStepOutput> {
    const d = data as Partial<DevStepOutput>;
    const errors: string[] = [];
    if (typeof d.taskId !== "string") errors.push("taskId 必须是 string");
    if (!Array.isArray(d.filesTouched)) errors.push("filesTouched 必须是数组");
    if (typeof d.summary !== "string") errors.push("summary 必须是 string");
    if (typeof d.selfCheck !== "string") errors.push("selfCheck 必须是 string");
    if (errors.length) return { ok: false, errors };
    return { ok: true, value: data as DevStepOutput };
  },
});

/** 开发步进：在 ctx.workspace.cwd 下实现一个子任务，自检后如实回报。 */
export const devStepNode: NodeTemplate<DevStepInput, DevStepOutput> = {
  id: "dev-step",
  kind: "producer",
  purpose: "execute",
  role: "你是开发工程师，实现给定子任务并自检。",
  output: devStepContract,
  mode: "agent",
  tools: ["read", "edit", "write", "shell"],
  render(input, ctx) {
    const cwd = ctx.workspace?.cwd ?? process.cwd();
    return {
      static: `你在工作目录 ${cwd} 下实现这个子任务，只改该目录范围内的代码。完成后跑相关测试，如实回报 filesTouched 与 testsRun，不准谎报完成。`,
      dynamic: ctx.priorVerdict
        ? `子任务[${input.task.id}]：${input.task.title}\n上一轮评审要求修复：\n${ctx.priorVerdict.requiredFixes.join("\n")}\n据此修正后再回报。`
        : `子任务[${input.task.id}]：${input.task.title}\n验收标准：${input.task.acceptance}`,
    };
  },
};

export interface DevReviewInput {
  task: Subtask;
  step: DevStepOutput;
  goal: string;
}

/** 双维度评审：完成情况（治谎报完成）+ 目标偏差（治越做越偏）。 */
export const devReviewer: EvaluatorNode<DevReviewInput> = {
  id: "dev-reviewer",
  kind: "evaluator",
  purpose: "review",
  role: "你是严格的代码评审员，对照子任务验收标准与最终目标做双维度评审。",
  output: verdictContract,
  render(input, _ctx) {
    return {
      static:
        "维度一·完成情况：子任务是否真做完、测试是否真过（看 testsRun 有没有 failed）——填 completion。维度二·目标偏差：产出是否贴合验收标准与最终目标——填 deviation.score(0~1)。pass 仅在两维都过时为 true，否则把问题逐条列进 requiredFixes。",
      dynamic: `子任务：${JSON.stringify(input.task)}\n最终目标：${input.goal}\n开发回报：${JSON.stringify(input.step, null, 2)}`,
    };
  },
};
