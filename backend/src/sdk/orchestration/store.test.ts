import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryNodeRunStore, JsonlNodeRunStore } from "./store.js";
import { runPipeline } from "./pipeline.js";
import { makeMockSender, makeMockActSender } from "./mock.js";
import { persistHook } from "./hooks.js";
import type { NodeRunRecord } from "./node.js";

function rec(over: Partial<NodeRunRecord>): NodeRunRecord {
  return {
    id: "id",
    nodeId: "n",
    kind: "producer",
    inputDigest: "d",
    outputSummary: "s",
    status: "ok",
    durationMs: 1,
    createdAt: "t",
    ...over,
  };
}

describe("InMemoryNodeRunStore", () => {
  it("append/list 往返 + 按 loopId/nodeId/limit 过滤", async () => {
    const s = new InMemoryNodeRunStore();
    await s.append(rec({ id: "1", nodeId: "a", loopId: "L1" }));
    await s.append(rec({ id: "2", nodeId: "b", loopId: "L1" }));
    await s.append(rec({ id: "3", nodeId: "a", loopId: "L2" }));
    assert.equal((await s.list()).length, 3);
    assert.equal((await s.list({ loopId: "L1" })).length, 2);
    assert.equal((await s.list({ nodeId: "a" })).length, 2);
    assert.deepEqual((await s.list({ limit: 1 })).map((r) => r.id), ["3"]); // 最近 1 条
  });
});

describe("JsonlNodeRunStore", () => {
  it("落盘后跨实例读回（可审计 / 跨重启留存）", async () => {
    const dir = mkdtempSync(join(tmpdir(), "runstore-"));
    try {
      const file = join(dir, "node-runs.jsonl");
      const w = new JsonlNodeRunStore(file);
      await w.append(rec({ id: "1", loopId: "L1" }));
      await w.append(rec({ id: "2", loopId: "L1" }));
      const r = new JsonlNodeRunStore(file); // 新实例读同一文件
      const all = await r.list();
      assert.deepEqual(all.map((x) => x.id), ["1", "2"]);
      assert.equal((await r.list({ loopId: "L1" })).length, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("文件不存在 → 空时间线（不抛）", async () => {
    const dir = mkdtempSync(join(tmpdir(), "runstore-empty-"));
    try {
      const r = new JsonlNodeRunStore(join(dir, "does-not-exist.jsonl"));
      assert.deepEqual(await r.list(), []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("落盘审计 · 端到端（pipeline → persistHook → JSONL）", () => {
  it("真跑路径的等价物：mock pipeline 落成可读、可跨实例读回的时间线", async () => {
    const dir = mkdtempSync(join(tmpdir(), "runstore-e2e-"));
    try {
      const file = join(dir, "node-runs.jsonl");
      const store = new JsonlNodeRunStore(file);
      const mock = makeMockSender();
      await runPipeline(
        { requirement: "给后台加 RBAC", goal: "越权被拦" },
        { send: mock, act: makeMockActSender(mock), summarize: mock, providerId: "claude-agent", hooks: [persistHook(store)] },
      );
      const records = await store.list();
      assert.ok(records.length > 0, "应落下时间线");
      assert.ok(records.some((x) => x.nodeId === "difficulty-assessor"), "含难度节点");
      assert.ok(records.some((x) => x.nodeId === "dev-step"), "含开发节点");
      assert.ok(records.some((x) => x.kind === "evaluator" && x.verdict), "评审记录带 verdict");
      // 真落盘：新实例读同一文件条数一致
      assert.equal((await new JsonlNodeRunStore(file).list()).length, records.length);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
