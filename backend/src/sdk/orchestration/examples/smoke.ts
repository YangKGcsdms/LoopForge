/**
 * 冒烟：用假 Sender 把拆解节点跑一遍，证明契约可执行（含指定工作目录）。
 * 运行：npx tsx src/sdk/orchestration/examples/smoke.ts
 * 第一次故意吐坏 JSON 触发修复重试，第二次给合法结构。
 */

import { runNode, persistHook, logHook, type Sender, type NodeRunStore, type NodeRunRecord } from "../index.js";
import { decomposeNode, type DecomposeOutput } from "../nodes/decompose.js";

const records: NodeRunRecord[] = [];
const memStore: NodeRunStore = {
  async append(r) {
    records.push(r);
  },
  async list() {
    return records;
  },
};

let calls = 0;
const fakeSend: Sender = async () => {
  calls++;
  const good = JSON.stringify({
    subtasks: [{ id: "T1", title: "建调薪记录表", estimateHours: 4, acceptance: "迁移可回滚" }],
    ambiguities: ["调薪幅度上限未定"],
    gaps: [],
    toSupplement: ["需要 HR 提供职级表"],
  } satisfies DecomposeOutput);
  return {
    result: calls === 1 ? "这是一段不是 JSON 的解释" : good,
    durationMs: 10,
    requestId: `req-${calls}`,
    usage: { inputTokens: 100, outputTokens: 50 },
  };
};

const fakeSummarize: Sender = async () => ({
  result: "把调薪需求拆成 1 个子任务，标注 1 处不明确、1 项待补充",
  durationMs: 5,
});

const result = await runNode(
  decomposeNode,
  { requirement: "做一个调薪审批模块", goal: "HR 能发起、多级审批、可追溯" },
  { loopId: "demo", iteration: 1, workspace: { cwd: process.cwd() } },
  { send: fakeSend, summarize: fakeSummarize, hooks: [logHook(), persistHook(memStore)] },
);

console.log("\n=== 节点结果 ===");
console.log("status:", result.status, "| repairs:", result.repairs, "| durationMs:", result.durationMs);
console.log("subtasks:", result.output?.subtasks.length, "| ambiguities:", result.output?.ambiguities);
console.log("summary:", result.summary);
console.log("\n=== 落库记录（NodeRunRecord）===");
console.log(JSON.stringify(records[0], null, 2));
