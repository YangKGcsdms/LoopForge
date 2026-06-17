import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { devStepNode, devReviewer, devRedTeam } from "./dev.js";
import type { EvaluatorVerdict, Verification } from "../node.js";
import type { Subtask } from "./decompose.js";

const task: Subtask = { id: "T7", title: "标题", estimateHours: 4, acceptance: "验收标准X" };
const failVerdict: EvaluatorVerdict = {
  completion: { done: false, evidence: "" },
  deviation: { score: 0.5, reason: "" },
  pass: false,
  requiredFixes: ["补无权限用例"],
};

describe("devStepNode.render", () => {
  it("首轮：带任务 id、cwd、验收标准", () => {
    const p = devStepNode.render({ task }, { workspace: { cwd: "/w/repo" } });
    assert.ok(p.dynamic.includes("T7"));
    assert.ok(p.dynamic.includes("验收标准X"));
    assert.ok(p.static.includes("/w/repo"));
  });
  it("矫正轮：仍带任务 id（修了 T? bug）且带 requiredFixes", () => {
    const p = devStepNode.render({ task }, { workspace: { cwd: "/w/repo" }, priorVerdict: failVerdict });
    assert.ok(p.dynamic.includes("T7"));
    assert.ok(p.dynamic.includes("补无权限用例"));
  });
  it("无 workspace 时回退 process.cwd（不抛错）", () => {
    const p = devStepNode.render({ task }, {});
    assert.ok(p.static.length > 0);
  });
});

describe("devStepNode.output", () => {
  it("必需字段齐全 → 通过", () => {
    assert.equal(
      devStepNode.output.parse('{"taskId":"T1","filesTouched":[],"summary":"s","testsRun":null,"selfCheck":"c"}').ok,
      true,
    );
  });
  it("缺 taskId / filesTouched 非数组 → 报错", () => {
    assert.equal(devStepNode.output.parse('{"filesTouched":[],"summary":"s","selfCheck":"c"}').ok, false);
    assert.equal(devStepNode.output.parse('{"taskId":"T1","filesTouched":"x","summary":"s","selfCheck":"c"}').ok, false);
  });
});

describe("devReviewer", () => {
  it("双维度评审，输出走 verdictContract", () => {
    assert.equal(devReviewer.kind, "evaluator");
    const p = devReviewer.render(
      { task, step: { taskId: "T7", filesTouched: [], summary: "s", testsRun: null, selfCheck: "c" }, goal: "目标G" },
      {},
    );
    assert.ok(p.dynamic.includes("目标G"));
    assert.ok(p.static.includes("完成情况") || p.static.includes("完成"));
  });
});

describe("接地气 evaluator（判 verification 而非自报）", () => {
  // 自报"全过 9/0"，但独立校验给出真相
  const step = { taskId: "T7", filesTouched: ["a.ts"], summary: "做完了", testsRun: { passed: 9, failed: 0 }, selfCheck: "全过" };
  const input = { task, step, goal: "目标G" };

  it("devReviewer.render 注入 verification：testsPass=false 进 prompt，指令要求据校验判 done", () => {
    const v: Verification = {
      filesChanged: ["a.ts"],
      diffStat: "1 file changed",
      checks: [{ name: "test", command: "npm test", exitCode: 1, ok: false, output: "FAIL" }],
      testsPass: false,
    };
    const p = devReviewer.render(input, { verification: v });
    assert.ok(p.dynamic.includes("testsPass"));
    assert.ok(p.dynamic.includes("false"));
    assert.ok(p.dynamic.includes("独立校验"));
    assert.ok(/独立校验/.test(p.static) && /false|不得|null/.test(p.static));
  });

  it("无 verification → render 明示无独立信号（不得据测试判 done）", () => {
    const p = devReviewer.render(input, {});
    assert.ok(/无|未配/.test(p.dynamic));
  });

  it("devRedTeam 同样判 verification：testsPass=null 也不算过", () => {
    const v: Verification = { filesChanged: [], diffStat: "", checks: [], testsPass: null };
    const p = devRedTeam.render(input, { verification: v });
    assert.ok(p.dynamic.includes("testsPass"));
    assert.ok(/独立校验|地面真值|尺子/.test(p.static));
  });

  it("evidence 工具轨迹（含失败命令）进入 prompt 作参考", () => {
    const p = devReviewer.render(input, {
      evidence: { toolCalls: [], filesTouched: ["a.ts"], bashRuns: [{ command: "npm test", ok: false }] },
    });
    assert.ok(p.dynamic.includes("npm test"));
    assert.ok(p.dynamic.includes("失败"));
  });
});
