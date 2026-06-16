import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { persistHook, logHook } from "./hooks.js";
import type { EvaluatorVerdict, NodeOutputEvent, NodeRunRecord, NodeRunStore } from "./node.js";

function memStore() {
  const records: NodeRunRecord[] = [];
  const store: NodeRunStore = {
    async append(r) {
      records.push(r);
    },
    async list() {
      return records;
    },
  };
  return { store, records };
}

function outEvt(over: Partial<NodeOutputEvent<unknown, unknown>> = {}): NodeOutputEvent<unknown, unknown> {
  return {
    nodeId: "n",
    kind: "producer",
    ctx: { loopId: "L", iteration: 2 },
    input: { a: 1 },
    result: { nodeId: "n", kind: "producer", status: "ok", repairs: 0, durationMs: 10, summary: "s", output: { x: 1 } },
    ...over,
  };
}

const verdict: EvaluatorVerdict = {
  completion: { done: true, evidence: "e" },
  deviation: { score: 0.1, reason: "r" },
  pass: true,
  requiredFixes: [],
};

describe("persistHook", () => {
  it("产出节点：落库摘要，verdict/decision 为空", async () => {
    const { store, records } = memStore();
    await persistHook(store).onOutput!(outEvt());
    assert.equal(records.length, 1);
    const r = records[0];
    assert.equal(r.nodeId, "n");
    assert.equal(r.loopId, "L");
    assert.equal(r.iteration, 2);
    assert.equal(r.outputSummary, "s");
    assert.equal(r.verdict, undefined);
    assert.equal(r.decision, undefined);
    assert.ok(r.inputDigest.includes("a"));
    assert.ok(r.id.length > 0);
    assert.ok(r.createdAt.length > 0);
  });

  it("评审节点：output 落进 verdict", async () => {
    const { store, records } = memStore();
    await persistHook(store).onOutput!(
      outEvt({
        kind: "evaluator",
        result: { nodeId: "e", kind: "evaluator", status: "ok", repairs: 0, durationMs: 1, output: verdict },
      }),
    );
    assert.deepEqual(records[0].verdict, verdict);
  });

  it("无 summary 时记 (无总结)", async () => {
    const { store, records } = memStore();
    await persistHook(store).onOutput!(
      outEvt({ result: { nodeId: "n", kind: "producer", status: "ok", repairs: 0, durationMs: 1 } }),
    );
    assert.equal(records[0].outputSummary, "(无总结)");
  });

  it("超长入参摘要被截断并加省略号", async () => {
    const { store, records } = memStore();
    await persistHook(store).onOutput!(outEvt({ input: "x".repeat(1000) }));
    assert.ok(records[0].inputDigest.length <= 281);
    assert.ok(records[0].inputDigest.endsWith("…"));
  });
});

describe("logHook", () => {
  it("onInput/onOutput 不抛错", () => {
    const h = logHook();
    assert.doesNotThrow(() => {
      h.onInput?.({ nodeId: "n", kind: "producer", ctx: {}, input: {}, prompt: { static: "", dynamic: "" } });
      h.onOutput?.(outEvt());
    });
  });
});
