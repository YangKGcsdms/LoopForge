import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { runNode, type ActSender, type Sender, type Verifier } from "./run.js";
import { senderFor, actSenderFor } from "./sender.js";
import { makeVerifier } from "./verify.js";
import { difficultyAssessor } from "./nodes/router.js";
import { planNode } from "./nodes/plan.js";
import { decomposeNode, decomposeReviewer, type DecomposeOutput } from "./nodes/decompose.js";
import { devStepNode, devReviewer, devRedTeam, type DevStepOutput } from "./nodes/dev.js";
import { testWriterNode } from "./nodes/test.js";
import type { Subtask } from "./nodes/decompose.js";
import type { NodeRunContext } from "./node.js";
import { getApiKey } from "../../config/store.js";
import { SAFE_TOOLS } from "../approval/index.js";
import { ClaudeAgentProvider } from "../claude/claudeProvider.js";

/**
 * Live 节点集成 —— 每类节点真调 CC 一次，断言**符合各自契约**。
 * Cursor 已冻结，全部走 Claude 路线；用 haiku（最便宜）+ 本机 Claude 登录态（空 key）。
 * 不进默认 `npm test`（文件名 *.itest.ts），单独 `npm run test:live` 跑（会计费，几分钱）。
 * 验收：difficulty/plan/decompose/decomposeReviewer/devStep(act)/devReviewer/devRedTeam/testWriter(act) 各一次。
 */
const HAIKU = { id: "claude-haiku-4-5" };
const haiku = () => HAIKU;

let key = "";
let think: Sender;

before(async () => {
  key = (await getApiKey("claude-agent")) ?? ""; // 空 = 本机登录态
  think = senderFor("claude-agent", key, {});
});

const sampleTask: Subtask = { id: "T1", title: "创建 sum.ts 导出 sum(a,b)=a+b", estimateHours: 1, acceptance: "sum.ts 存在并导出 sum 函数" };
const sampleDecompose: DecomposeOutput = {
  subtasks: [{ id: "T1", title: "建表", estimateHours: 16, acceptance: "能用" }],
  ambiguities: ["边界未定"],
  gaps: [],
  toSupplement: [],
};

describe("think 节点 · 真集成一次（haiku，符合契约）", () => {
  let cwd = "";
  before(() => {
    cwd = mkdtempSync(join(tmpdir(), "lf-think-"));
  });
  after(() => cwd && rmSync(cwd, { recursive: true, force: true }));

  it("difficultyAssessor → {difficulty∈枚举, reason}", async () => {
    const r = await runNode(difficultyAssessor, { task: "给 README 改错别字", goal: "修好" }, { workspace: { cwd } }, { send: think, resolveModel: haiku });
    assert.equal(r.status, "ok", `error=${r.error}｜raw=${r.raw?.slice(0, 200)}`);
    assert.ok(["easy", "medium", "hard"].includes(r.output?.difficulty ?? ""));
    assert.equal(typeof r.output?.reason, "string");
  });

  it("planNode → PlanOutput（approach + 5 个数组字段）", async () => {
    const r = await runNode(planNode, { requirement: "做一个待办小工具", goal: "增删改查", difficulty: "easy" }, { workspace: { cwd } }, { send: think, resolveModel: haiku });
    assert.equal(r.status, "ok", `error=${r.error}｜raw=${r.raw?.slice(0, 200)}`);
    assert.equal(typeof r.output?.approach, "string");
    for (const k of ["keyDecisions", "risks", "phases", "acceptance", "openQuestions"] as const) {
      assert.ok(Array.isArray(r.output?.[k]), `${k} 应为数组`);
    }
  });

  it("decomposeNode → DecomposeOutput（subtasks…）", async () => {
    const r = await runNode(decomposeNode, { requirement: "做一个待办清单小工具", goal: "能增删改查" }, { workspace: { cwd } }, { send: think, resolveModel: haiku });
    assert.equal(r.status, "ok", `error=${r.error}｜raw=${r.raw?.slice(0, 300)}`);
    assert.ok(Array.isArray(r.output?.subtasks) && (r.output?.subtasks.length ?? 0) > 0);
  });

  it("decomposeReviewer → EvaluatorVerdict（双维度）", async () => {
    const r = await runNode(decomposeReviewer, sampleDecompose, { workspace: { cwd } }, { send: think, resolveModel: haiku });
    assert.equal(r.status, "ok", `error=${r.error}｜raw=${r.raw?.slice(0, 200)}`);
    assert.equal(typeof r.output?.pass, "boolean");
    assert.equal(typeof r.output?.completion.done, "boolean");
    assert.equal(typeof r.output?.deviation.score, "number");
  });
});

describe("act 节点 + 接地气评审 · 真集成一次（haiku，真 git 仓）", () => {
  let cwd = "";
  let act: ActSender;
  let verify: Verifier;
  let step: DevStepOutput | undefined;

  before(() => {
    cwd = mkdtempSync(join(tmpdir(), "lf-act-"));
    execFileSync("git", ["init", "-q"], { cwd });
    act = actSenderFor("claude-agent", key, { defaultCwd: cwd, allowedTools: SAFE_TOOLS });
    verify = makeVerifier({ checks: [{ name: "file-exists", command: "test -f sum.ts && echo ok" }] });
  });
  after(() => cwd && rmSync(cwd, { recursive: true, force: true }));

  it("devStepNode(act) → DevStepOutput + 真改文件 + evidence + verify 拿真 testsPass", async () => {
    const r = await runNode(devStepNode, { task: sampleTask }, { workspace: { cwd } }, { send: think, act, verify, resolveModel: haiku });
    assert.equal(r.status, "ok", `error=${r.error}｜raw=${r.raw?.slice(0, 300)}`);
    assert.equal(typeof r.output?.taskId, "string");
    assert.ok(Array.isArray(r.output?.filesTouched));
    step = r.output;
    // 真改了文件（文件落地 或 verify 采到改动）
    assert.ok(existsSync(join(cwd, "sum.ts")) || (r.verification?.filesChanged.length ?? 0) > 0, "应真实创建 sum.ts");
    assert.ok(r.evidence, "应有 evidence");
    assert.ok(r.verification, "应有独立校验");
    assert.equal(r.verification?.testsPass, true); // file-exists check 过
  });

  it("devReviewer 判真实 verification → 合法 EvaluatorVerdict", async () => {
    const v = await verify(cwd);
    const ctx: NodeRunContext = { workspace: { cwd }, verification: v, evidence: { toolCalls: [], filesTouched: v.filesChanged, bashRuns: [] } };
    const r = await runNode(devReviewer, { task: sampleTask, step: step!, goal: "sum.ts 导出 sum" }, ctx, { send: think, resolveModel: haiku });
    assert.equal(r.status, "ok", `error=${r.error}｜raw=${r.raw?.slice(0, 200)}`);
    assert.equal(typeof r.output?.pass, "boolean");
    assert.ok(Array.isArray(r.output?.requiredFixes));
  });

  it("devRedTeam 判真实 verification → 合法 EvaluatorVerdict", async () => {
    const v = await verify(cwd);
    const ctx: NodeRunContext = { workspace: { cwd }, verification: v };
    const r = await runNode(devRedTeam, { task: sampleTask, step: step!, goal: "sum.ts 导出 sum" }, ctx, { send: think, resolveModel: haiku });
    assert.equal(r.status, "ok", `error=${r.error}｜raw=${r.raw?.slice(0, 200)}`);
    assert.equal(typeof r.output?.pass, "boolean");
  });

  it("testWriterNode(act) → TestWriterOutput", async () => {
    const r = await runNode(testWriterNode, { task: sampleTask }, { workspace: { cwd } }, { send: think, act, verify, resolveModel: haiku });
    assert.equal(r.status, "ok", `error=${r.error}｜raw=${r.raw?.slice(0, 300)}`);
    assert.ok(Array.isArray(r.output?.testFiles));
    assert.equal(typeof r.output?.summary, "string");
  });
});

describe("Claude 登录态", () => {
  it("validateCredential 空 key → 探测到本机登录态可用", async () => {
    const r = await new ClaudeAgentProvider().validateCredential("");
    assert.equal(r.valid, true, r.detail);
    assert.match(r.detail, /登录态|模型|可用/);
  });
});
