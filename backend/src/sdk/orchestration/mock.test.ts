import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeMockSender, makeMockActSender } from "./mock.js";

async function call(send: ReturnType<typeof makeMockSender>, system: string, user = "") {
  return JSON.parse((await send({ system, user })).result);
}

describe("makeMockSender 角色识别", () => {
  it("难度评估 → medium", async () => {
    const s = makeMockSender();
    assert.equal((await call(s, "你是技术评估员，做开发任务的难度评估。")).difficulty, "medium");
  });
  it("用一句话总结 → 返回纯文本（非 JSON）", async () => {
    const s = makeMockSender();
    const r = await s({ system: "用一句话（不超过 30 字）总结…", user: "" });
    assert.ok(typeof r.result === "string");
    assert.throws(() => JSON.parse(r.result));
  });
});

describe("makeMockSender 拆解收敛", () => {
  it("首轮粗(1 项)→评审打回；次轮细(≥3 项)→评审通过", async () => {
    const s = makeMockSender();
    const p1 = await call(s, "你是资深技术负责人，把需求拆成可执行的子任务。");
    assert.equal(p1.subtasks.length, 1);
    assert.equal((await call(s, "你是评审员，判断需求拆解是否已收敛")).pass, false);
    const p2 = await call(s, "你是资深技术负责人，把需求拆成可执行的子任务。");
    assert.ok(p2.subtasks.length >= 3);
    assert.ok(p2.subtasks.every((t: { estimateHours: number }) => t.estimateHours <= 5));
    assert.equal((await call(s, "你是评审员，判断需求拆解是否已收敛")).pass, true);
  });
});

describe("makeMockSender 开发小 loop 带矫正", () => {
  it("同一任务：开发评审首轮打回、次轮通过（按 taskId 计数）", async () => {
    const s = makeMockSender();
    const a = await call(s, "你是严格的代码评审员", '{"id":"T3","title":"x"}');
    assert.equal(a.pass, false);
    assert.ok(a.requiredFixes.length > 0);
    const b = await call(s, "你是严格的代码评审员", '{"id":"T3","title":"x"}');
    assert.equal(b.pass, true);
  });

  it("不同任务各自独立计数", async () => {
    const s = makeMockSender();
    assert.equal((await call(s, "你是严格的代码评审员", '{"id":"T1"}')).pass, false);
    assert.equal((await call(s, "你是严格的代码评审员", '{"id":"T2"}')).pass, false);
  });

  it("devStep：初版测试没全过；见到“评审要求修复”出修复版且 taskId 正确（无 T?）", async () => {
    const s = makeMockSender();
    const init = await call(s, "你是开发工程师，实现给定子任务并自检。", "子任务[T2]：x\n验收标准：y");
    assert.equal(init.taskId, "T2");
    assert.equal(init.testsRun.failed, 2);
    const fix = await call(
      s,
      "你是开发工程师，实现给定子任务并自检。",
      "子任务[T2]：x\n上一轮评审要求修复：\n补用例",
    );
    assert.equal(fix.taskId, "T2");
    assert.equal(fix.testsRun.failed, 0);
  });
});

describe("makeMockActSender", () => {
  it("套 mock send、回填空证据，仍识别 devStep 角色", async () => {
    const act = makeMockActSender(makeMockSender());
    const r = await act({ system: "你是开发工程师，实现给定子任务并自检。", user: "子任务[T1]：x\n验收标准：y", cwd: "/w" });
    assert.equal(JSON.parse(r.result).taskId, "T1");
    assert.deepEqual(r.evidence, { toolCalls: [], filesTouched: [], bashRuns: [] });
  });
});
