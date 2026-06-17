import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderNodeOutput, tierClass, kindClass, diffClass } from "./format.js";

describe("renderNodeOutput", () => {
  it("拆解输出 → 子任务列表 + 不明确", () => {
    const t = renderNodeOutput({
      summary: null,
      output: {
        subtasks: [{ id: "T1", title: "建表", estimateHours: 4, acceptance: "可回滚" }],
        ambiguities: ["边界未定"],
        gaps: [],
        toSupplement: [],
      },
    });
    assert.ok(t.includes("T1"));
    assert.ok(t.includes("建表"));
    assert.ok(t.includes("不明确"));
  });

  it("开发步进 → 改动文件 + 测试", () => {
    const t = renderNodeOutput({
      summary: null,
      output: { taskId: "T1", filesTouched: ["a.ts"], summary: "做了", testsRun: { passed: 5, failed: 2 }, selfCheck: "ok" },
    });
    assert.ok(t.includes("a.ts"));
    assert.ok(t.includes("5 过 / 2 败"));
  });

  it("难度输出", () => {
    assert.ok(renderNodeOutput({ summary: null, output: { difficulty: "medium", reason: "中等" } }).includes("medium"));
  });

  it("方案输出 → 思路 / 阶段 / 验收", () => {
    const t = renderNodeOutput({
      summary: null,
      output: { approach: "分层推进", keyDecisions: [], risks: ["风险A"], phases: ["P1", "P2"], acceptance: ["验收A"], openQuestions: [] },
    });
    assert.ok(t.includes("分层推进"));
    assert.ok(t.includes("P1 → P2"));
    assert.ok(t.includes("验收A"));
  });

  it("评审 verdict → 完成/偏差/矫正项", () => {
    const t = renderNodeOutput({
      summary: null,
      output: {
        completion: { done: false, evidence: "缺用例" },
        deviation: { score: 0.5, reason: "偏" },
        pass: false,
        requiredFixes: ["补用例"],
      },
    });
    assert.ok(t.includes("未达标"));
    assert.ok(t.includes("矫正项"));
  });

  it("无法识别 → 回退 summary", () => {
    assert.equal(renderNodeOutput({ summary: "兜底", output: { weird: 1 } }), "兜底");
  });
});

describe("样式映射（暖色 tone）", () => {
  it("tier", () => {
    assert.match(tierClass("strong"), /tone-brand/);
    assert.match(tierClass("cheap"), /tone-mute/);
  });
  it("diff", () => {
    assert.match(diffClass("hard"), /tone-down/);
    assert.match(diffClass("easy"), /tone-up/);
  });
  it("kind", () => {
    assert.match(kindClass("evaluator"), /tone-amber/);
    assert.match(kindClass("producer"), /tone-sage/);
  });
});
