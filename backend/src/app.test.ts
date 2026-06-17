import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApp } from "./app.js";

/**
 * API 集成测试：起真实 express app（随机端口），用 fetch 打端点。
 * 刻意只覆盖 hermetic 路径——只读、错误分支、dryRun 全流程；
 * 不测 SK 写/删（会动到真实凭据）与 /api/models 实时分支（会联网耗额度），那些在单元层覆盖。
 */
let server: Server;
let base = "";

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  server?.close();
});

describe("API 路由", () => {
  it("GET /api/health → 200 ok", async () => {
    const r = await fetch(`${base}/api/health`);
    assert.equal(r.status, 200);
    const j = (await r.json()) as { ok: boolean };
    assert.equal(j.ok, true);
  });

  it("GET /api/config/providers → claude-agent supported，cursor 已冻结", async () => {
    const j = (await (await fetch(`${base}/api/config/providers`)).json()) as {
      providers: Array<{ id: string; supported: boolean }>;
    };
    assert.ok(j.providers.find((p) => p.id === "claude-agent")?.supported);
    assert.equal(j.providers.find((p) => p.id === "cursor")?.supported, false);
  });

  it("GET /api/config/sk?provider=cursor → 200，带 configured 字段（只读）", async () => {
    const r = await fetch(`${base}/api/config/sk?provider=cursor`);
    assert.equal(r.status, 200);
    const j = (await r.json()) as { configured: boolean };
    assert.equal(typeof j.configured, "boolean");
  });

  it("GET /api/config/sk?provider=openai → 400 unsupported", async () => {
    const r = await fetch(`${base}/api/config/sk?provider=openai`);
    assert.equal(r.status, 400);
  });

  it("POST /api/run/pipeline (dryRun) → 拆出 N≥3，developed=N", async () => {
    const r = await fetch(`${base}/api/run/pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirement: "评估权限系统", goal: "推进", dryRun: true }),
    });
    assert.equal(r.status, 200);
    const j = (await r.json()) as {
      dryRun: boolean;
      difficulty: { value: string };
      decompose: { status: string; subtasks: unknown[] };
      developed: number;
    };
    assert.equal(j.dryRun, true);
    assert.equal(j.difficulty.value, "medium");
    assert.equal(j.decompose.status, "converged");
    assert.ok(j.decompose.subtasks.length >= 3);
    assert.equal(j.developed, j.decompose.subtasks.length);
  });

  it("POST /api/run/pipeline 缺 goal → 400", async () => {
    const r = await fetch(`${base}/api/run/pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirement: "x" }),
    });
    assert.equal(r.status, 400);
  });

  it("未知路由 → 404", async () => {
    assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  });
});
