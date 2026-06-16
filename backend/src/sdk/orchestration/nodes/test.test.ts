import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { testWriterNode } from "./test.js";
import type { Subtask } from "./decompose.js";

const task: Subtask = { id: "T7", title: "标题", estimateHours: 4, acceptance: "验收" };

describe("testWriterNode", () => {
  it("contract 校验", () => {
    assert.equal(testWriterNode.output.parse('{"testFiles":[],"cases":[],"summary":"s"}').ok, true);
    assert.equal(testWriterNode.output.parse('{"testFiles":"x","cases":[],"summary":"s"}').ok, false);
  });
  it("render 带 cwd 与任务 id", () => {
    const p = testWriterNode.render({ task }, { workspace: { cwd: "/w" } });
    assert.ok(p.static.includes("/w"));
    assert.ok(p.dynamic.includes("T7"));
  });
});
