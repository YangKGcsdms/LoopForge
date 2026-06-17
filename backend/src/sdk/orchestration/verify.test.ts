import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { makeVerifier } from "./verify.js";

function tempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "verify-test-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  return dir;
}

test("采到新增未跟踪文件；失败的 check 让 testsPass=false（戳穿自报通过）", async () => {
  const dir = tempRepo();
  try {
    writeFileSync(join(dir, "a.ts"), "export const a = 1;\n");
    const verify = makeVerifier({ checks: [
      { name: "passing", command: "true" },
      { name: "failing", command: "false" },
    ] });
    const v = await verify(dir);
    assert.ok(v.filesChanged.includes("a.ts"), `应采到 a.ts，实际 ${JSON.stringify(v.filesChanged)}`);
    assert.equal(v.checks.length, 2);
    assert.equal(v.checks[0].ok, true);
    assert.equal(v.checks[1].ok, false);
    assert.equal(v.checks[1].exitCode, 1);
    assert.equal(v.testsPass, false); // 有失败 → 不得判 done
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("没配 check → testsPass=null（无独立证明，评审不得据此判 done）", async () => {
  const dir = tempRepo();
  try {
    const v = await makeVerifier()(dir);
    assert.equal(v.testsPass, null);
    assert.deepEqual(v.checks, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("全部 check 通过 → testsPass=true，并捕获命令输出", async () => {
  const dir = tempRepo();
  try {
    const v = await makeVerifier({ checks: [{ name: "echo", command: "echo HELLO" }] })(dir);
    assert.equal(v.testsPass, true);
    assert.match(v.checks[0].output, /HELLO/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
