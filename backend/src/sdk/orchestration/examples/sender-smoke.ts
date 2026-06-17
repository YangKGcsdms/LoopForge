/**
 * 冒烟：验证 Sender 适配器把整链接通 —— runLoop → runNode → Sender → SdkProvider.send。
 * 运行：npx tsx src/sdk/orchestration/examples/sender-smoke.ts
 *
 * [1] 注入 mock provider：证明适配器映射正确、拆解 loop 经 provider 路径跑到收敛。
 * [2] 真实 cursor provider（未装 @cursor/sdk）：证明真链路已接通且优雅降级（节点 status=error）。
 */

import { runNode, runLoop, logHook, providerSender, senderFor, type LoopSpec } from "../index.js";
import type { SdkProvider } from "../../provider.js";
import {
  decomposeNode,
  decomposeReviewer,
  type DecomposeInput,
  type DecomposeOutput,
} from "../nodes/decompose.js";

// ---------- [1] mock provider 路径 ----------
let iter = 0;
const mockProvider: Pick<SdkProvider, "send"> = {
  async send(opts) {
    // 总结调用（小模型），不参与迭代计数
    if (opts.prompt.includes("用一句话")) {
      return { result: "（小模型一句话总结）", durationMs: 3 };
    }
    const isEvaluator = opts.prompt.includes("评审员");
    if (!isEvaluator) {
      iter++;
      const coarse = iter === 1;
      const out: DecomposeOutput = coarse
        ? {
            subtasks: [{ id: "T1", title: "整个调薪模块", estimateHours: 16, acceptance: "能用" }],
            ambiguities: ["审批层级未定"],
            gaps: [],
            toSupplement: [],
          }
        : {
            subtasks: [
              { id: "T1", title: "建调薪记录表", estimateHours: 4, acceptance: "迁移可回滚" },
              { id: "T2", title: "发起调薪接口", estimateHours: 5, acceptance: "校验 + 落库" },
            ],
            ambiguities: [],
            gaps: [],
            toSupplement: [],
          };
      return { result: JSON.stringify(out), durationMs: 12, requestId: `p-${iter}` };
    }
    const converged = iter >= 2;
    return {
      result: JSON.stringify({
        completion: { done: converged, evidence: converged ? "全部 ≤5 工时" : "存在 16 工时大任务" },
        deviation: { score: converged ? 0.1 : 0.7, reason: converged ? "可直接开发" : "粒度过粗" },
        pass: converged,
        requiredFixes: converged ? [] : ["把 T1 拆成 ≤5 工时", "明确审批层级"],
      }),
      durationMs: 9,
      requestId: `e-${iter}`,
    };
  },
};

const sender = providerSender(mockProvider, "mock-key", { defaultCwd: process.cwd() });

const decomposeLoop: LoopSpec<DecomposeInput, DecomposeOutput, DecomposeOutput> = {
  id: "decompose-loop",
  producer: decomposeNode,
  evaluator: decomposeReviewer,
  toEvalInput: (output) => output,
  maxIterations: 4,
};

const loop = await runLoop(
  decomposeLoop,
  { requirement: "做一个调薪审批模块", goal: "HR 能发起、多级审批、可追溯" },
  { workspace: { cwd: "/tmp/target-repo" } },
  { send: sender, summarize: sender, hooks: [logHook()] },
);

console.log("\n[1] mock-provider 路径");
console.log("status:", loop.status, "| iterations:", loop.iterations);
console.log("最终子任务:", loop.output?.subtasks.map((s) => `${s.id}:${s.estimateHours}h`));

// ---------- [2] 真实 claude provider（think 路径）----------
const real = senderFor("claude-agent", "no-real-key", { defaultCwd: process.cwd() });
const node = await runNode(
  decomposeNode,
  { requirement: "随便一个需求", goal: "随便一个目标" },
  { workspace: { cwd: process.cwd() } },
  { send: real },
);

console.log("\n[2] 真实 claude think 路径");
console.log("status:", node.status);
console.log("error:", node.error);
