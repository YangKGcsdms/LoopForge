/**
 * 单元包装（通用入口）—— 指定目录 + 传入需求，调 SDK 在该目录开发。
 * 产物落在你指定的目录（真实场景验证）；复盘日志（带轮次）落 output/<name>/。
 *
 * 关令 = 可配置校验命令：给了 LF_CHECK 就真跑它，exit 0 才放行、否则把输出当反馈续跑（地面真值）；
 * 不给则"产生改动即放行"（单轮跑，给你看结果）。用影子 git 算逐轮 diff —— **不碰目标目录自己的 .git**。
 *
 * 用法（仓库根）：
 *   LF_DIR=/abs/project LF_REQ="把 README 补上安装章节" [LF_CHECK="npm run typecheck"] \
 *   [LF_BACKEND=local|deepseek] [LF_ROUNDS=3] [LF_NAME=run1] \
 *   node --import tsx backend/src/sdk/orchestration/unit-run.ts
 * 或：LF_DIR=... LF_REQ=... npm --workspace backend run unit:run
 */

import { promises as fs } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runUnit, type Gate, type UnitArtifact } from "./unit.js";
import { RunLog } from "./unit-log.js";
import { resolveBackend, applyEnv, makeLiveExecutor, type BackendId } from "./unit-sdk.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(HERE, "../../../../output");
const EXECUTOR_ID = "executor:dev";

function runCheck(cmd: string, cwd: string): { ok: boolean; code: number; output: string } {
  try {
    const out = execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 }).toString();
    return { ok: true, code: 0, output: out };
  } catch (e: any) {
    const out = `${e?.stdout?.toString() ?? ""}${e?.stderr?.toString() ?? ""}` || String(e?.message ?? e);
    return { ok: false, code: typeof e?.status === "number" ? e.status : 1, output: out };
  }
}

/** 关令：有校验命令则真跑判 exit code（地面真值）；没有则"产生改动即放行"（单轮）。 */
function makeCheckGate(cwd: string, check: string | undefined): Gate {
  return async (artifact: UnitArtifact) => {
    if (!check) {
      const changed = typeof artifact.diff === "string" && artifact.diff.includes("diff --git");
      return changed
        ? { pass: true, target: EXECUTOR_ID, reason: "已产出改动（无校验命令，单轮放行）", feedback: "", ground: { check: null } }
        : { pass: false, target: EXECUTOR_ID, reason: "未产出任何改动", feedback: "本轮没有改动任何文件，请按需求实际开发后再交付。", ground: { check: null } };
    }
    const r = runCheck(check, cwd);
    return r.ok
      ? { pass: true, target: EXECUTOR_ID, reason: `校验通过：${check}`, feedback: "", ground: { check, exitCode: 0 } }
      : {
          pass: false,
          target: EXECUTOR_ID,
          reason: `校验未过（exit ${r.code}）：${check}`,
          feedback: `校验命令 \`${check}\` 失败（exit ${r.code}）：\n${r.output.slice(0, 2000)}\n请据此修正后继续。`,
          ground: { check, exitCode: r.code, output: r.output.slice(0, 4000) },
        };
  };
}

async function main(): Promise<void> {
  const dir = process.env.LF_DIR;
  if (!dir) throw new Error("缺少 LF_DIR（开发目录路径）");
  const cwd = path.resolve(process.cwd(), dir);
  let requirement = process.env.LF_REQ ?? "";
  if (!requirement && process.env.LF_REQ_FILE) {
    requirement = await fs.readFile(path.resolve(process.cwd(), process.env.LF_REQ_FILE), "utf8");
  }
  if (!requirement.trim()) throw new Error('缺少需求：设 LF_REQ="..." 或 LF_REQ_FILE=路径');

  const check = process.env.LF_CHECK || undefined;
  const maxRounds = Number(process.env.LF_ROUNDS || "3");
  const backendId = (process.env.LF_BACKEND as BackendId) || "local";
  const runId = process.env.LF_NAME || `run-${path.basename(cwd)}`;

  const backend = await resolveBackend(backendId);
  applyEnv(backend.env);

  const sdk: any = await import("@anthropic-ai/claude-agent-sdk");
  const taskDir = path.join(OUTPUT_DIR, runId);
  await fs.rm(taskDir, { recursive: true, force: true });
  await fs.mkdir(taskDir, { recursive: true });
  const log = new RunLog(path.join(taskDir, "events.jsonl"), true);
  const gitDir = path.join(taskDir, ".shadow-git"); // 影子 git，不碰目标目录的 .git

  console.log("\n=== 单元包装 · 通用开发 ===");
  console.log(`目录：${cwd}（产物落这）`);
  console.log(`需求：${requirement.split("\n")[0].slice(0, 80)}`);
  console.log(`关令：${check ? `校验命令 \`${check}\`（exit 0 放行，否则反馈续跑）` : "产生改动即放行（无校验命令，单轮）"}`);
  console.log(`后端：${backend.label} · 复盘：output/${runId}/\n`);

  const executor = makeLiveExecutor(sdk, { cwd, model: backend.model, log, gitDir });
  const gate = makeCheckGate(cwd, check);

  const result = await runUnit(
    { taskId: runId, task: requirement, executor, gate, maxRounds },
    { outDir: OUTPUT_DIR, log, meta: { backend: backend.label, devDir: cwd, check: check ?? null } },
  );

  if (result.status !== "converged") process.exitCode = 1;
}

main().catch((e) => {
  console.error("运行失败：", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
