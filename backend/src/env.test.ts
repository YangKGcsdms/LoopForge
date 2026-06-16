import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { env } from "./env.js";

describe("env", () => {
  it("port 是数字", () => {
    assert.equal(typeof env.port, "number");
    assert.ok(env.port > 0);
  });
  it("dataDir 指向 .data 目录", () => {
    assert.ok(env.dataDir.endsWith(".data"));
  });
});
