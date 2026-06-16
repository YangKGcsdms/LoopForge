import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runPipeline } from "./pipeline.js";
import { makeMockSender } from "./mock.js";
import { persistHook } from "./hooks.js";
import type { NodeRunRecord, NodeRunStore } from "./node.js";

describe("runPipeline 集成（mock sender）", () => {
  it("难度 → 拆解出 N(≥3) 个 3~5h 任务 → 每个 TODO 自循环开发(带矫正) → 全收敛", async () => {
    const events: Array<[string, unknown]> = [];
    const mock = makeMockSender();
    const r = await runPipeline(
      { requirement: "评估权限系统", goal: "推进" },
      { send: mock, summarize: mock, providerId: "cursor", onEvent: (e, d) => events.push([e, d]) },
    );

    // 拆解收敛、N≥3、每个 ≤5 工时
    assert.equal(r.decompose.status, "converged");
    assert.ok(r.decompose.subtasks.length >= 3);
    assert.ok(r.decompose.subtasks.every((t) => t.estimateHours <= 5));

    // 难度（信息）+ 按用途路由方案：出方案 opus、执行 composer、评审 sonnet、测试 kimi
    assert.equal(r.difficulty.value, "medium");
    assert.equal(r.routing.plan, "claude-opus-4-8");
    assert.equal(r.routing.execute, "composer-2.5");
    assert.equal(r.routing.review, "claude-sonnet-4-6");
    assert.equal(r.routing.test, "kimi-k2.5");

    // 强化开端：出方案先于拆解
    assert.ok(r.plan && r.plan.approach.length > 0);

    // 每个 TODO 都跑了带矫正的小 loop（2 轮）并收敛
    assert.equal(r.developed, r.decompose.subtasks.length);
    assert.ok(r.todos.every((t) => t.status === "converged"));
    assert.ok(r.todos.every((t) => t.iterations === 2));

    // 事件齐全
    assert.ok(events.some(([e]) => e === "difficulty"));
    assert.ok(events.some(([e]) => e === "routing"));
    assert.ok(events.some(([e]) => e === "todos"));
    assert.ok(events.some(([e]) => e === "done"));
    // 开发阶段头数量 = TODO 数
    const devPhases = events.filter(([e, d]) => e === "phase" && String((d as { name: string }).name).startsWith("开发："));
    assert.equal(devPhases.length, r.decompose.subtasks.length);
  });

  it("persistHook 在每个节点执行后落库（条数 = 难度1 + 拆解轮×2 + Σ开发轮×2）", async () => {
    const records: NodeRunRecord[] = [];
    const store: NodeRunStore = {
      async append(rec) {
        records.push(rec);
      },
      async list() {
        return records;
      },
    };
    const mock = makeMockSender();
    const r = await runPipeline(
      { requirement: "x", goal: "y" },
      { send: mock, summarize: mock, providerId: "cursor", hooks: [persistHook(store)] },
    );
    // 难度1 + 出方案1 + 拆解轮×2(producer+评审) + Σ开发轮×3(producer+devReviewer+红队)
    const expected = 2 + r.decompose.iterations * 2 + r.todos.reduce((a, t) => a + t.iterations * 3, 0);
    assert.equal(records.length, expected);
  });
});
