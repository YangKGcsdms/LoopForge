/**
 * 最小执行单元 · LLM 真跑运行器 —— 这个单元 = pipeline 里的一个真实开发节点。
 *
 *  - 执行者：接真 @anthropic-ai/claude-agent-sdk，开真工具写文件；unit 内 resume 续跑同一会话。
 *  - 关令：确定性判地面真值（真读产物文件做检查），见 unit-tasks.ts。
 *  - 不收敛就把反馈路由回执行者，resume 续跑改文件，再判。
 *  - 全程事件经共享 RunLog 实时落 events.jsonl + 打屏（带时间戳/轮次），事后渲染 timeline.md（见 unit-log.ts）。
 *
 * 选任务：LF_UNIT_TASK（slugify | site，默认 slugify）。选后端：LF_UNIT_BACKEND（local | deepseek，默认 local）。
 * 入口（都会真调 LLM、计费）：
 *   npm --workspace backend run unit:site:local / unit:site:deepseek / unit:local / unit:deepseek
 */

import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runUnit, type Executor, type UnitArtifact } from "./unit.js";
import { RunLog } from "./unit-log.js";
import { TASKS, type TaskDef } from "./unit-tasks.js";
import { newEvidence, applyMessage, finalizeEvidence } from "../claude/evidence.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(HERE, "../../../../output");
const DEEPSEEK_CFG = path.resolve(HERE, "../../../.data/deepseek.json");

// ── 执行者：接真 SDK（真写文件 + resume 续跑），整条会话流实时 emit 进运行日志 ──
function toolDetail(tool: string, input: any): string {
  if (!input) return "";
  const fp = input.file_path ?? input.path;
  if (tool === "Write") return `${fp ?? ""}${typeof input.content === "string" ? ` (写 ${input.content.length} 字节)` : ""}`;
  if (typeof fp === "string") return fp;
  if (tool === "Bash" && typeof input.command === "string") return `$ ${input.command.replace(/\n/g, " ").slice(0, 70)}`;
  return "";
}

function resultPreview(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c: any) => (typeof c?.text === "string" ? c.text : "")).join("");
  return "";
}

/** 跑一轮 query：边消费边把会话事件 emit 进 log（实时时间戳）；不在 LLM 报错时抛（让本轮失败可见、交关令判）。 */
async function captureQuery(
  sdk: any,
  params: { prompt: string; cwd: string; model: string; resume?: string },
  log: RunLog,
): Promise<{ sessionId: string }> {
  const acc = newEvidence();
  let sessionId = params.resume ?? "";
  let model: string | undefined;
  let finalText = "";
  let initDone = false;

  for await (const message of sdk.query({
    prompt: params.prompt,
    options: {
      cwd: params.cwd,
      model: params.model,
      permissionMode: "bypassPermissions", // 全自动；信任落在事后关令的地面真值
      allowedTools: ["Read", "Write", "Edit", "Bash"],
      ...(params.resume ? { resume: params.resume } : {}),
    },
  })) {
    applyMessage(acc, message); // 复用项目证据 reducer
    const m = message as any;
    if (m.type === "system" && typeof m.session_id === "string") {
      sessionId = m.session_id;
      model = m.model ?? model;
      if (!initDone) {
        log.emit({ source: "executor", kind: "session_init", data: { sessionId, model } });
        initDone = true;
      }
    } else if (m.type === "assistant") {
      // 整条消息（非增量）：思考/说话经 RunLog 打全文（consoleRender 多行缩进），CLI 级且每后端都稳。
      for (const b of m.message?.content ?? []) {
        if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) {
          log.emit({ source: "executor", kind: "text", data: { text: b.text } });
        } else if (b?.type === "thinking" && typeof b.thinking === "string" && b.thinking.trim()) {
          log.emit({ source: "executor", kind: "thinking", data: { text: b.thinking } });
        } else if (b?.type === "tool_use" && typeof b.name === "string") {
          log.emit({ source: "executor", kind: "tool_use", data: { tool: b.name, detail: toolDetail(b.name, b.input) } });
        }
      }
    } else if (m.type === "user") {
      for (const b of m.message?.content ?? []) {
        if (b?.type === "tool_result") {
          log.emit({ source: "executor", kind: "tool_result", data: { ok: !b.is_error, preview: resultPreview(b.content) } });
        }
      }
    } else if (m.type === "result") {
      if (m.is_error || (m.subtype && m.subtype !== "success")) {
        log.emit({ source: "executor", kind: "agent_error", data: { errors: m.errors ?? m.subtype } });
      } else {
        if (typeof m.result === "string") finalText = m.result;
        const usage = m.usage ? { input: m.usage.input_tokens ?? 0, output: m.usage.output_tokens ?? 0 } : undefined;
        log.emit({ source: "executor", kind: "agent_result", data: { chars: finalText.length, finalText, usage } });
      }
    }
  }
  const ev = finalizeEvidence(acc);
  log.emit({ source: "executor", kind: "session_summary", data: { toolCalls: ev.toolCalls.length, filesTouched: ev.filesTouched } });
  if (!sessionId) sessionId = params.resume ?? "nosession";
  return { sessionId };
}

/** 提交本轮 workspace 快照并取该轮产物变更（vs 上一轮）。靠 workspace 的 git，便宜。 */
function commitAndDiff(cwd: string): string {
  try {
    execFileSync("git", ["add", "-A"], { cwd });
    execFileSync(
      "git",
      ["-c", "user.email=unit@loopforge", "-c", "user.name=unit", "commit", "-q", "--allow-empty", "-m", "snapshot"],
      { cwd },
    );
    const out = execFileSync("git", ["show", "--no-color", "HEAD"], { cwd }).toString();
    return out.length > 200_000 ? out.slice(0, 200_000) + "\n…(diff 截断)\n" : out;
  } catch (e) {
    return `(diff 生成失败：${e instanceof Error ? e.message : String(e)})`;
  }
}

function makeLiveExecutor(sdk: any, cwd: string, model: string, file: string, log: RunLog): Executor {
  const snapshot = async (sessionId: string, note: string, diff: string): Promise<UnitArtifact> => {
    let content = `(未生成 ${file})`;
    try {
      content = await fs.readFile(path.join(cwd, file), "utf8");
    } catch {
      /* 没生成 */
    }
    return { sessionId, content, note, diff };
  };
  return {
    async start(task: string) {
      await fs.mkdir(cwd, { recursive: true });
      // 隔离两道闸：① workspace 做成独立 git 仓（项目根探测落在这里，见 live.itest.ts 同款）；
      // ② 把绝对工作目录钉进 prompt —— 有些模型（如 deepseek-v4-pro）会无视 cwd、用绝对路径锚到父仓库根。
      try {
        execFileSync("git", ["init", "-q"], { cwd });
        await fs.rm(path.join(cwd, ".git", "hooks"), { recursive: true, force: true }); // 去 hook 样本噪声
      } catch {
        /* 无 git 也不阻断 */
      }
      const pinned = `【工作目录】${cwd}\n你必须只在该目录内创建/修改文件（相对路径，或前缀为 ${cwd}/ 的绝对路径）；严禁写到该目录之外或任何父级仓库根。\n\n${task}`;
      const { sessionId } = await captureQuery(sdk, { prompt: pinned, cwd, model }, log);
      return snapshot(sessionId, "首轮开发（真 LLM 写文件）", commitAndDiff(cwd));
    },
    async resume(sessionId: string, feedback: string) {
      const { sessionId: sid } = await captureQuery(sdk, { prompt: feedback, cwd, model, resume: sessionId }, log);
      return snapshot(sid || sessionId, "据反馈 resume 续跑修正", commitAndDiff(cwd));
    },
  };
}

// ── 后端选择 + env 注入 ────────────────────────────────────────────
type BackendId = "local" | "deepseek";
interface BackendCfg {
  id: BackendId;
  label: string;
  model: string;
  env: Record<string, string | undefined>;
}

async function resolveBackend(id: BackendId): Promise<BackendCfg> {
  if (id === "deepseek") {
    let raw: any;
    try {
      raw = JSON.parse(await fs.readFile(DEEPSEEK_CFG, "utf8"));
    } catch {
      throw new Error(`缺少 DeepSeek 配置：${DEEPSEEK_CFG}（应含 baseUrl/authToken/model）`);
    }
    return {
      id,
      label: `DeepSeek 代理（${raw.model}）`,
      model: raw.model,
      env: {
        ANTHROPIC_API_KEY: undefined,
        ANTHROPIC_BASE_URL: raw.baseUrl,
        ANTHROPIC_AUTH_TOKEN: raw.authToken,
        ANTHROPIC_MODEL: raw.model,
        ANTHROPIC_DEFAULT_OPUS_MODEL: raw.model,
        ANTHROPIC_DEFAULT_SONNET_MODEL: raw.model,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: raw.flashModel ?? raw.model,
        CLAUDE_CODE_SUBAGENT_MODEL: raw.flashModel ?? raw.model,
        CLAUDE_CODE_EFFORT_LEVEL: raw.effort ?? "medium",
      },
    };
  }
  return {
    id,
    label: "本机 Claude Code 登录态（claude-haiku-4-5）",
    model: "claude-haiku-4-5",
    env: {
      ANTHROPIC_API_KEY: undefined,
      ANTHROPIC_BASE_URL: undefined,
      ANTHROPIC_AUTH_TOKEN: undefined,
      ANTHROPIC_MODEL: undefined,
      ANTHROPIC_DEFAULT_OPUS_MODEL: undefined,
      ANTHROPIC_DEFAULT_SONNET_MODEL: undefined,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: undefined,
      CLAUDE_CODE_SUBAGENT_MODEL: undefined,
    },
  };
}

function applyEnv(env: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

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

  // 准备 taskDir 并建共享运行日志（echo=true 实时打屏）；executor 与 runUnit 共用它 → 同一条时间线。
  await fs.rm(taskDir, { recursive: true, force: true });
  await fs.mkdir(taskDir, { recursive: true });
  const log = new RunLog(path.join(taskDir, "events.jsonl"), true);

  console.log("\n=== 最小执行单元 · LLM 真跑 ===");
  console.log(`任务：${task.code} → 在 output/${taskId}/workspace 开发 ${task.file}`);
  console.log(`后端：${cfg.label}`);
  console.log(`日志：output/${taskId}/events.jsonl（时序）+ timeline.md（人读）\n`);

  const executor = makeLiveExecutor(sdk, workspace, cfg.model, task.file, log);
  const gate = task.makeGate(workspace);

  const result = await runUnit(
    { taskId, task: task.prompt, executor, gate, maxRounds: task.maxRounds },
    { outDir: OUTPUT_DIR, log, meta: { backend: cfg.label } },
  );

  if (result.status !== "converged") {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("运行失败：", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
