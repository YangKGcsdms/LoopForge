/**
 * 单元的 SDK 接入核心（纯模块，无 main）—— 给 unit-live（演示任务）与 unit-run（通用包装）共用。
 *
 *  - resolveBackend / applyEnv：后端选择（本机登录态 / DeepSeek 代理）+ env 注入
 *  - captureQuery：跑一轮 query，会话事件实时 emit 进运行日志（思考/工具/说话），采证据
 *  - makeLiveExecutor：可 resume 的执行者；逐轮 git 快照算 diff
 *      · gitDir 给了 = 影子 git（work-tree=目标目录，**不碰目标目录自己的 .git**，真实工程用）
 *      · gitDir 没给 = 在 cwd 里 git init（一次性 workspace 用）
 */

import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";
import type { Executor, UnitArtifact } from "./unit.js";
import { RunLog } from "./unit-log.js";
import { newEvidence, applyMessage, finalizeEvidence } from "../claude/evidence.js";
import type { AskHuman } from "../types.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEEPSEEK_CFG = path.resolve(HERE, "../../../.data/deepseek.json");

// ── 会话采集 ───────────────────────────────────────────────────────
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

/**
 * ask_human MCP 工具 —— 复用飞书 ask 通道（runtimeAsker）：agent 纠结 / 任务含糊（不确定改哪个模块）/
 * 反复做不下去时主动调它发卡片问人,人点选项的答复回填给 agent 继续。
 * 不逐工具弹卡（执行器默认 bypassPermissions 全自动）,只在 agent 自己举手时才打扰人——这是"诚实举手"通道。
 */
function makeAskServer(
  sdk: any,
  ask: AskHuman,
  cwd: string,
  log: RunLog,
): { mcpServers: Record<string, unknown>; toolName: string } {
  const tool = sdk.tool(
    "ask_human",
    "当你遇到方案分叉、缺少关键信息（比如该改哪个模块/文件还不确定）、或反复尝试仍做不下去、必须人来拍板时，" +
      "调用此工具向人发起问询并等待答复。非必要不要调用——能自己判断就自己做。" +
      "question 写清你的纠结点；options 可给人几个候选答案。",
    {
      question: z.string().describe("你的纠结点 / 要确认的问题"),
      options: z.array(z.string()).optional().describe("可选：给人选的候选答案"),
      context: z.string().optional().describe("可选：你已经尝试过什么"),
    },
    async (args: { question?: string; options?: string[]; context?: string }) => {
      const question = String(args?.question ?? "（未给出问题）");
      log.emit({ source: "executor", kind: "ask_human", data: { question, options: args?.options ?? null } });
      const { answer } = await ask({
        question,
        options: Array.isArray(args?.options) ? args.options : undefined,
        context: typeof args?.context === "string" ? args.context : undefined,
        cwd,
      });
      log.emit({ source: "executor", kind: "ask_answer", data: { answer } });
      return { content: [{ type: "text", text: answer }] };
    },
  );
  const server = sdk.createSdkMcpServer({ name: "askhuman", version: "1.0.0", tools: [tool] });
  return { mcpServers: { askhuman: server }, toolName: "mcp__askhuman__ask_human" };
}

/** 跑一轮 query：会话事件实时 emit 进 log（思考/工具/说话），采证据；不在 LLM 报错时抛（本轮失败交关令判）。 */
export async function captureQuery(
  sdk: any,
  params: { prompt: string; cwd: string; model: string; resume?: string; ask?: AskHuman },
  log: RunLog,
): Promise<{ sessionId: string }> {
  const acc = newEvidence();
  let sessionId = params.resume ?? "";
  let model: string | undefined;
  let finalText = "";
  let initDone = false;

  // 举手通道：给了 ask 就注入 ask_human MCP 工具，agent 纠结/含糊时主动发飞书卡片问人（异步、不阻死）。
  const askServer = params.ask ? makeAskServer(sdk, params.ask, params.cwd, log) : undefined;

  for await (const message of sdk.query({
    prompt: params.prompt,
    options: {
      cwd: params.cwd,
      model: params.model,
      permissionMode: "bypassPermissions",
      allowedTools: ["Read", "Write", "Edit", "Bash", ...(askServer ? [askServer.toolName] : [])],
      ...(askServer ? { mcpServers: askServer.mcpServers } : {}),
      ...(params.resume ? { resume: params.resume } : {}),
    },
  })) {
    applyMessage(acc, message);
    const m = message as any;
    if (m.type === "system" && typeof m.session_id === "string") {
      sessionId = m.session_id;
      model = m.model ?? model;
      if (!initDone) {
        log.emit({ source: "executor", kind: "session_init", data: { sessionId, model } });
        initDone = true;
      }
    } else if (m.type === "assistant") {
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

// ── 执行者（可 resume + 逐轮 git diff）────────────────────────────
export interface LiveExecutorConfig {
  /** 工作目录（产物落这）。 */
  cwd: string;
  model: string;
  log: RunLog;
  /** 影子 git 目录：给了=不碰 cwd 自己的 .git（真实工程用）；省略=在 cwd 里 git init（一次性 workspace）。 */
  gitDir?: string;
  /** 主产物文件名：给了则快照读它内容；否则快照仅记 diff。 */
  primaryFile?: string;
  /** 把绝对 cwd 钉进首轮 prompt（默认 true），防止模型无视 cwd 写到别处。 */
  pin?: boolean;
  /** 举手通道：给了则 agent 纠结/含糊时发飞书 ask_human 卡片问你（来自 runtimeAsker）；省略=纯全自动。 */
  ask?: AskHuman;
}

export function makeLiveExecutor(sdk: any, cfg: LiveExecutorConfig): Executor {
  const gp = cfg.gitDir ? [`--git-dir=${cfg.gitDir}`, `--work-tree=${cfg.cwd}`] : ["-C", cfg.cwd];
  const git = (args: string[]): string =>
    execFileSync("git", [...gp, ...args], { stdio: ["ignore", "pipe", "ignore"] }).toString();
  const commit = (msg: string) =>
    git(["-c", "user.email=unit@loopforge", "-c", "user.name=unit", "commit", "-q", "--allow-empty", "-m", msg]);
  let inited = false;

  const ensureRepo = async (): Promise<void> => {
    if (inited) return;
    inited = true;
    await fs.mkdir(cfg.cwd, { recursive: true });
    try {
      git(["init", "-q"]);
      if (!cfg.gitDir) await fs.rm(path.join(cfg.cwd, ".git", "hooks"), { recursive: true, force: true });
      // 排除重目录，避免基线 add -A 吞下 node_modules 等（真实工程目录尤其重要）。
      const infoExclude = cfg.gitDir ? path.join(cfg.gitDir, "info", "exclude") : path.join(cfg.cwd, ".git", "info", "exclude");
      await fs.mkdir(path.dirname(infoExclude), { recursive: true });
      await fs.appendFile(infoExclude, "\nnode_modules/\n.git/\ndist/\nbuild/\n.next/\nout/\nvendor/\ntarget/\n*.log\n");
      // 基线：记录开发前状态，使逐轮 diff 只含本轮改动。
      git(["add", "-A"]);
      commit("baseline");
    } catch {
      /* 无 git 不阻断主流程，仅 diff 会缺失 */
    }
  };

  const commitDiff = (): string => {
    try {
      git(["add", "-A"]);
      commit("snapshot");
      const out = git(["show", "--no-color", "HEAD"]);
      return out.length > 200_000 ? out.slice(0, 200_000) + "\n…(diff 截断)\n" : out;
    } catch (e) {
      return `(diff 生成失败：${e instanceof Error ? e.message : String(e)})`;
    }
  };

  const snapshot = async (sessionId: string, note: string): Promise<UnitArtifact> => {
    let content = cfg.primaryFile ? `(未生成 ${cfg.primaryFile})` : "(产物见 changes.diff / 工作目录)";
    if (cfg.primaryFile) {
      try {
        content = await fs.readFile(path.join(cfg.cwd, cfg.primaryFile), "utf8");
      } catch {
        /* 没生成 */
      }
    }
    return { sessionId, content, note, diff: commitDiff() };
  };

  const pinPrompt = (task: string): string =>
    cfg.pin === false
      ? task
      : `【工作目录】${cfg.cwd}\n你必须只在该目录内创建/修改文件（相对路径，或前缀为 ${cfg.cwd}/ 的绝对路径）；严禁写到该目录之外或任何父级仓库根。\n\n${task}`;

  return {
    async start(task: string) {
      await ensureRepo();
      const { sessionId } = await captureQuery(sdk, { prompt: pinPrompt(task), cwd: cfg.cwd, model: cfg.model, ask: cfg.ask }, cfg.log);
      return snapshot(sessionId, "首轮开发（真 LLM 写文件）");
    },
    async resume(sessionId: string, feedback: string) {
      const { sessionId: sid } = await captureQuery(sdk, { prompt: feedback, cwd: cfg.cwd, model: cfg.model, resume: sessionId, ask: cfg.ask }, cfg.log);
      return snapshot(sid || sessionId, "据反馈 resume 续跑修正");
    },
  };
}

// ── 后端选择 + env 注入 ────────────────────────────────────────────
export type BackendId = "local" | "deepseek";
export interface BackendCfg {
  id: BackendId;
  label: string;
  model: string;
  env: Record<string, string | undefined>;
}

export async function resolveBackend(id: BackendId): Promise<BackendCfg> {
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

export function applyEnv(env: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}
