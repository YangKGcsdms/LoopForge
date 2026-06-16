import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ClaudeAgentProvider } from "./claudeProvider.js";

const p = new ClaudeAgentProvider();

describe("ClaudeAgentProvider", () => {
  it("info() = claude-agent supported", () => {
    assert.deepEqual(p.info(), { id: "claude-agent", displayName: "Claude Agent SDK", supported: true });
  });

  it("validateCredential：SDK 已装 → 就绪（不联网探测，key 运行时验证）", async () => {
    const r = await p.validateCredential("sk-ant-xxx");
    assert.equal(r.valid, true);
    assert.match(r.detail, /就绪/);
  });

  it("listModels 返回 Claude 别名目录（带版本 displayName，不联网）", async () => {
    const models = await p.listModels("");
    const ids = models.map((m) => m.id);
    assert.ok(ids.includes("opus") && ids.includes("sonnet") && ids.includes("haiku"));
    assert.equal(models.find((m) => m.id === "opus")?.displayName, "Claude Opus 4.8");
  });
});
