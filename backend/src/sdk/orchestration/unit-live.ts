/**
 * 演示任务的 LLM 真跑入口 —— 预置任务（slugify / site）+ 确定性关令，跑在一次性 workspace 里。
 * 通用包装（任意目录 + 任意需求 + 校验命令关令）见 unit-run.ts。
 *
 * 选任务：LF_UNIT_TASK（slugify | site，默认 slugify）。选后端：LF_UNIT_BACKEND（local | deepseek，默认 local）。
 * 入口：npm --workspace backend run unit:site:local / unit:site:deepseek / unit:local / unit:deepseek
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runUnit } from "./unit.js";
import { RunLog } from "./unit-log.js";
import { TASKS, type TaskDef } from "./unit-tasks.js";
import { resolveBackend, applyEnv, makeLiveExecutor, type BackendId } from "./unit-sdk.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(HERE, "../../../../output");

async function main(): Promise<void> {
  const taskKey = process.env.LF_UNIT_TASK || "slugify";
  const task: TaskDef | undefined = TASKS[taskKey];
  if (!task) throw new Error(`未知任务 LF_UNIT_TASK=${taskKey}（可选：${Object.keys(TASKS).join(" | ")}）`);

  const backendId = (process.env.LF_UNIT_BACKEND as BackendId) || "local";
  const cfg = await resolveBackend(backendId);
  applyEnv(cfg.env);

  const sdk: any = await import("@anthropic-ai/claude-agent-sdk");
  const taskId = `${task.code}-${backendId}`;
  const taskDir = path.join(OUTPUT_DIR, taskId);
  const workspace = path.join(taskDir, "workspace");

  await fs.rm(taskDir, { recursive: true, force: true });
  await fs.mkdir(taskDir, { recursive: true });
  const log = new RunLog(path.join(taskDir, "events.jsonl"), true);

  console.log("\n=== 最小执行单元 · LLM 真跑（演示任务）===");
  console.log(`任务：${task.code} → 在 output/${taskId}/workspace 开发 ${task.file}`);
  console.log(`后端：${cfg.label}\n`);

  const executor = makeLiveExecutor(sdk, { cwd: workspace, model: cfg.model, log, primaryFile: task.file });
  const gate = task.makeGate(workspace);

  const result = await runUnit(
    { taskId, task: task.prompt, executor, gate, maxRounds: task.maxRounds },
    { outDir: OUTPUT_DIR, log, meta: { backend: cfg.label } },
  );

  if (result.status !== "converged") process.exitCode = 1;
}

main().catch((e) => {
  console.error("运行失败：", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
