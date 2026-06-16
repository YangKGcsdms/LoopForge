import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { useRun } from "../useRun";

describe("useRun composable", () => {
  it("初始化：所有状态都是空/false", () => {
    const { running, error, live, difficulty, routing, finalDone } = useRun();

    assert.strictEqual(running.value, false);
    assert.strictEqual(error.value, "");
    assert.strictEqual(live.value.length, 0);
    assert.strictEqual(difficulty.value, null);
    assert.strictEqual(routing.value, null);
    assert.strictEqual(finalDone.value, null);
  });

  it("cleanup 可以安全调用（即使没有活跃的 EventSource）", () => {
    const { cleanup } = useRun();
    // 应该不抛错
    cleanup();
    assert.ok(true);
  });

  it("返回值包含所有必要的状态和方法", () => {
    const result = useRun();

    assert.ok(result.running, "应该有 running");
    assert.ok(result.error, "应该有 error");
    assert.ok(result.live, "应该有 live");
    assert.ok(result.difficulty, "应该有 difficulty");
    assert.ok(result.routing, "应该有 routing");
    assert.ok(result.finalDone, "应该有 finalDone");
    assert.ok(typeof result.startRun === "function", "应该有 startRun 方法");
    assert.ok(typeof result.cleanup === "function", "应该有 cleanup 方法");
  });

  it("startRun 重置状态", () => {
    const { running, error, live, difficulty, routing, finalDone, startRun, cleanup } = useRun();

    // 手动设置一些状态
    live.value = [{ kind: "phase", key: "p1", name: "test" }];
    error.value = "previous error";
    running.value = true;

    // Mock EventSource to prevent actual network call
    const originalEventSource = (global as any).EventSource;
    (global as any).EventSource = class {
      listeners = new Map();
      constructor(public url: string) {}
      addEventListener(event: string, handler: (e: any) => void) {
        this.listeners.set(event, handler);
      }
      close() {}
    };

    try {
      startRun({
        requirement: "test",
        goal: "test",
        provider: "cursor",
        dryRun: true,
      });

      // 状态应该被重置
      assert.strictEqual(running.value, true, "running 应该是 true（运行中）");
      assert.strictEqual(error.value, "", "error 应该被重置");
      assert.strictEqual(live.value.length, 0, "live 应该被清空");
      assert.strictEqual(difficulty.value, null, "difficulty 应该被重置");
      assert.strictEqual(routing.value, null, "routing 应该被重置");
      assert.strictEqual(finalDone.value, null, "finalDone 应该被重置");

      cleanup();
    } finally {
      // 恢复原始 EventSource
      (global as any).EventSource = originalEventSource;
    }
  });
});
