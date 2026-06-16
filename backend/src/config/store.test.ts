import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { maskKey, setApiKey, getApiKey, getStatus, deleteApiKey } from "./store.js";

describe("maskKey", () => {
  it("≤8 位全打码", () => {
    assert.equal(maskKey("12345678"), "********");
  });
  it("长 key 保留首尾", () => {
    assert.equal(maskKey("key_test_1234567890"), "key_…7890");
  });
});

describe("凭据存储 set→get→status→delete 全链路", () => {
  it("落盘读回、脱敏状态、删除", async () => {
    const P = "test-prov-zzz";
    await deleteApiKey(P); // 先清干净
    await setApiKey(P, "secret-abcdefgh");
    assert.equal(await getApiKey(P), "secret-abcdefgh");

    const st = await getStatus(P);
    assert.equal(st.configured, true);
    assert.ok(st.maskedKey?.includes("…"));
    assert.equal(st.source, "store");

    await deleteApiKey(P);
    assert.equal(await getApiKey(P), undefined);
    assert.equal((await getStatus(P)).configured, false);
  });
});
