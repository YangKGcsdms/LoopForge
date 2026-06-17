/**
 * 三条 mock 链路集成测试（hermetic，零计费）—— 用**真** orchestration（runPipeline/runLoop/runNode/
 * providerActSender + 真 dev 节点），只把 provider 边界换成 mock，链路全程真实执行、真正走一遍。
 *
 * 链路 A：完整 pipeline（think+act 收敛）
 * 链路 B：接地气（evidence + verify → grounded evaluator 据 testsPass 打回/收敛，证明判地面真值非自报）
 * 链路 C：审批（act → providerActSender → provider.act → canUseTool → approver allow/deny）
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runPipeline } from "./pipeline.js";
import { runLoop, type LoopSpec } from "./loop.js";
import { runNode, type ActSender, type Sender, type Verifier } from "./run.js";
import { providerActSender } from "./sender.js";
import { makeMockSender, makeMockActSender } from "./mock.js";
import { defineContract, type ContractResult } from "./contract.js";
import { devStepNode, devReviewer, devRedTeam, type DevReviewInput, type DevStepInput, type DevStepOutput } from "./nodes/dev.js";
import type { Subtask } from "./nodes/decompose.js";
import type { EvaluatorVerdict, NodeTemplate } from "./node.js";
import type { SdkProvider } from "../provider.js";
import { autoApprover, denyApprover } from "../approval/policy.js";

function verdictJson(pass: boolean): string {
  const v: EvaluatorVerdict = {
    completion: { done: pass, evidence: pass ? "校验通过" : "校验未过" },
    deviation: { score: pass ? 0.1 : 0.8, reason: "" },
    pass,
    requiredFixes: pass ? [] : ["按独立校验修复"],
  };
  return JSON.stringify(v);
}

// ============ 链路 A：完整 pipeline（think + act 收敛）============
describe("链路A · 完整 pipeline（think+act）", () => {
  it("难度→方案→拆解 loop→逐 TODO dev loop 全程跑通、契约全过、claude 路由、全收敛", async () => {
    const mock = makeMockSender();
    const events: string[] = [];
    const r = await runPipeline(
      { requirement: "给后台加多租户 RBAC", goal: "越权被拦，关键路径有测试" },
      { send: mock, act: makeMockActSender(mock), summarize: mock, providerId: "claude-agent", onEvent: (e) => events.push(e) },
    );

    // 契约：拆解收敛、N≥3、每个 ≤5 工时
    assert.equal(r.decompose.status, "converged");
    assert.ok(r.decompose.subtasks.length >= 3);
    assert.ok(r.decompose.subtasks.every((t) => t.estimateHours <= 5));
    // 方案先于拆解
    assert.ok(r.plan && r.plan.approach.length > 0);
    // claude 路由（act 节点 execute/test 在 sonnet，不在 haiku）
    assert.equal(r.routing.plan, "claude-opus-4-8");
    assert.equal(r.routing.execute, "claude-sonnet-4-6");
    assert.equal(r.routing.test, "claude-sonnet-4-6");
    // dev loop 全收敛
    assert.equal(r.developed, r.decompose.subtasks.length);
    assert.ok(r.todos.every((t) => t.status === "converged"));
    // 事件齐全
    for (const e of ["difficulty", "routing", "todos", "done"]) assert.ok(events.includes(e), `缺事件 ${e}`);
  });
});

// ============ 链路 B：接地气（verify 地面真值驱动收敛）============
describe("链路B · 接地气（evidence+verify → grounded evaluator）", () => {
  it("verify testsPass=false 那轮不收敛、=true 才收敛；verification 确实流进评审 prompt", async () => {
    const task: Subtask = { id: "T1", title: "实现鉴权", estimateHours: 4, acceptance: "越权被拦" };

    // act：每轮都"自报"测试全过（用来证明评审不信自报）
    const act: ActSender = async () => ({
      result: JSON.stringify({
        taskId: "T1",
        filesTouched: ["src/auth.ts"],
        summary: "实现完成",
        testsRun: { passed: 9, failed: 0 }, // 自报全过——但下面 verify 说没过
        selfCheck: "本地全过",
      } satisfies DevStepOutput),
      durationMs: 1,
      evidence: { toolCalls: [], filesTouched: ["src/auth.ts"], bashRuns: [{ command: "npm test", ok: false }] },
    });

    // verify：第 1 轮 testsPass=false，第 2 轮=true（地面真值，与自报相反）
    let vcall = 0;
    const verify: Verifier = async () => {
      vcall++;
      const pass = vcall >= 2;
      return {
        filesChanged: ["src/auth.ts"],
        diffStat: "1 file changed",
        checks: [{ name: "test", command: "npm test", exitCode: pass ? 0 : 1, ok: pass, output: pass ? "ok" : "1 failed" }],
        testsPass: pass,
      };
    };

    // 评审：只认 grounded prompt 里的 testsPass（不看自报）
    const seen: string[] = [];
    const send: Sender = async (req) => {
      const isReviewer = req.system.includes("代码评审员") || req.system.includes("红队评审员");
      if (!isReviewer) return { result: "x", durationMs: 1 };
      const m = req.user.match(/testsPass：(true|false|null)/);
      const tp = m?.[1] ?? "?";
      seen.push(tp);
      return { result: verdictJson(tp === "true"), durationMs: 1 };
    };

    const spec: LoopSpec<DevStepInput, DevStepOutput, DevReviewInput> = {
      id: "dev-loop",
      producer: devStepNode,
      evaluator: devReviewer,
      adversaries: [devRedTeam],
      toEvalInput: (step, input) => ({ task: input.task, step, goal: "越权被拦" }),
      maxIterations: 3,
    };
    const r = await runLoop(spec, { task }, { workspace: { cwd: "/w" } }, { send, act, verify });

    assert.equal(r.status, "converged");
    assert.equal(r.iterations, 2); // 第1轮 testsPass=false 不收敛，第2轮才收敛
    assert.equal(r.history[0].reviewed.output?.pass, false); // 自报全过也被打回
    assert.equal(r.history[1].reviewed.output?.pass, true);
    assert.ok(seen.includes("false"), "评审第1轮应看到 testsPass：false");
    assert.ok(seen.includes("true"), "评审第2轮应看到 testsPass：true");
  });
});

// ============ 链路 C：审批（act → canUseTool → approver）============
describe("链路C · 审批（act → provider.act → canUseTool → approver）", () => {
  const ranContract = defineContract<{ ran: boolean }>({
    name: "ran",
    schema: "{ ran: boolean }",
    validate(d): ContractResult<{ ran: boolean }> {
      return typeof (d as { ran?: unknown }).ran === "boolean"
        ? { ok: true, value: d as { ran: boolean } }
        : { ok: false, errors: ["ran 必须是 boolean"] };
    },
  });
  const approvalNode: NodeTemplate<Record<string, never>, { ran: boolean }> = {
    id: "appr",
    kind: "producer",
    exec: "act",
    role: "审批演示节点",
    output: ranContract,
    render: () => ({ static: "", dynamic: "" }),
  };

  /** 假 provider：act 时就一次 Bash，把审批结果如实反映进 evidence 与产出。 */
  const fakeProvider: Pick<SdkProvider, "send" | "act"> = {
    async send() {
      return { result: "", durationMs: 1 };
    },
    async act(o) {
      const decision = await o.approve?.({ tool: "Bash", input: { command: "npm test" }, cwd: o.cwd });
      const allowed = decision?.allow ?? false;
      return {
        result: JSON.stringify({ ran: allowed }),
        durationMs: 1,
        evidence: { toolCalls: [{ tool: "Bash", input: { command: "npm test" }, ok: allowed }], filesTouched: [], bashRuns: [{ command: "npm test", ok: allowed }] },
      };
    },
  };

  it("autoApprover 放行 → Bash 执行、evidence ok=true", async () => {
    const act = providerActSender(fakeProvider, "k", { approve: autoApprover });
    const r = await runNode(approvalNode, {}, { workspace: { cwd: "/w" } }, { send: async () => ({ result: "", durationMs: 1 }), act });
    assert.equal(r.status, "ok");
    assert.equal(r.output?.ran, true);
    assert.equal(r.evidence?.bashRuns[0].ok, true);
  });

  it("denyApprover 拒绝 → Bash 不执行、evidence ok=false", async () => {
    const act = providerActSender(fakeProvider, "k", { approve: denyApprover });
    const r = await runNode(approvalNode, {}, { workspace: { cwd: "/w" } }, { send: async () => ({ result: "", durationMs: 1 }), act });
    assert.equal(r.status, "ok");
    assert.equal(r.output?.ran, false);
    assert.equal(r.evidence?.bashRuns[0].ok, false);
  });
});
