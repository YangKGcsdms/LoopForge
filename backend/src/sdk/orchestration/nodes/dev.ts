/**
 * 开发 loop 的两个节点：开发步进（在指定工作目录下实现子任务）+ 双维度评审。
 * 工作目录来自 ctx.workspace.cwd —— 项目指定要在哪个目录下开发代码。
 */

import { defineContract, type ContractResult } from "../contract.js";
import type { EvaluatorNode, NodeRunContext, NodeTemplate } from "../node.js";
import type { Subtask } from "./decompose.js";
import { verdictContract } from "./contracts.js";

/**
 * 把上游 act 的「地面真值」（独立校验 verification + 工具轨迹 evidence）格式化给评审看。
 * 评审据此判，而非 producer 自报的 testsRun/filesTouched。
 */
function groundTruth(ctx: NodeRunContext): string {
  const v = ctx.verification;
  const e = ctx.evidence;
  const lines: string[] = [];
  if (v) {
    lines.push("【独立校验·地面真值，优先采信】");
    lines.push(`真实改动文件：${v.filesChanged.length ? v.filesChanged.join(", ") : "（无改动！）"}`);
    if (v.diffStat) lines.push(`diff stat：${v.diffStat}`);
    lines.push(`testsPass：${v.testsPass === null ? "null（无独立校验信号，不得据此判 done）" : v.testsPass}`);
    if (v.checks.length) {
      lines.push(`校验明细：${v.checks.map((c) => `${c.name}=${c.ok ? "过" : `挂(exit ${c.exitCode})`}`).join("；")}`);
    }
  } else {
    lines.push("【独立校验】本次无（未配 verify）——不得据测试是否通过来判 done。");
  }
  if (e && (e.bashRuns.length || e.filesTouched.length)) {
    const cmds = e.bashRuns.map((b) => `${b.command}${b.ok === false ? "(失败)" : b.ok === null ? "(未知)" : ""}`).join("；");
    lines.push(`【agent 工具轨迹·参考】改了：${e.filesTouched.join(", ") || "无"}；跑过命令：${cmds || "无"}`);
  }
  return lines.join("\n");
}

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
  exec: "act", // 真改代码：走 act 原语（真工具 + 审批 + 证据）
  role: "你是开发工程师，实现给定子任务并自检。",
  output: devStepContract,
  mode: "agent",
  tools: ["Read", "Edit", "Write", "Bash"],
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

/**
 * 双维度评审：完成情况（治谎报完成）+ 目标偏差（治越做越偏）。
 * **判地面真值（独立校验 + 工具轨迹），不判 producer 自报。** 自报与校验冲突，以校验为准。
 */
export const devReviewer: EvaluatorNode<DevReviewInput> = {
  id: "dev-reviewer",
  kind: "evaluator",
  purpose: "review",
  role: "你是严格的代码评审员，对照子任务验收标准与最终目标做双维度评审。",
  output: verdictContract,
  render(input, ctx) {
    return {
      static:
        "维度一·完成情况：**以【独立校验】为准**——testsPass=false 或 null 时 completion.done 必须为 false（null=没有独立证明，不许默认通过；无真实改动文件也判未完成）。维度二·目标偏差：产出是否贴合验收标准与最终目标——填 deviation.score(0~1)。**自报与独立校验冲突时以校验为准，并在 deviation.reason 点出谎报。** pass 仅两维都过时为 true，否则把问题逐条写进 requiredFixes。",
      dynamic: [
        `子任务：${JSON.stringify(input.task)}`,
        `最终目标：${input.goal}`,
        groundTruth(ctx),
        `【开发自报·次要，可能不可信】${JSON.stringify(input.step)}`,
      ].join("\n"),
    };
  },
};

/**
 * 红队对抗评审 —— 与 devReviewer 并行跑，默认假设开发在谎报/偷工，专挑能"打回"的硬伤。
 * 治"单个评审员橡皮图章"：只有它和 devReviewer 都判 pass，loop 才收敛。
 */
export const devRedTeam: EvaluatorNode<DevReviewInput> = {
  id: "dev-redteam",
  kind: "evaluator",
  purpose: "review",
  role: "你是红队评审员，立场是对抗的：默认这次开发没真做完、测试没真跑、产出可能编译/运行不起来。",
  output: verdictContract,
  render(input, ctx) {
    return {
      static:
        "对抗式审查，**只认【独立校验】这把尺子，自报一律视为未证实**：testsPass 非 true（false/null）即判未完成；真实改动文件为空即判没做；校验有 exit 非 0 即打回。逐条质疑产出是否真编译/真过、是否偏离验收标准。只要存疑就 pass=false 并把质疑点写进 requiredFixes；只有独立校验全过且改动对路才给 pass=true。宁可错杀，不可放过。",
      dynamic: [
        `子任务：${JSON.stringify(input.task)}`,
        `最终目标：${input.goal}`,
        groundTruth(ctx),
        `【开发自报·不可信，仅供对照】${JSON.stringify(input.step)}`,
      ].join("\n"),
    };
  },
};
