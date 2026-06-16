import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runNode, type Sender } from "./run.js";
import { cursorSender } from "./sender.js";
import { defineContract, type ContractResult } from "./contract.js";
import { difficultyAssessor } from "./nodes/router.js";
import { decomposeNode } from "./nodes/decompose.js";
import type { NodeTemplate } from "./node.js";
import { getApiKey } from "../../config/store.js";
import { ClaudeAgentProvider } from "../claude/claudeProvider.js";

/**
 * 真实 SDK 集成测试 —— 真的调 Cursor、真的烧 token。
 * 只用 kimi-k2.5（最便宜），空临时目录当 cwd（agent 无代码可读，最省）。
 * 不进默认 `npm test`（文件名 *.itest.ts），单独 `npm run test:live` 跑。
 */
const KIMI = { id: "kimi-k2.5" };
let sender: Sender;
let cwd = "";

interface Greet {
  greeting: string;
  n: number;
}
const greetContract = defineContract<Greet>({
  name: "greet",
  schema: '{ "greeting": string, "n": number }',
  validate(data): ContractResult<Greet> {
    const d = data as Partial<Greet>;
    if (typeof d.greeting !== "string") return { ok: false, errors: ["greeting 必须是 string"] };
    if (typeof d.n !== "number") return { ok: false, errors: ["n 必须是 number"] };
    return { ok: true, value: data as Greet };
  },
});
const greetNode: NodeTemplate<{ name: string }, Greet> = {
  id: "greet",
  kind: "producer",
  role: "你是一个测试助手。",
  output: greetContract,
  render: (i) => ({ static: "", dynamic: `给 ${i.name} 一句问候 greeting，并给一个 1~10 的数字 n。` }),
};

describe("真实 SDK 集成（kimi-k2.5）", () => {
  before(async () => {
    const apiKey = await getApiKey("cursor");
    if (!apiKey) throw new Error("未配置 Cursor SK：先在 SK 配置页填入 Cursor API Key 再跑这组测试。");
    cwd = mkdtempSync(join(tmpdir(), "cursor-itest-"));
    sender = cursorSender(apiKey, { defaultCwd: cwd });
  });
  after(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
  });

  it("runNode + 契约：真实模型产出通过 contract 校验，且模型确为 kimi", async () => {
    const r = await runNode(greetNode, { name: "Carter" }, { workspace: { cwd } }, {
      send: sender,
      resolveModel: () => KIMI,
    });
    assert.equal(r.status, "ok", `期望 ok，实际 ${r.status}｜error=${r.error}｜raw=${r.raw?.slice(0, 200)}`);
    assert.equal(typeof r.output?.greeting, "string");
    assert.equal(typeof r.output?.n, "number");
    assert.equal(r.model?.id, "kimi-k2.5");
  });

  it("难度评估节点：真实模型返回合法难度枚举", async () => {
    const r = await runNode(difficultyAssessor, { task: "给 README 改个错别字", goal: "修好" }, { workspace: { cwd } }, {
      send: sender,
      resolveModel: () => KIMI,
    });
    assert.equal(r.status, "ok", `期望 ok，实际 ${r.status}｜error=${r.error}`);
    assert.ok(["easy", "medium", "hard"].includes(r.output?.difficulty ?? ""));
  });

  it("拆解节点：真实模型产出合法 DecomposeOutput（之前 fable 在这步崩）", async () => {
    const r = await runNode(decomposeNode, { requirement: "做一个待办清单小工具", goal: "能增删改查" }, { workspace: { cwd } }, {
      send: sender,
      resolveModel: () => KIMI,
    });
    assert.equal(r.status, "ok", `期望 ok，实际 ${r.status}｜error=${r.error}｜raw=${r.raw?.slice(0, 300)}`);
    assert.ok(Array.isArray(r.output?.subtasks));
    assert.ok((r.output?.subtasks.length ?? 0) > 0);
  });
});

describe("真实 Claude 登录态", () => {
  it("validateCredential 不填 key → 探测到本机 Claude Code 登录态可用", async () => {
    const r = await new ClaudeAgentProvider().validateCredential("");
    assert.equal(r.valid, true, r.detail);
    assert.match(r.detail, /登录态|模型|可用/);
  });
});
