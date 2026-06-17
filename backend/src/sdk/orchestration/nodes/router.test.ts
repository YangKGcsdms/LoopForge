import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  tierOf,
  catalogFromModels,
  routeModel,
  modelResolver,
  availablePool,
  routingFor,
  resolverFor,
  routingScheme,
  poolFor,
  difficultyAssessor,
  MODEL_POOL,
  CLAUDE_POOL,
  CURSOR_ROUTING,
  CLAUDE_ROUTING,
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

describe("多 provider 路由池（全名，不收敛）", () => {
  it("poolFor：cursor → MODEL_POOL，claude-agent → CLAUDE_POOL", () => {
    assert.equal(poolFor("cursor"), MODEL_POOL);
    assert.equal(poolFor("claude-agent"), CLAUDE_POOL);
  });
  it("Claude 池用全名（非别名）+ 带版本 displayName", () => {
    assert.deepEqual(CLAUDE_POOL.map((m) => m.id), ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-8"]);
    assert.equal(CLAUDE_POOL.find((m) => m.id === "claude-opus-4-8")?.displayName, "Claude Opus 4.8");
  });
  it("availablePool 可传入指定池", () => {
    const live = new Set(["claude-opus-4-8"]);
    assert.deepEqual(availablePool(live, CLAUDE_POOL).map((m) => m.id), ["claude-opus-4-8"]);
  });
});

describe("modelResolver（按难度，保留备用）", () => {
  it("按难度+kind 路由", () => {
    const r = modelResolver("medium", MODEL_POOL);
    assert.equal(r({ id: "a", kind: "producer" }).id, "gpt-5.5");
    assert.equal(r({ id: "b", kind: "evaluator" }).id, "claude-opus-4-8");
  });
});

describe("两套独立路由策略（不收敛，各用各的模型名）", () => {
  it("CURSOR_ROUTING：plan→opus、execute/validate→composer、review→sonnet、test→kimi", () => {
    assert.equal(CURSOR_ROUTING.plan, "claude-opus-4-8");
    assert.equal(CURSOR_ROUTING.execute, "composer-2.5");
    assert.equal(CURSOR_ROUTING.validate, "composer-2.5");
    assert.equal(CURSOR_ROUTING.review, "claude-sonnet-4-6");
    assert.equal(CURSOR_ROUTING.test, "kimi-k2.5");
  });
  it("CLAUDE_ROUTING：plan→opus、execute/test/review→sonnet(act 别用 haiku)、validate→haiku（全名）", () => {
    assert.equal(CLAUDE_ROUTING.plan, "claude-opus-4-8");
    assert.equal(CLAUDE_ROUTING.execute, "claude-sonnet-4-6"); // act 节点，至少 sonnet
    assert.equal(CLAUDE_ROUTING.validate, "claude-haiku-4-5"); // 难度评估这类 think 小活
    assert.equal(CLAUDE_ROUTING.review, "claude-sonnet-4-6");
    assert.equal(CLAUDE_ROUTING.test, "claude-sonnet-4-6"); // act 节点
  });
  it("routingFor 按 provider 选表", () => {
    assert.equal(routingFor("cursor"), CURSOR_ROUTING);
    assert.equal(routingFor("claude-agent"), CLAUDE_ROUTING);
  });
  it("resolverFor：用节点 purpose；无 purpose 评审→review、其余→execute", () => {
    const rc = resolverFor("cursor");
    assert.equal(rc({ id: "x", kind: "producer", purpose: "plan" }).id, "claude-opus-4-8");
    assert.equal(rc({ id: "y", kind: "producer" }).id, "composer-2.5");
    assert.equal(rc({ id: "z", kind: "evaluator" }).id, "claude-sonnet-4-6");
    const ra = resolverFor("claude-agent");
    assert.equal(ra({ id: "x", kind: "producer", purpose: "execute" }).id, "claude-sonnet-4-6");
    assert.equal(ra({ id: "z", kind: "evaluator" }).id, "claude-sonnet-4-6");
  });
  it("routingScheme(provider) 给出该 provider 的完整方案", () => {
    assert.equal(routingScheme("cursor").execute, "composer-2.5");
    assert.equal(routingScheme("claude-agent").execute, "claude-sonnet-4-6");
  });
  it("难度评估节点不写死 provider 专属模型（交给路由，避免对 Claude 用了 composer）", () => {
    assert.equal(difficultyAssessor.model, undefined);
  });
});
