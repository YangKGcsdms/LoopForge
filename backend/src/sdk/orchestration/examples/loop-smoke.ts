/**
 * 冒烟：用假 Sender 把「拆解 loop」跑到收敛，验证 evaluator-optimizer 骨架。
 * 运行：npx tsx src/sdk/orchestration/examples/loop-smoke.ts
 *
 * 模拟：第 1 轮产出 16 工时大任务 + 未决项 → 评审不过 → 矫正 → 第 2 轮全 ≤5 工时 → 收敛。
 */

import {
  runLoop,
  persistHook,
  logHook,
  type Sender,
  type NodeRunStore,
  type NodeRunRecord,
  type LoopSpec,
} from "../index.js";
import {
  decomposeNode,
  decomposeReviewer,
  type DecomposeInput,
  type DecomposeOutput,
} from "../nodes/decompose.js";

const records: NodeRunRecord[] = [];
const store: NodeRunStore = {
  async append(r) {
    records.push(r);
  },
  async list() {
    return records;
  },
};

let iter = 0;
const fakeSend: Sender = async (req) => {
  const isEvaluator = req.system.includes("评审员");
  if (!isEvaluator) {
    iter++;
    const tooCoarse = iter === 1;
    const out: DecomposeOutput = tooCoarse
      ? {
          subtasks: [{ id: "T1", title: "整个调薪模块", estimateHours: 16, acceptance: "能用" }],
          ambiguities: ["审批层级未定"],
          gaps: [],
          toSupplement: [],
        }
      : {
          subtasks: [
            { id: "T1", title: "建调薪记录表", estimateHours: 4, acceptance: "迁移可回滚" },
            { id: "T2", title: "发起调薪接口", estimateHours: 5, acceptance: "校验 + 落库 + 触发审批" },
          ],
          ambiguities: [],
          gaps: [],
          toSupplement: [],
        };
    return { result: JSON.stringify(out), durationMs: 10, requestId: `p-${iter}` };
  }
  const converged = iter >= 2;
  const verdict = {
    completion: { done: converged, evidence: converged ? "全部 ≤5 工时、无未决项" : "存在 16 工时大任务" },
    deviation: { score: converged ? 0.1 : 0.7, reason: converged ? "可直接开发" : "粒度过粗、有未决项" },
    pass: converged,
    requiredFixes: converged ? [] : ["把 T1 拆成 ≤5 工时的子任务", "明确审批层级"],
  };
  return { result: JSON.stringify(verdict), durationMs: 8, requestId: `e-${iter}` };
};

const fakeSummarize: Sender = async () => ({ result: "（小模型一句话总结）", durationMs: 3 });

const decomposeLoop: LoopSpec<DecomposeInput, DecomposeOutput, DecomposeOutput> = {
  id: "decompose-loop",
  producer: decomposeNode,
  evaluator: decomposeReviewer,
  toEvalInput: (output) => output,
  maxIterations: 4,
};

const result = await runLoop(
  decomposeLoop,
  { requirement: "做一个调薪审批模块", goal: "HR 能发起、多级审批、可追溯" },
  { workspace: { cwd: process.cwd() } },
  { send: fakeSend, summarize: fakeSummarize, hooks: [logHook(), persistHook(store)] },
);

console.log("\n=== Loop 结果 ===");
console.log("status:", result.status, "| iterations:", result.iterations);
console.log(
  "最终子任务:",
  result.output?.subtasks.map((s) => `${s.id}:${s.estimateHours}h`),
);
console.log("最终判定 pass:", result.verdict?.pass, "| gate:", result.decision?.action);
console.log("\n=== 每轮轨迹 ===");
for (const it of result.history) {
  console.log(
    `#${it.iteration}  produced=${it.produced.status}  review.pass=${it.reviewed.output?.pass}  gate=${it.decision.action}`,
  );
}
console.log("\n落库记录数（每轮 产出+评审 各一条）:", records.length);
