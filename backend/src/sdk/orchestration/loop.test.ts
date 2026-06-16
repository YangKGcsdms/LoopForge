import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runLoop, type LoopSpec } from "./loop.js";
import { defineContract, type ContractResult } from "./contract.js";
import { verdictContract } from "./nodes/contracts.js";
import type { EvaluatorNode, EvaluatorVerdict, NodeTemplate } from "./node.js";
import type { Sender } from "./run.js";

interface POut {
  quality: number;
}
const pContract = defineContract<POut>({
  name: "p",
  schema: "{ quality: number }",
  validate(data): ContractResult<POut> {
    const d = data as Partial<POut>;
    return typeof d.quality === "number" ? { ok: true, value: d as POut } : { ok: false, errors: ["quality"] };
  },
});

const producer: NodeTemplate<{ goal: string }, POut> = {
  id: "prod",
  kind: "producer",
  role: "producer-role",
  output: pContract,
  render: (i) => ({ static: "", dynamic: i.goal }),
};
const evaluator: EvaluatorNode<POut> = {
  id: "eval",
  kind: "evaluator",
  role: "evaluator-role",
  output: verdictContract,
  render: (i) => ({ static: "", dynamic: String(i.quality) }),
};

function spec(maxIterations = 4): LoopSpec<{ goal: string }, POut, POut> {
  return { id: "loop", producer, evaluator, toEvalInput: (o) => o, maxIterations };
}

function verdict(pass: boolean): string {
  const v: EvaluatorVerdict = {
    completion: { done: pass, evidence: "" },
    deviation: { score: pass ? 0.1 : 0.9, reason: "" },
    pass,
    requiredFixes: pass ? [] : ["fix"],
  };
  return JSON.stringify(v);
}

/** 评审在第 passOn 轮（含）起通过。 */
function convergingSender(passOn: number): Sender {
  let prod = 0;
  return async (req) => {
    if (req.system.includes("evaluator-role")) {
      return { result: verdict(prod >= passOn), durationMs: 1 };
    }
    prod++;
    return { result: JSON.stringify({ quality: prod }), durationMs: 1 };
  };
}

describe("runLoop", () => {
  it("第一轮就通过 → converged，iterations 1", async () => {
    const r = await runLoop(spec(), { goal: "g" }, {}, { send: convergingSender(1) });
    assert.equal(r.status, "converged");
    assert.equal(r.iterations, 1);
  });

  it("第一轮打回、第二轮通过 → converged，iterations 2", async () => {
    const r = await runLoop(spec(), { goal: "g" }, {}, { send: convergingSender(2) });
    assert.equal(r.status, "converged");
    assert.equal(r.iterations, 2);
    assert.equal(r.history[0].reviewed.output?.pass, false);
    assert.equal(r.history[1].reviewed.output?.pass, true);
  });

  it("始终不收敛 → max_iterations", async () => {
    const r = await runLoop(spec(3), { goal: "g" }, {}, { send: convergingSender(99) });
    assert.equal(r.status, "max_iterations");
    assert.equal(r.iterations, 3);
  });

  it("闸门 block → blocked，立即停", async () => {
    const blockGate = () => ({ action: "block" as const, reason: "" });
    const r = await runLoop({ ...spec(), gate: blockGate }, { goal: "g" }, {}, { send: convergingSender(99) });
    assert.equal(r.status, "blocked");
    assert.equal(r.iterations, 1);
  });

  it("产出节点持续失败 → error", async () => {
    const badSender: Sender = async (req) =>
      req.system.includes("evaluator-role")
        ? { result: verdict(true), durationMs: 1 }
        : { result: "不是 JSON", durationMs: 1 };
    const r = await runLoop(spec(), { goal: "g" }, {}, { send: badSender });
    assert.equal(r.status, "error");
  });

  it("矫正：上一轮 verdict 通过 priorVerdict 喂回产出节点", async () => {
    let sawPriorOnSecond = false;
    let prod = 0;
    const send: Sender = async (req) => {
      if (req.system.includes("evaluator-role")) {
        return { result: verdict(prod >= 2), durationMs: 1 };
      }
      prod++;
      if (prod === 2 && req.user.includes("PRIOR")) sawPriorOnSecond = true;
      return { result: JSON.stringify({ quality: prod }), durationMs: 1 };
    };
    const echoProducer: NodeTemplate<{ goal: string }, POut> = {
      ...producer,
      render: (i, c) => ({ static: "", dynamic: c.priorVerdict ? "PRIOR" : i.goal }),
    };
    const r = await runLoop(
      { id: "loop", producer: echoProducer, evaluator, toEvalInput: (o) => o, maxIterations: 4 },
      { goal: "g" },
      {},
      { send },
    );
    assert.equal(r.status, "converged");
    assert.equal(r.iterations, 2);
    assert.equal(sawPriorOnSecond, true);
  });
});
