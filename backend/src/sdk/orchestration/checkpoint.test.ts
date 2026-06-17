import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runPipeline } from "./pipeline.js";
import { makeMockSender } from "./mock.js";
import { hashInput, type CheckpointStore, type RunManifest, type StepCheckpoint } from "./checkpoint.js";
import type { Sender, SendRequest } from "./run.js";

/** 内存版 CheckpointStore，供测试。 */
function memCheckpointStore(): CheckpointStore & { steps: Map<string, StepCheckpoint> } {
  const steps = new Map<string, StepCheckpoint>();
  const manifests = new Map<string, RunManifest>();
  const key = (runId: string, stepKey: string) => `${runId}::${stepKey}`;
  return {
    steps,
    async loadRun(runId) {
      const m = manifests.get(runId);
      if (!m) return undefined;
      const s: Record<string, StepCheckpoint> = {};
      for (const [k, v] of steps) {
        if (k.startsWith(`${runId}::`)) s[v.stepKey] = v;
      }
      return { manifest: m, steps: s };
    },
    async saveManifest(manifest) {
      manifests.set(manifest.runId, manifest);
    },
    async getStep(runId, stepKey) {
      return steps.get(key(runId, stepKey));
    },
    async putStep(runId, step) {
      steps.set(key(runId, step.stepKey), step);
    },
    async listRuns() {
      return [...manifests.values()];
    },
  };
}

describe("pipeline checkpoint 断点续跑", () => {
  it("同 runId 第二次运行命中缓存，跳过全部模型调用且结果一致", async () => {
    const store = memCheckpointStore();
    const runId = "run_test_1";

    // 注意：makeMockSender 是有状态的（按调用顺序驱动 loop 收敛），
    // 必须复用同一个实例再包计数，否则每次 new 会重置状态导致 loop 不收敛。
    const mock1 = makeMockSender();
    let calls1 = 0;
    const counting1: Sender = async (req: SendRequest) => {
      calls1++;
      return mock1(req);
    };
    const r1 = await runPipeline(
      { requirement: "评估权限系统", goal: "推进" },
      { send: counting1, summarize: counting1, providerId: "cursor", checkpoint: { store, runId } },
    );
    assert.ok(calls1 > 0, "首跑应有模型调用");
    assert.ok(store.steps.size > 0, "应落下 checkpoint");

    // 第二次：同 runId，应全部命中缓存
    const mock2 = makeMockSender();
    let calls2 = 0;
    const counting2: Sender = async (req: SendRequest) => {
      calls2++;
      return mock2(req);
    };
    const r2 = await runPipeline(
      { requirement: "评估权限系统", goal: "推进" },
      { send: counting2, summarize: counting2, providerId: "cursor", checkpoint: { store, runId } },
    );
    assert.equal(calls2, 0, "续跑应跳过全部模型调用");
    assert.equal(r2.developed, r1.developed);
    assert.equal(r2.decompose.subtasks.length, r1.decompose.subtasks.length);
    assert.deepEqual(r2.todos.map((t) => t.status), r1.todos.map((t) => t.status));
  });

  it("失败步骤落 failed，续跑时重算（runNode 吞异常→靠 status 判定成败）", async () => {
    const store = memCheckpointStore();
    const runId = "run_test_2";
    // 让首个 send（assess 节点）抛错；runNode 会吞掉异常并回 status=error
    let first = true;
    const flaky: Sender = async (req: SendRequest) => {
      if (first) {
        first = false;
        throw new Error("模拟网络失败");
      }
      return makeMockSender()(req);
    };
    await runPipeline(
      { requirement: "x", goal: "y" },
      { send: flaky, summarize: flaky, providerId: "cursor", checkpoint: { store, runId } },
    );
    // assess 因 send 失败，status=error → 落 failed，不存 value
    const assessCp = await store.getStep(runId, "assess");
    assert.equal(assessCp?.status, "failed");
    assert.equal(assessCp?.value, undefined);

    // 续跑：assess 重跑成功，整条收敛
    const r = await runPipeline(
      { requirement: "x", goal: "y" },
      { send: makeMockSender(), summarize: makeMockSender(), providerId: "cursor", checkpoint: { store, runId } },
    );
    assert.equal((await store.getStep(runId, "assess"))?.status, "ok");
    assert.ok(r.decompose.subtasks.length >= 3);
  });

  it("inputHash 变化使缓存失效", async () => {
    const store = memCheckpointStore();
    const runId = "run_test_3";
    await runPipeline(
      { requirement: "需求A", goal: "目标A" },
      { send: makeMockSender(), summarize: makeMockSender(), providerId: "cursor", checkpoint: { store, runId } },
    );
    const before = (await store.getStep(runId, "assess"))!.inputHash;
    assert.equal(before, hashInput({ task: "需求A", goal: "目标A" }));

    const mock = makeMockSender();
    let calls = 0;
    const counting: Sender = async (req: SendRequest) => {
      calls++;
      return mock(req);
    };
    // 换需求 → assess 的 inputHash 变了 → 必须重跑
    await runPipeline(
      { requirement: "需求B", goal: "目标A" },
      { send: counting, summarize: counting, providerId: "cursor", checkpoint: { store, runId } },
    );
    assert.ok(calls > 0, "输入变化应触发重算");
    assert.equal((await store.getStep(runId, "assess"))!.inputHash, hashInput({ task: "需求B", goal: "目标A" }));
  });
});
