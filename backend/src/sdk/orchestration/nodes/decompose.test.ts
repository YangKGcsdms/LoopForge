import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decomposeNode, decomposeReviewer } from "./decompose.js";
import type { EvaluatorVerdict } from "../node.js";

const failVerdict: EvaluatorVerdict = {
  completion: { done: false, evidence: "" },
  deviation: { score: 0.5, reason: "" },
  pass: false,
  requiredFixes: ["把 T1 拆细"],
};

describe("decomposeNode.output", () => {
  it("subtasks 必须是数组", () => {
    assert.equal(decomposeNode.output.parse('{"subtasks":"x","ambiguities":[],"gaps":[],"toSupplement":[]}').ok, false);
    assert.equal(decomposeNode.output.parse('{"subtasks":[],"ambiguities":[],"gaps":[],"toSupplement":[]}').ok, true);
  });
  it("缺三类产物之一 → 报错", () => {
    assert.equal(decomposeNode.output.parse('{"subtasks":[],"ambiguities":[],"gaps":[]}').ok, false);
  });
});

describe("decomposeNode.render", () => {
  it("首轮带需求与目标", () => {
    const p = decomposeNode.render({ requirement: "需求R", goal: "目标G" }, {});
    assert.ok(p.dynamic.includes("需求R"));
    assert.ok(p.dynamic.includes("目标G"));
    assert.ok(p.static.includes("3~5"));
  });
  it("矫正轮带上一轮 requiredFixes", () => {
    const p = decomposeNode.render({ requirement: "R", goal: "G" }, { priorVerdict: failVerdict });
    assert.ok(p.dynamic.includes("把 T1 拆细"));
  });
});

describe("decomposeReviewer", () => {
  it("输出走 verdictContract", () => {
    assert.equal(decomposeReviewer.kind, "evaluator");
    assert.equal(
      decomposeReviewer.output.parse(
        '{"completion":{"done":true,"evidence":""},"deviation":{"score":0.1,"reason":""},"pass":true,"requiredFixes":[]}',
      ).ok,
      true,
    );
  });
});
