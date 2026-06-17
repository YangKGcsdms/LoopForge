import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runNode, type ActSender, type Sender, type Verifier } from "./run.js";
import { defineContract, type ContractResult } from "./contract.js";
import type { ActEvidence, NodeHook, NodeRunContext, NodeTemplate } from "./node.js";

interface Out {
  v: number;
}
const contract = defineContract<Out>({
  name: "out",
  schema: "{ v: number }",
  validate(data): ContractResult<Out> {
    const d = data as Partial<Out>;
    if (typeof d.v !== "number") return { ok: false, errors: ["v 必须是 number"] };
    return { ok: true, value: data as Out };
  },
});

const node: NodeTemplate<{ x: number }, Out> = {
  id: "t",
  kind: "producer",
  role: "role",
  output: contract,
  render: (input) => ({ static: "s", dynamic: `x=${input.x}` }),
};

const ctx: NodeRunContext = {};

/** 依次吐 results 里的字符串，最后一个用尽后重复。返回 send 与调用计数。 */
function scripted(results: string[]) {
  let i = 0;
  const send: Sender = async () => {
    const r = results[Math.min(i, results.length - 1)];
    i++;
    return { result: r, durationMs: 1 };
  };
  return { send, calls: () => i };
}

describe("runNode", () => {
  it("一次成功：status ok，repairs 0", async () => {
    const r = await runNode(node, { x: 1 }, ctx, { send: scripted(['{"v":1}']).send });
    assert.equal(r.status, "ok");
    assert.equal(r.repairs, 0);
    assert.equal(r.output?.v, 1);
  });

  it("先坏后好：触发修复重试，repairs 1", async () => {
    const s = scripted(["不是 JSON", '{"v":2}']);
    const r = await runNode(node, { x: 1 }, ctx, { send: s.send });
    assert.equal(r.status, "ok");
    assert.equal(r.repairs, 1);
    assert.equal(s.calls(), 2);
  });

  it("一直坏：repair_exhausted，重试到上限（默认 2）", async () => {
    const s = scripted(["坏"]);
    const r = await runNode(node, { x: 1 }, ctx, { send: s.send });
    assert.equal(r.status, "repair_exhausted");
    assert.equal(r.repairs, 2);
    assert.equal(s.calls(), 3);
    assert.equal(r.output, undefined);
  });

  it("maxRepairs 可配置为 0", async () => {
    const s = scripted(["坏"]);
    const r = await runNode({ ...node, maxRepairs: 0 }, { x: 1 }, ctx, { send: s.send });
    assert.equal(r.status, "repair_exhausted");
    assert.equal(s.calls(), 1);
  });

  it("sender 抛错：status error 带原因", async () => {
    const send: Sender = async () => {
      throw new Error("boom");
    };
    const r = await runNode(node, { x: 1 }, ctx, { send });
    assert.equal(r.status, "error");
    assert.match(r.error ?? "", /boom/);
  });

  it("钩子 onInput/onOutput 按序触发", async () => {
    const seen: string[] = [];
    const hook: NodeHook = {
      name: "h",
      onInput: (e) => {
        seen.push("in:" + e.nodeId);
      },
      onOutput: (e) => {
        seen.push("out:" + e.result.status);
      },
    };
    await runNode(node, { x: 1 }, ctx, { send: scripted(['{"v":1}']).send, hooks: [hook] });
    assert.deepEqual(seen, ["in:t", "out:ok"]);
  });

  it("resolveModel 覆盖节点模型", async () => {
    let usedModel: unknown;
    const send: Sender = async (req) => {
      usedModel = req.model;
      return { result: '{"v":1}', durationMs: 1 };
    };
    await runNode(node, { x: 1 }, ctx, { send, resolveModel: () => ({ id: "strong-x" }) });
    assert.deepEqual(usedModel, { id: "strong-x" });
  });

  it("summarize 仅在成功时生成 summary", async () => {
    const r = await runNode(node, { x: 1 }, ctx, {
      send: scripted(['{"v":1}']).send,
      summarize: async () => ({ result: "一句话", durationMs: 1 }),
    });
    assert.equal(r.summary, "一句话");
  });

  it("cwd 从 ctx.workspace 透传到 send", async () => {
    let usedCwd: string | undefined;
    const send: Sender = async (req) => {
      usedCwd = req.cwd;
      return { result: '{"v":1}', durationMs: 1 };
    };
    await runNode(node, { x: 1 }, { workspace: { cwd: "/tmp/x" } }, { send });
    assert.equal(usedCwd, "/tmp/x");
  });
});

const actNode: NodeTemplate<{ x: number }, Out> = { ...node, id: "act-t", exec: "act" };
const emptyEvidence: ActEvidence = { toolCalls: [], filesTouched: [], bashRuns: [] };

describe("runNode · act 分流", () => {
  it("exec=act 且有 deps.act：走 act 不走 send，evidence 挂到结果", async () => {
    const ev: ActEvidence = { toolCalls: [{ tool: "Edit", input: {}, ok: true }], filesTouched: ["a.ts"], bashRuns: [] };
    const act: ActSender = async () => ({ result: '{"v":1}', durationMs: 1, evidence: ev });
    let sendCalled = false;
    const send: Sender = async () => {
      sendCalled = true;
      return { result: "x", durationMs: 1 };
    };
    const r = await runNode(actNode, { x: 1 }, { workspace: { cwd: "/w" } }, { send, act });
    assert.equal(r.status, "ok");
    assert.deepEqual(r.evidence?.filesTouched, ["a.ts"]);
    assert.equal(sendCalled, false);
  });

  it("act 节点把内部流式事件挂上节点上下文转给 deps.onActMessage", async () => {
    const act: ActSender = async (req) => {
      req.onMessage?.({ kind: "tool_use", tool: "Bash", input: { command: "ls" } });
      req.onMessage?.({ kind: "tool_result", ok: true, preview: "out" });
      return { result: '{"v":1}', durationMs: 1, evidence: emptyEvidence };
    };
    const seen: Array<{ nodeId: string; iteration?: number; event: { kind: string } }> = [];
    await runNode(
      actNode,
      { x: 1 },
      { workspace: { cwd: "/w" }, iteration: 2 },
      { send: scripted(['{"v":1}']).send, act, onActMessage: (i) => seen.push(i) },
    );
    assert.equal(seen.length, 2);
    assert.equal(seen[0].nodeId, "act-t");
    assert.equal(seen[0].iteration, 2);
    assert.equal(seen[0].event.kind, "tool_use");
    assert.equal(seen[1].event.kind, "tool_result");
  });

  it("think 节点不转发流式（deps.act 才有 onMessage）", async () => {
    const seen: unknown[] = [];
    await runNode(node, { x: 1 }, ctx, { send: scripted(['{"v":1}']).send, onActMessage: (i) => seen.push(i) });
    assert.equal(seen.length, 0);
  });

  it("act 成功后调 deps.verify(cwd)，verification 挂到结果", async () => {
    const act: ActSender = async () => ({ result: '{"v":1}', durationMs: 1, evidence: emptyEvidence });
    let verifiedCwd = "";
    const verify: Verifier = async (cwd) => {
      verifiedCwd = cwd;
      return { filesChanged: ["a.ts"], diffStat: "1 file", checks: [], testsPass: null };
    };
    const r = await runNode(actNode, { x: 1 }, { workspace: { cwd: "/w" } }, { send: scripted(['{"v":1}']).send, act, verify });
    assert.equal(verifiedCwd, "/w");
    assert.deepEqual(r.verification?.filesChanged, ["a.ts"]);
  });

  it("exec=act 但无 deps.act：降级走 send（不崩、无证据）", async () => {
    const s = scripted(['{"v":1}']);
    const r = await runNode(actNode, { x: 1 }, ctx, { send: s.send });
    assert.equal(r.status, "ok");
    assert.equal(s.calls(), 1); // 确实走了 send
    assert.equal(r.evidence, undefined);
    assert.equal(r.verification, undefined);
  });

  it("act 产出不过契约：不调 verify（没成功就没有地面真值可校）", async () => {
    const act: ActSender = async () => ({ result: "坏", durationMs: 1, evidence: emptyEvidence });
    let verifyCalled = false;
    const verify: Verifier = async () => {
      verifyCalled = true;
      return { filesChanged: [], diffStat: "", checks: [], testsPass: null };
    };
    const r = await runNode({ ...actNode, maxRepairs: 0 }, { x: 1 }, { workspace: { cwd: "/w" } }, { send: scripted(['{"v":1}']).send, act, verify });
    assert.equal(r.status, "repair_exhausted");
    assert.equal(verifyCalled, false);
  });
});
