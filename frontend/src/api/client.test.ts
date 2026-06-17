import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { api } from "./client.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function mockFetch(impl: typeof fetch) {
  globalThis.fetch = impl;
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("api client", () => {
  it("getModels：GET 正确路径", async () => {
    let url = "";
    mockFetch(async (u) => {
      url = String(u);
      return json({ source: "fallback", models: [] });
    });
    const r = await api.getModels();
    assert.match(url, /\/api\/models\?provider=claude-agent/);
    assert.equal(r.source, "fallback");
  });

  it("saveSk：PUT 带 provider+apiKey", async () => {
    let method = "";
    let body = "";
    mockFetch(async (_u, init) => {
      method = String(init?.method);
      body = String(init?.body);
      return json({ ok: true, provider: "cursor", configured: true });
    });
    await api.saveSk("cursor", "k123");
    assert.equal(method, "PUT");
    assert.ok(body.includes("cursor"));
    assert.ok(body.includes("k123"));
  });

  it("runPipeline：POST 命中 /api/run/pipeline", async () => {
    let url = "";
    let method = "";
    mockFetch(async (u, init) => {
      url = String(u);
      method = String(init?.method);
      return json({ dryRun: true, difficulty: { value: "medium", reason: null }, routedModels: { producer: { id: "x" }, evaluator: { id: "y" } }, decompose: { status: "converged", iterations: 2, subtasks: [] }, todos: [], developed: 0 });
    });
    await api.runPipeline({ requirement: "r", goal: "g" });
    assert.match(url, /\/api\/run\/pipeline$/);
    assert.equal(method, "POST");
  });

  it("非 2xx：抛错且带后端 message", async () => {
    mockFetch(async () => json({ message: "boom" }, 400));
    await assert.rejects(() => api.getModels(), /boom/);
  });
});
