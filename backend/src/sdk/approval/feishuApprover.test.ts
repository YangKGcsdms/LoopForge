import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCard, buildRespondedCard, buildExpiredCard } from "./feishuApprover.js";

describe("buildCard", () => {
  it("把选项渲染成按钮，value 带 reqId + answer（回调据此定位回填）", () => {
    const card = buildCard("req-1", {
      title: "🤔 Agent 求助",
      body: "要不要继续？",
      options: [
        { label: "继续", answer: "go", type: "primary" },
        { label: "换思路", answer: "no" },
      ],
      template: "blue",
    });
    assert.equal(card.header.template, "blue");
    const action = card.elements.find((e: any) => e.tag === "action") as any;
    assert.equal(action.actions.length, 2);
    assert.deepEqual(action.actions[0].value, { reqId: "req-1", answer: "go" });
    assert.equal(action.actions[0].type, "primary");
    assert.deepEqual(action.actions[1].value, { reqId: "req-1", answer: "no" });
    assert.equal(action.actions[1].type, "default"); // 未给 type 时回落 default
  });
});

describe("buildRespondedCard", () => {
  it("回调后卡片：保留正文、无按钮、显示「已回调」+ 答复 + 时间", () => {
    const card = buildRespondedCard({ title: "🛠 工具审批", body: "正文", answer: "allow", at: "2026-06-17 10:00:00" });
    assert.equal(card.header.template, "grey");
    // 没有 action（按钮）块，防重复点击
    assert.equal(card.elements.some((e: any) => e.tag === "action"), false);
    const text = JSON.stringify(card.elements);
    assert.match(text, /已回调/);
    assert.match(text, /allow/);
    assert.match(text, /2026-06-17 10:00:00/);
  });
});

describe("buildExpiredCard", () => {
  it("过期卡：无按钮、灰底、带说明 + 时间（旧卡迟点只会看到终态，不再卡住）", () => {
    const card = buildExpiredCard({ title: "🤔 Agent 求助", body: "正文", note: "无人响应，已自动按默认继续。", at: "2026-06-17 11:00:00" });
    assert.equal(card.header.template, "grey");
    assert.equal(card.elements.some((e: any) => e.tag === "action"), false);
    const text = JSON.stringify(card.elements);
    assert.match(text, /已自动按默认继续/);
    assert.match(text, /2026-06-17 11:00:00/);
  });
});
