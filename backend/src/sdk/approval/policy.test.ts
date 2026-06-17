import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { autoApprover, denyApprover } from "./policy.js";

describe("approval policy", () => {
  it("autoApprover 全放行", async () => {
    assert.deepEqual(await autoApprover({ tool: "Bash", input: { command: "echo hi" } }), { allow: true });
  });

  it("denyApprover 全拒绝且原因带工具名（headless 无审批通道时的保守默认）", async () => {
    const r = await denyApprover({ tool: "Bash", input: { command: "rm -rf /" } });
    assert.equal(r.allow, false);
    assert.match(r.reason ?? "", /Bash/);
  });
});
