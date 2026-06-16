import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planNode } from "./plan.js";

describe("planNode（出方案）", () => {
  it("contract：合法方案通过", () => {
    assert.equal(
      planNode.output.parse(
        '{"approach":"x","keyDecisions":[],"risks":[],"phases":[],"acceptance":[],"openQuestions":[]}',
      ).ok,
      true,
    );
  });
  it("contract：缺 approach / 数组字段非数组 → 报错", () => {
    assert.equal(
      planNode.output.parse('{"keyDecisions":[],"risks":[],"phases":[],"acceptance":[],"openQuestions":[]}').ok,
      false,
    );
    assert.equal(
      planNode.output.parse('{"approach":"x","keyDecisions":"no","risks":[],"phases":[],"acceptance":[],"openQuestions":[]}')
        .ok,
      false,
    );
  });
  it("purpose=plan → 路由到强模型", () => {
    assert.equal(planNode.purpose, "plan");
  });
  it("render 带需求/目标/难度", () => {
    const p = planNode.render({ requirement: "需求R", goal: "目标G", difficulty: "hard" }, {});
    assert.ok(p.dynamic.includes("需求R"));
    assert.ok(p.dynamic.includes("目标G"));
    assert.ok(p.dynamic.includes("hard"));
    assert.ok(p.static.includes("approach"));
  });
});
