import { test } from "node:test";
import assert from "node:assert/strict";
import { collectEvidence, newEvidence, applyMessage, finalizeEvidence } from "./evidence.js";

/** 合成一段典型的 Claude 消息流：Edit 一个文件 → Bash 跑通 → Bash 跑挂。 */
const messages = [
  { type: "system", subtype: "init", model: "claude-sonnet-4-6" },
  { type: "assistant", message: { content: [{ type: "text", text: "我来改" }, { type: "tool_use", id: "t1", name: "Edit", input: { file_path: "src/a.ts" } }] } },
  { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "edited", is_error: false }] } },
  { type: "assistant", message: { content: [{ type: "tool_use", id: "t2", name: "Bash", input: { command: "npm test" } }] } },
  { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t2", content: "2 passed, 0 failed", is_error: false }] } },
  { type: "assistant", message: { content: [{ type: "tool_use", id: "t3", name: "Bash", input: { command: "npm run typecheck" } }] } },
  { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t3", content: "TS2322 error", is_error: true }] } },
  { type: "result", subtype: "success", result: "{}" },
];

test("collectEvidence 聚合改动文件与 bash 结果", () => {
  const ev = collectEvidence(messages);
  assert.deepEqual(ev.filesTouched, ["src/a.ts"]);
  assert.equal(ev.toolCalls.length, 3);
  assert.equal(ev.toolCalls[0].tool, "Edit");
  assert.equal(ev.toolCalls[0].ok, true);
  assert.equal(ev.bashRuns.length, 2);
  assert.deepEqual(ev.bashRuns[0], { command: "npm test", ok: true, output: "2 passed, 0 failed" });
  assert.equal(ev.bashRuns[1].command, "npm run typecheck");
  assert.equal(ev.bashRuns[1].ok, false); // is_error → 失败，戳穿"自报通过"
});

test("tool_result 缺失时 ok 维持 null（不臆测成功）", () => {
  const acc = newEvidence();
  applyMessage(acc, { type: "assistant", message: { content: [{ type: "tool_use", id: "x", name: "Bash", input: { command: "sleep 1" } }] } });
  const ev = finalizeEvidence(acc);
  assert.equal(ev.bashRuns[0].ok, null);
  assert.equal(ev.toolCalls[0].ok, null);
});

test("content 在顶层（非 message.content）也能解析", () => {
  const ev = collectEvidence([
    { type: "assistant", content: [{ type: "tool_use", id: "w", name: "Write", input: { file_path: "x/y.ts" } }] },
    { type: "user", content: [{ type: "tool_result", tool_use_id: "w", content: "ok", is_error: false }] },
  ]);
  assert.deepEqual(ev.filesTouched, ["x/y.ts"]);
  assert.equal(ev.toolCalls[0].ok, true);
});

test("空/异形消息不崩，降级为空证据", () => {
  const ev = collectEvidence([{}, { type: "assistant" }, { type: "user", message: {} }, null]);
  assert.deepEqual(ev.filesTouched, []);
  assert.deepEqual(ev.toolCalls, []);
  assert.deepEqual(ev.bashRuns, []);
});
