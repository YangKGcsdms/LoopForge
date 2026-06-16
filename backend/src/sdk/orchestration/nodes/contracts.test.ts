import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verdictContract } from "./contracts.js";

const valid = {
  completion: { done: true, evidence: "e" },
  deviation: { score: 0.2, reason: "r" },
  pass: true,
  requiredFixes: ["a"],
};

describe("verdictContract", () => {
  it("合法 verdict 通过", () => {
    assert.equal(verdictContract.parse(JSON.stringify(valid)).ok, true);
  });
  it("pass 非 boolean → 报错", () => {
    assert.equal(verdictContract.parse('{"completion":{"done":true,"evidence":""},"deviation":{"score":0.1,"reason":""},"pass":"x","requiredFixes":[]}').ok, false);
  });
  it("deviation.score 非 number → 报错", () => {
    const bad = { ...valid, deviation: { score: "high", reason: "" } };
    assert.equal(verdictContract.parse(JSON.stringify(bad)).ok, false);
  });
  it("requiredFixes 非数组 → 报错", () => {
    const bad = { ...valid, requiredFixes: "none" };
    assert.equal(verdictContract.parse(JSON.stringify(bad)).ok, false);
  });
});
