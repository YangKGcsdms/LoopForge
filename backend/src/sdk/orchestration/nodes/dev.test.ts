import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { devStepNode, devReviewer } from "./dev.js";
import type { EvaluatorVerdict } from "../node.js";
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
