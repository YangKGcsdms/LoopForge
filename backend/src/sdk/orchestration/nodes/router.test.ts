import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  tierOf,
  catalogFromModels,
  routeModel,
  modelResolver,
  availablePool,
  purposeModel,
  purposeResolver,
  routingScheme,
  poolFor,
  MODEL_POOL,
  CLAUDE_POOL,
} from "./router.js";

describe("tierOf（与真实模型列表观察到的归类一致）", () => {
  it("opus → strong", () => assert.equal(tierOf("claude-opus-4-8"), "strong"));
  it("claude-sonnet → strong（claude 前缀）", () => assert.equal(tierOf("claude-sonnet-4-6"), "strong"));
  it("claude-haiku → cheap", () => assert.equal(tierOf("claude-haiku-4-5"), "cheap"));
  it("gpt → mid", () => assert.equal(tierOf("gpt-5.5"), "mid"));
  it("gemini → mid", () => assert.equal(tierOf("gemini-3-flash"), "mid"));
  it("composer → cheap", () => assert.equal(tierOf("composer-2.5"), "cheap"));
  it("kimi → cheap", () => assert.equal(tierOf("kimi-k2.5"), "cheap"));
});

describe("catalogFromModels", () => {
  it("按 id 归一档位，displayName 缺省回退 id", () => {
    const c = catalogFromModels([{ id: "claude-opus-4-8", displayName: "Opus" }, { id: "kimi-k2.5" }]);
    assert.equal(c[0].tier, "strong");
    assert.equal(c[0].displayName, "Opus");
    assert.equal(c[1].tier, "cheap");
    assert.equal(c[1].displayName, "kimi-k2.5");
  });
});

describe("MODEL_POOL（路由池）", () => {
  it("不含被禁用的 fable", () => {
    assert.ok(!MODEL_POOL.some((m) => m.id.includes("fable")));
  });
  it("含用户挑选的模型", () => {
    for (const id of ["composer-2.5", "kimi-k2.5", "claude-haiku-4-5", "gpt-5.5", "claude-sonnet-4-6", "claude-opus-4-8"]) {
      assert.ok(MODEL_POOL.some((m) => m.id === id), `缺 ${id}`);
    }
  });
});

describe("routeModel（只在池内选，never fable）", () => {
  it("评审节点一律 strong → opus-4.8（无硬编码 thinking 参数）", () => {
    const m = routeModel("easy", "evaluator", MODEL_POOL);
    assert.equal(m.id, "claude-opus-4-8");
    assert.equal(m.params, undefined);
  });
  it("产出 easy → cheap(composer-2.5)", () => {
    assert.equal(routeModel("easy", "producer", MODEL_POOL).id, "composer-2.5");
  });
  it("产出 medium → mid(gpt-5.5)", () => {
    assert.equal(routeModel("medium", "producer", MODEL_POOL).id, "gpt-5.5");
  });
  it("产出 hard → strong(opus-4.8)，不是 fable", () => {
    assert.equal(routeModel("hard", "producer", MODEL_POOL).id, "claude-opus-4-8");
  });
  it("该档全不可用 → 回退 cheap / auto", () => {
    assert.equal(routeModel("hard", "producer", [{ id: "x", displayName: "x", tier: "cheap" }]).id, "x");
    assert.equal(routeModel("hard", "evaluator", []).id, "auto");
  });
});

describe("availablePool", () => {
  it("与实时可用集取交集（禁用的被剔除）", () => {
    const live = new Set(["composer-2.5", "gpt-5.5"]); // 假设只有这俩可用
    const pool = availablePool(live);
    assert.deepEqual(pool.map((m) => m.id).sort(), ["composer-2.5", "gpt-5.5"]);
  });
  it("live 不可知 → 返回整池", () => {
    assert.equal(availablePool(null).length, MODEL_POOL.length);
  });
});

describe("多 provider 路由池", () => {
  it("poolFor：cursor → MODEL_POOL，claude-agent → CLAUDE_POOL", () => {
    assert.equal(poolFor("cursor"), MODEL_POOL);
    assert.equal(poolFor("claude-agent"), CLAUDE_POOL);
  });
  it("Claude 池用别名路由：plan→opus、execute→haiku、review→sonnet、test→haiku", () => {
    assert.equal(purposeModel("plan", CLAUDE_POOL).id, "opus");
    assert.equal(purposeModel("execute", CLAUDE_POOL).id, "haiku");
    assert.equal(purposeModel("review", CLAUDE_POOL).id, "sonnet");
    assert.equal(purposeModel("test", CLAUDE_POOL).id, "haiku");
  });
  it("Claude 池 displayName 带版本号", () => {
    assert.equal(CLAUDE_POOL.find((m) => m.id === "opus")?.displayName, "Claude Opus 4.8");
  });
  it("availablePool 可传入指定池", () => {
    const live = new Set(["opus"]);
    assert.deepEqual(availablePool(live, CLAUDE_POOL).map((m) => m.id), ["opus"]);
  });
});

describe("modelResolver（按难度，保留备用）", () => {
  it("按难度+kind 路由", () => {
    const r = modelResolver("medium", MODEL_POOL);
    assert.equal(r({ id: "a", kind: "producer" }).id, "gpt-5.5");
    assert.equal(r({ id: "b", kind: "evaluator" }).id, "claude-opus-4-8");
  });
});

describe("按用途路由（控制成本：opus 只给出方案/把控）", () => {
  it("purposeModel：plan→opus，execute/validate→composer，review→sonnet，test→kimi", () => {
    assert.equal(purposeModel("plan", MODEL_POOL).id, "claude-opus-4-8");
    assert.equal(purposeModel("control", MODEL_POOL).id, "claude-opus-4-8");
    assert.equal(purposeModel("execute", MODEL_POOL).id, "composer-2.5");
    assert.equal(purposeModel("validate", MODEL_POOL).id, "composer-2.5");
    assert.equal(purposeModel("review", MODEL_POOL).id, "claude-sonnet-4-6");
    assert.equal(purposeModel("test", MODEL_POOL).id, "kimi-k2.5");
  });
  it("首选模型不在池内 → 退档（plan 无 opus 时退到 cheap）", () => {
    const poolNoOpus = MODEL_POOL.filter((m) => m.id !== "claude-opus-4-8");
    assert.ok(["composer-2.5", "kimi-k2.5", "claude-haiku-4-5"].includes(purposeModel("plan", poolNoOpus).id));
  });
  it("purposeResolver：用节点 purpose；无 purpose 按 kind 兜底", () => {
    const r = purposeResolver(MODEL_POOL);
    assert.equal(r({ id: "x", kind: "producer", purpose: "plan" }).id, "claude-opus-4-8");
    assert.equal(r({ id: "y", kind: "producer" }).id, "composer-2.5");
    assert.equal(r({ id: "z", kind: "evaluator" }).id, "claude-sonnet-4-6");
  });
  it("routingScheme 给出完整方案", () => {
    const s = routingScheme(MODEL_POOL);
    assert.equal(s.plan, "claude-opus-4-8");
    assert.equal(s.execute, "composer-2.5");
    assert.equal(s.review, "claude-sonnet-4-6");
    assert.equal(s.test, "kimi-k2.5");
  });
});
