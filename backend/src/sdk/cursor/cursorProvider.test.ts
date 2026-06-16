import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CursorProvider } from "./cursorProvider.js";

const p = new CursorProvider();

describe("CursorProvider", () => {
  it("info() 返回 cursor 元信息", () => {
    assert.deepEqual(p.info(), { id: "cursor", displayName: "Cursor SDK", supported: true });
  });

  it("validateCredential('') 不联网，直接判 invalid", async () => {
    const r = await p.validateCredential("");
    assert.equal(r.valid, false);
    assert.match(r.detail, /SK/);
  });
});
