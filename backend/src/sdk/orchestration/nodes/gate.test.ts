import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { goalGate, checkHardNever } from "./gate.js";
import type { EvaluatorVerdict } from "../node.js";

function v(pass: boolean, score: number): EvaluatorVerdict {
  return {
    completion: { done: pass, evidence: "" },
    deviation: { score, reason: "" },
    pass,
    requiredFixes: pass ? [] : ["f"],
  };
}

describe("goalGate", () => {
  it("两维达标 → allow", () => {
    assert.equal(goalGate(v(true, 0.1)).action, "allow");
  });
  it("通过但偏差超阈值 → reassign", () => {
    assert.equal(goalGate(v(true, 0.5)).action, "reassign");
  });
  it("未通过且偏差不超阈值 → block", () => {
    assert.equal(goalGate(v(false, 0.1)).action, "block");
  });
  it("自定义阈值放宽 → allow", () => {
    assert.equal(goalGate(v(true, 0.5), { deviationThreshold: 0.6 }).action, "allow");
  });
});

describe("checkHardNever", () => {
  it("命中 rm -rf / → block 且带 hardRuleHit", () => {
    const d = checkHardNever("sudo rm -rf /");
    assert.equal(d?.action, "block");
    assert.ok(d?.hardRuleHit);
  });
  it("命中 drop table（大小写无关）", () => {
    assert.equal(checkHardNever("DROP TABLE users")?.action, "block");
  });
  it("安全命令 → null", () => {
    assert.equal(checkHardNever("ls -la"), null);
  });
  it("自定义红线生效", () => {
    assert.equal(checkHardNever("deploy prod now", { hardNever: ["deploy prod"] })?.action, "block");
  });
});
