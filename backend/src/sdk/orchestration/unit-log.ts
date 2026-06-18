/**
 * 运行日志系统 —— 给单元整条事件流打时间戳、按时序落 events.jsonl + 渲染 timeline.md。
 *
 * 控制台是朴素日志：每行 `[时钟] 谁 内容`；大块输出（思考/说话）前加分隔线，正文缩进对齐。
 * 机器权威记录在 events.jsonl（含绝对时间 t / iso / 距起点 dt + 全文 data），供逐事件复盘/回放。
 */

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export type LogSource = "loop" | "executor" | "gate";

export interface LogEvent {
  seq: number;
  /** 绝对时间（epoch ms）。 */
  t: number;
  iso: string;
  /** 距运行起点毫秒。 */
  dt: number;
  source: LogSource;
  round?: number;
  kind: string;
  data?: Record<string, unknown>;
}

export interface EmitInput {
  source: LogSource;
  kind: string;
  round?: number;
  t?: number;
  data?: Record<string, unknown>;
  echo?: boolean;
}

export interface TimelineMeta {
  taskId: string;
  status: string;
  rounds: number;
}

const ICON: Record<string, string> = {
  run_start: "▶",
  round_start: "┌",
  session_init: "·",
  thinking: "🧠",
  text: "💬",
  tool_use: "🔧",
  tool_result: "↳",
  ask_human: "🙋",
  ask_answer: "💡",
  session_summary: "✎",
  agent_result: "↩",
  agent_error: "⚠",
  verdict: "⚖",
  round_end: "└",
  run_end: "■",
};

/** 谁在输出（控制台对齐用，统一 4 字宽）。 */
const WHO: Record<string, string> = { loop: "loop", executor: "node", gate: "gate" };

function clip(v: unknown, n: number): string {
  const s = typeof v === "string" ? v : v === undefined || v === null ? "" : Array.isArray(v) ? v.join(", ") : String(v);
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n) + "…" : one;
}

/** 本地时间戳 YYYY-MM-DD HH:MM:SS（带年月日）。 */
function clock(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 单行事件的内容（不含 who/时间）。 */
function describe(e: LogEvent): string {
  const d = e.data ?? {};
  const icon = ICON[e.kind] ?? "·";
  switch (e.kind) {
    case "run_start": return `${icon} 开始 · ${d.taskId ?? ""}`;
    case "round_start": return `${icon} 第 ${e.round} 轮${d.resumed ? "（续跑）" : ""}`;
    case "session_init": return `${icon} 会话 ${d.sessionId ?? "-"} · ${d.model ?? "-"}`;
    case "tool_use": return `${icon} ${d.tool} ${clip(d.detail, 100)}`;
    case "tool_result": return `  ${icon} ${d.ok ? "ok" : "err"}${d.preview ? ` · ${clip(d.preview, 80)}` : ""}`;
    case "ask_human": return `${icon} 举手问人：${clip(d.question, 90)}`;
    case "ask_answer": return `${icon} 人答：${clip(d.answer, 90)}`;
    case "session_summary": return `${icon} 工具 ${d.toolCalls ?? 0} 次 · 改文件 [${clip(d.filesTouched, 140) || "无"}]`;
    case "agent_result": return `${icon} 自报 ${d.chars ?? 0} 字`;
    case "agent_error": return `${icon} 报错：${clip(d.errors, 140)}`;
    case "verdict": return `${icon} ${d.pass ? "✓ 放行" : "✗ 打回"} · ${clip(d.reason, 90)}`;
    case "round_end": return `${icon} 第 ${e.round} 轮结束`;
    case "run_end": return `${icon} 结束 · ${d.status}，${d.rounds} 轮`;
    default: return e.kind;
  }
}

/** 长文事件（思考/说话）的全文。 */
function fullText(e: LogEvent): string | undefined {
  const d = e.data ?? {};
  if (e.kind === "thinking" || e.kind === "text") return typeof d.text === "string" ? d.text : undefined;
  return undefined;
}

/**
 * 控制台一条日志：`[时钟] 谁 内容`。
 * 思考/说话是大块 → 先打一行分隔（标明谁+时钟+图标），正文整段缩进对齐；其余事件单行。
 */
export function consoleRender(e: LogEvent): string {
  const ts = `[${clock(e.iso)}]`;
  const who = WHO[e.source] ?? e.source;
  const body = fullText(e);
  if (body && body.trim()) {
    const icon = ICON[e.kind] ?? "·";
    const indent = " ".repeat(ts.length + 1 + who.length + 1);
    const head = `${ts} ${who} ${icon} ${"─".repeat(30)}`;
    const lines = body.trim().split("\n").map((l) => indent + l).join("\n");
    return `${head}\n${lines}`;
  }
  return `${ts} ${who} ${describe(e)}`;
}

export class RunLog {
  private seq = 0;
  private readonly t0: number;
  private readonly buf: LogEvent[] = [];
  private curRound: number | undefined;

  constructor(private readonly logPath: string, private readonly echo = true) {
    this.t0 = Date.now();
    mkdirSync(path.dirname(logPath), { recursive: true });
    writeFileSync(logPath, ""); // 新建/截断
  }

  setRound(n: number | undefined): void {
    this.curRound = n;
  }

  emit(input: EmitInput): LogEvent {
    const t = input.t ?? Date.now();
    const e: LogEvent = {
      seq: this.seq++,
      t,
      iso: new Date(t).toISOString(),
      dt: t - this.t0,
      source: input.source,
      round: input.round ?? this.curRound,
      kind: input.kind,
      data: input.data,
    };
    this.buf.push(e);
    appendFileSync(this.logPath, JSON.stringify(e) + "\n");
    if (input.echo ?? this.echo) console.log(consoleRender(e));
    return e;
  }

  events(): LogEvent[] {
    return this.buf;
  }

  renderTimeline(meta: TimelineMeta): string {
    return renderTimeline(this.buf, meta);
  }
}

/**
 * 从事件序列渲染人读时间线（含思考/说话全文）。
 * 纯函数：RunLog 实时渲染与 replay（从 events.jsonl 重建）共用 —— 逐事件可复盘。
 */
export function renderTimeline(events: LogEvent[], meta: TimelineMeta): string {
  const L: string[] = [];
  const end = events[events.length - 1];
  L.push(`# 运行时序 · ${meta.taskId}`);
  L.push("");
  L.push(`- 开始：${events[0]?.iso ?? "-"}`);
  L.push(`- 结束：${end?.iso ?? "-"}`);
  L.push(`- 结果：${meta.status}，共 ${meta.rounds} 轮，总耗时 ${((end?.dt ?? 0) / 1000).toFixed(1)}s`);
  L.push("");
  for (const e of events) {
    const ts = `[${clock(e.iso)}]`;
    const who = WHO[e.source] ?? e.source;
    const body = fullText(e);
    if (body && body.trim()) {
      L.push(`\`${ts}\` **${who}** ${ICON[e.kind] ?? "·"}`);
      L.push("");
      for (const ln of body.trim().split("\n")) L.push(`> ${ln}`);
      L.push("");
    } else {
      L.push(`\`${ts}\` **${who}** ${describe(e)}`);
    }
  }
  L.push("");
  return L.join("\n");
}

/** 渲染单轮"执行者会话"（思维维度）：该轮 source=executor 的事件，思考/说话全文。 */
export function renderRoundSession(events: LogEvent[], round: number): string {
  const evs = events.filter((e) => e.round === round && e.source === "executor");
  const L: string[] = [`# 第 ${round} 轮 · 执行者会话`, ""];
  for (const e of evs) {
    const ts = `[${clock(e.iso)}]`;
    const body = fullText(e);
    if (body && body.trim()) {
      L.push(`\`${ts}\` ${ICON[e.kind] ?? "·"}`);
      L.push("");
      for (const ln of body.trim().split("\n")) L.push(`> ${ln}`);
      L.push("");
    } else {
      L.push(`\`${ts}\` ${describe(e)}`);
    }
  }
  L.push("");
  return L.join("\n");
}

/** 从事件折出逐轮度量（成本维度）：耗时 / token / 工具数 / 改文件 / 裁决。 */
export function deriveMetrics(events: LogEvent[]): {
  perRound: Array<{
    round: number;
    resumed: boolean;
    durationMs: number;
    tokens: { input: number; output: number };
    toolCalls: number;
    filesTouched: string[];
    pass: boolean;
    reason: string;
  }>;
  totals: { durationMs: number; tokens: { input: number; output: number }; toolCalls: number };
} {
  const rounds = [...new Set(events.filter((e) => typeof e.round === "number").map((e) => e.round as number))].sort((a, b) => a - b);
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  const perRound = rounds.map((r) => {
    const re = events.filter((e) => e.round === r);
    const start = re.find((e) => e.kind === "round_start");
    const end = re.find((e) => e.kind === "round_end");
    const ar = re.find((e) => e.kind === "agent_result");
    const ss = re.find((e) => e.kind === "session_summary");
    const vd = re.find((e) => e.kind === "verdict");
    const usage = (ar?.data?.usage ?? {}) as { input?: number; output?: number };
    return {
      round: r,
      resumed: Boolean(start?.data?.resumed),
      durationMs: num(end?.t) - num(start?.t),
      tokens: { input: num(usage.input), output: num(usage.output) },
      toolCalls: num(ss?.data?.toolCalls),
      filesTouched: (ss?.data?.filesTouched as string[]) ?? [],
      pass: Boolean(vd?.data?.pass),
      reason: typeof vd?.data?.reason === "string" ? vd.data.reason : "",
    };
  });
  const totals = perRound.reduce(
    (acc, r) => ({
      durationMs: acc.durationMs + r.durationMs,
      tokens: { input: acc.tokens.input + r.tokens.input, output: acc.tokens.output + r.tokens.output },
      toolCalls: acc.toolCalls + r.toolCalls,
    }),
    { durationMs: 0, tokens: { input: 0, output: 0 }, toolCalls: 0 },
  );
  return { perRound, totals };
}
