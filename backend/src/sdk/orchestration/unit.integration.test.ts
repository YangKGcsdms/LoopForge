/**
 * 最小执行单元的集成测试 —— hermetic、零计费（不碰 SDK），但**关令是真判地面真值**。
 *
 * 场景：开发一个 `add(a,b)` —— 要求同时处理数字、字符串数字、浮点。设计成 2~3 轮：
 *   R1 `a + b`            → 字符串用例挂（'2'+'3'='23'）→ 打回。
 *   R2 `parseInt + parseInt` → 字符串过了，但**引入回归**：浮点被截断（parseInt(0.5)=0）→ 打回。
 *   R3 `Number + Number`  → 全过 → 收敛。
 *
 * 执行者是脚本 mock（按 R1/R2/R3 顺序吐产物，模拟"据反馈逐轮修正"），
 * 但**门控真的把产物 eval 出来跑用例** = 地面真值，不看自报。这条链路跑通，就证明：
 *   resume 续跑同一会话 · 反馈 delta 路由回收件人 · 关令判真值并能逮回归 · 收敛 · 全程落库。
 *
 * 产出落到仓库根 output/<taskId>/（已 gitignore），可肉眼回看。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runUnit, type Executor, type Gate, type UnitArtifact } from "./unit.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// backend/src/sdk/orchestration → 仓库根 → output/
const OUTPUT_DIR = path.resolve(HERE, "../../../../output");
const TASK_ID = "U001-add-function";
const EXECUTOR_ID = "executor:add";
const SESSION_ID = "sess-U001";

// ── 地面真值：三条用例，真跑产物对照 ───────────────────────────────
interface Case {
  label: string;
  args: unknown[];
  expect: number;
}
const CASES: Case[] = [
  { label: "add(2,3)=5", args: [2, 3], expect: 5 },
  { label: "add('2','3')=5 字符串数字", args: ["2", "3"], expect: 5 },
  { label: "add(0.5,0.25)=0.75 浮点", args: [0.5, 0.25], expect: 0.75 },
];

function runCases(source: string): { total: number; passed: string[]; failed: string[] } {
  let fn: ((...a: unknown[]) => unknown) | undefined;
  try {
    // 把产物里的 add 拿出来真跑 —— 这就是"独立校验/地面真值"。
    fn = new Function(`${source}\n;return add;`)() as (...a: unknown[]) => unknown;
  } catch {
    fn = undefined;
  }
  const passed: string[] = [];
  const failed: string[] = [];
  for (const c of CASES) {
    let ok = false;
    try {
      ok = fn ? fn(...c.args) === c.expect : false;
    } catch {
      ok = false;
    }
    (ok ? passed : failed).push(c.label);
  }
  return { total: CASES.length, passed, failed };
}

/** 关令：真跑用例判地面真值，按收件人(target)路由反馈。 */
function makeAddGate(target: string): Gate {
  return (artifact: UnitArtifact) => {
    const ground = runCases(artifact.content); // 不看 artifact.note 自报
    const pass = ground.failed.length === 0;
    return {
      pass,
      target,
      ground,
      feedback: pass ? "" : `未通过用例：${ground.failed.join("；")}。请修正后继续。`,
      reason: pass ? "全部用例通过" : `${ground.failed.length}/${ground.total} 条用例未过`,
    };
  };
}

/** 脚本执行者：按序吐 R1/R2/R3 产物，模拟据反馈逐轮修正；resume 必须续跑同一会话。 */
function scriptedExecutor(sessionId: string, sources: string[]): Executor {
  let step = 0;
  return {
    async start(_task: string): Promise<UnitArtifact> {
      const content = sources[0];
      step = 1;
      return { sessionId, content, note: "首轮实现（模拟执行者）" };
    },
    async resume(sid: string, _feedback: string): Promise<UnitArtifact> {
      // live 版这里会把 _feedback 当 next turn 喂给续跑的会话；mock 按脚本推进。
      if (sid !== sessionId) {
        throw new Error(`resume 会话不匹配：${sid} != ${sessionId}（应续跑同一会话）`);
      }
      const content = sources[Math.min(step, sources.length - 1)];
      step += 1;
      return { sessionId: sid, content, note: "据反馈修正（模拟执行者）" };
    },
  };
}

const SOURCES = [
  "function add(a, b) { return a + b; }", // R1：字符串挂
  "function add(a, b) { return parseInt(a) + parseInt(b); }", // R2：浮点回归
  "function add(a, b) { return Number(a) + Number(b); }", // R3：全过
];

test("最小执行单元：拦下→带反馈续跑→再判，2~3 轮收敛并全程落库", async () => {
  const result = await runUnit(
    {
      taskId: TASK_ID,
      task: "实现 add(a,b)：同时支持数字、字符串数字、浮点；配 3 条用例。",
      executor: scriptedExecutor(SESSION_ID, SOURCES),
      gate: makeAddGate(EXECUTOR_ID),
      maxRounds: 3,
    },
    { outDir: OUTPUT_DIR },
  );

  // —— 收敛与轮次 ——
  assert.equal(result.status, "converged", "应在 maxRounds 内收敛，而非撞上限 force-ship");
  assert.equal(result.rounds, 3, "本场景应恰好 3 轮（含一次回归被逮）");
  const [r1, r2, r3] = result.records;

  // —— 关令判地面真值：R1 字符串挂、R2 浮点回归、R3 全过 ——
  assert.equal(r1.verdict.pass, false);
  assert.ok(
    r1.verdict.feedback.includes("字符串"),
    "R1 应因字符串用例被打回",
  );
  assert.equal(r2.verdict.pass, false);
  assert.ok(
    r2.verdict.feedback.includes("浮点"),
    "R2 应逮到浮点回归（parseInt 截断）——证明门控判的是真值不是自报",
  );
  assert.equal(r3.verdict.pass, true, "R3 应全部用例通过");

  // —— resume：unit 内全程续跑同一会话（非每轮起新会话）——
  assert.equal(r1.resumed, false, "R1 是首轮新会话");
  assert.equal(r2.resumed, true, "R2 应 resume");
  assert.equal(r3.resumed, true, "R3 应 resume");
  assert.equal(r1.sessionId, SESSION_ID);
  assert.equal(r2.sessionId, SESSION_ID, "resume 必须续跑同一会话");
  assert.equal(r3.sessionId, SESSION_ID, "resume 必须续跑同一会话");

  // —— 反馈 delta 路由回收件人，并作为下一轮输入续跑 ——
  assert.equal(r1.route.action, "reassign");
  assert.equal(r1.route.target, EXECUTOR_ID, "门控反驳谁→反馈就投回谁（最小路由）");
  assert.equal(r2.input, r1.verdict.feedback, "R2 的输入应就是 R1 的反馈 delta");
  assert.equal(r3.input, r2.verdict.feedback, "R3 的输入应就是 R2 的反馈 delta");
  assert.equal(r3.route.action, "advance", "收敛轮应 advance（放行步进）");

  // —— 落库：output/<taskId>/rounds/NN 逐轮可回看 ——
  const r3out = await fs.readFile(
    path.join(OUTPUT_DIR, TASK_ID, "rounds", "03", "output.txt"),
    "utf8",
  );
  assert.ok(r3out.includes("Number"), "R3 产物应已落库");
  const manifest = JSON.parse(
    await fs.readFile(path.join(OUTPUT_DIR, TASK_ID, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.status, "converged");
  assert.equal(manifest.rounds, 3);
  assert.equal(manifest.finalVerdict.pass, true, "manifest 应记最终放行");

  // —— 复盘维度文件：report / metrics / decisions ——
  const report = await fs.readFile(path.join(OUTPUT_DIR, TASK_ID, "report.md"), "utf8");
  assert.ok(report.includes("复盘报告") && report.includes("定性"), "应渲染 report.md（含定性）");
  const metrics = JSON.parse(await fs.readFile(path.join(OUTPUT_DIR, TASK_ID, "metrics.json"), "utf8"));
  assert.equal(metrics.perRound.length, 3, "metrics 应逐轮");
  const decisions = (await fs.readFile(path.join(OUTPUT_DIR, TASK_ID, "decisions.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  assert.equal(decisions.length, 3, "decisions.jsonl 应每轮一条裁决");
  assert.equal(decisions[2].pass, true, "末轮裁决应放行");
  // 逐轮·思维：session.md 存在
  await fs.access(path.join(OUTPUT_DIR, TASK_ID, "rounds", "03", "session.md"));

  // —— 时序日志系统：events.jsonl 可逐事件复盘 ——
  const logLines = (await fs.readFile(path.join(OUTPUT_DIR, TASK_ID, "events.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  assert.equal(logLines[0].kind, "run_start", "首条应为 run_start");
  assert.equal(logLines[logLines.length - 1].kind, "run_end", "末条应为 run_end");
  for (let i = 0; i < logLines.length; i++) {
    assert.equal(logLines[i].seq, i, "seq 应从 0 单调递增、无缺号");
    assert.equal(typeof logLines[i].t, "number", "每条须有绝对时间戳 t");
    assert.equal(typeof logLines[i].iso, "string", "每条须有 iso 时间戳");
    assert.equal(typeof logLines[i].dt, "number", "每条须有距起点 dt");
    if (i > 0) assert.ok(logLines[i].dt >= logLines[i - 1].dt, "时序不得倒退（dt 单调不减）");
  }
  assert.equal(logLines.filter((e) => e.kind === "verdict").length, 3, "应有 3 条关令裁决");
  assert.equal(logLines.filter((e) => e.kind === "round_start").length, 3, "应有 3 个轮次起点");
  const lastVerdict = logLines.filter((e) => e.kind === "verdict").pop();
  assert.equal(lastVerdict.data.pass, true, "末轮裁决应放行");
  // timeline.md（人读时间线）已渲染
  const timeline = await fs.readFile(path.join(OUTPUT_DIR, TASK_ID, "timeline.md"), "utf8");
  assert.ok(timeline.includes("运行时序"), "应渲染 timeline.md");

  // 给运行者一个肉眼回看的指引。
  console.log(`\n[单元集测] 产出已落到：${path.join(OUTPUT_DIR, TASK_ID)}（见 report.md / timeline.md / metrics.json / rounds/*/）\n`);
});
