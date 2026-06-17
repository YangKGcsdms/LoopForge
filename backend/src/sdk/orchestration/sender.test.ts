import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { providerSender, providerActSender } from "./sender.js";
import type { SdkProvider } from "../provider.js";
import type { AgentActOptions, AgentSendOptions, ToolApprover } from "../types.js";

describe("providerSender", () => {
  it("合并 system+user 成单条 prompt，透传 cwd/model/apiKey，回填结果", async () => {
    let captured: AgentSendOptions | undefined;
    const provider: Pick<SdkProvider, "send"> = {
      async send(o) {
        captured = o;
        return { result: "R", durationMs: 5, requestId: "rid", model: "m-real" };
      },
    };
    const sender = providerSender(provider, "key", { defaultCwd: "/d" });
    const res = await sender({ system: "S", user: "U", cwd: "/c", model: { id: "mm" }, mode: "agent" });

    assert.equal(captured?.prompt, "S\n\nU");
    assert.equal(captured?.cwd, "/c");
    assert.equal(captured?.apiKey, "key");
    assert.deepEqual(captured?.model, { id: "mm" });
    assert.equal(res.result, "R");
    assert.equal(res.requestId, "rid");
    assert.deepEqual(res.model, { id: "m-real" });
  });

  it("无 cwd 时回退 defaultCwd", async () => {
    let captured: AgentSendOptions | undefined;
    const provider: Pick<SdkProvider, "send"> = {
      async send(o) {
        captured = o;
        return { result: "", durationMs: 1 };
      },
    };
    await providerSender(provider, "k", { defaultCwd: "/def" })({ system: "", user: "U" });
    assert.equal(captured?.cwd, "/def");
  });

  it("provider 没回模型时，回退到请求里的 model", async () => {
    const provider: Pick<SdkProvider, "send"> = {
      async send() {
        return { result: "", durationMs: 1 };
      },
    };
    const res = await providerSender(provider, "k")({ system: "", user: "", model: { id: "req-model" } });
    assert.deepEqual(res.model, { id: "req-model" });
  });

  it("think-sender 强制 readOnly=true 且不带 approve（think 只读、永不审批）", async () => {
    let captured: AgentSendOptions | undefined;
    const provider: Pick<SdkProvider, "send"> = {
      async send(o) {
        captured = o;
        return { result: "", durationMs: 1 };
      },
    };
    await providerSender(provider, "k")({ system: "S", user: "U" });
    assert.equal(captured?.readOnly, true);
    assert.equal(captured?.approve, undefined);
  });
});

describe("providerActSender", () => {
  it("调 provider.act，绑 approve/allowedTools，回填 evidence", async () => {
    let captured: AgentActOptions | undefined;
    const approve: ToolApprover = async () => ({ allow: true });
    const provider: Pick<SdkProvider, "send" | "act"> = {
      async send() {
        return { result: "", durationMs: 1 };
      },
      async act(o) {
        captured = o;
        return {
          result: "R",
          durationMs: 2,
          evidence: { toolCalls: [{ tool: "Bash", input: {}, ok: true }], filesTouched: ["x.ts"], bashRuns: [] },
        };
      },
    };
    const r = await providerActSender(provider, "k", { allowedTools: ["Read"], approve })({ system: "S", user: "U", cwd: "/c" });
    assert.equal(captured?.cwd, "/c");
    assert.deepEqual(captured?.allowedTools, ["Read"]);
    assert.equal(typeof captured?.approve, "function");
    assert.deepEqual(r.evidence.filesTouched, ["x.ts"]);
    assert.equal(r.result, "R");
  });

  it("provider 没实现 act → 降级走 send，evidence 为空", async () => {
    let sendCalled = false;
    const provider: Pick<SdkProvider, "send" | "act"> = {
      async send() {
        sendCalled = true;
        return { result: "R", durationMs: 1 };
      },
    };
    const r = await providerActSender(provider, "k")({ system: "", user: "U", cwd: "/c" });
    assert.equal(sendCalled, true);
    assert.deepEqual(r.evidence, { toolCalls: [], filesTouched: [], bashRuns: [] });
  });
});
