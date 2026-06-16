import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getProvider, listProviderInfos } from "./registry.js";

describe("registry", () => {
  it("getProvider cursor / claude-agent 都注册了且可 send", () => {
    assert.equal(typeof getProvider("cursor")?.send, "function");
    assert.equal(typeof getProvider("claude-agent")?.send, "function");
  });
  it("getProvider 未知 → undefined", () => {
    assert.equal(getProvider("nope"), undefined);
  });
  it("listProviderInfos：cursor + claude-agent supported，openai 仍 coming soon", () => {
    const infos = listProviderInfos();
    assert.equal(infos.find((i) => i.id === "cursor")?.supported, true);
    assert.equal(infos.find((i) => i.id === "claude-agent")?.supported, true);
    assert.ok(infos.some((i) => i.id === "openai" && !i.supported));
  });
});
