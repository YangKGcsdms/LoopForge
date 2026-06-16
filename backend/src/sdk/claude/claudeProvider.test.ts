import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ClaudeAgentProvider } from "./claudeProvider.js";

const p = new ClaudeAgentProvider();

describe("ClaudeAgentProvider", () => {
  it("info() = claude-agent supported", () => {
    assert.deepEqual(p.info(), { id: "claude-agent", displayName: "Claude Agent SDK", supported: true });
  });

  // validateCredential 现在会真探测（发请求）→ 放进 live.itest.ts，不在 hermetic 测里调。

  it("listModels 返回 Claude 别名目录（带版本 displayName，不联网）", async () => {
    const models = await p.listModels("");
    const ids = models.map((m) => m.id);
    assert.ok(ids.includes("claude-opus-4-8") && ids.includes("claude-sonnet-4-6") && ids.includes("claude-haiku-4-5"));
    assert.equal(models.find((m) => m.id === "claude-opus-4-8")?.displayName, "Claude Opus 4.8");
  });
});
