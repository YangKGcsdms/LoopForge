/**
 * 最小执行单元（Unit）—— "基础 loop" 的可落地骨架。
 *
 * 一个单元 = 执行者(执行) + 关令(门控)，在单元内反复跑直到收敛：
 *   执行者开发 → 关令判【地面真值】→ 不过则把"反馈 delta"路由回收件人 → 该会话 resume 续跑 → 再判。
 *
 * 三条设计落点（与架构讨论一致）：
 *  1) 执行者带状态 resume（连续性轴）：unit 内续跑同一会话，只喂"盲区"反馈，不重述它自己干了啥。
 *  2) 关令判地面真值、按收件人路由（信任轴）：门控反驳谁 → 反馈就投回哪个节点（target）。
 *  3) 每轮 route 决策落库（可审计）：逐轮把 input/产物/verdict/route 写进 output/<taskId>/round-N。
 *
 * 本文件只管"机制"，不绑定具体任务或 SDK：执行者/关令都是注入的端口，
 * 既能塞脚本 mock 做 hermetic 集测，也能塞真 SDK（deps.act + Agent.resume）做 live。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { RunLog, renderRoundSession, deriveMetrics } from "./unit-log.js";

/** 执行者单轮产物。content=本轮产出（代码/文本）；note=自报（不可信，仅记录）；diff=本轮 vs 上轮的产物变更（live 执行器填）。 */
export interface UnitArtifact {
  sessionId: string;
  content: string;
  note?: string;
  diff?: string;
}

/**
 * 执行者端口（可 resume）。
 *  - start(task)：unit 内第一轮，开一个新会话开发。
 *  - resume(sessionId, feedback)：续跑同一会话，喂入关令的反馈 delta。
 * 落地 live 版：start = deps.act 起 session 并抓 sessionId；resume = Agent.resume + 把 feedback 当 next turn。
 */
export interface Executor {
  start(task: string): Promise<UnitArtifact>;
  resume(sessionId: string, feedback: string): Promise<UnitArtifact>;
}

/** 关令裁决。pass=是否放行；feedback=反馈 delta（盲区，路由回执行者）；target=收件人；ground=地面真值明细（落库备查）。 */
export interface UnitVerdict {
  pass: boolean;
  feedback: string;
  target: string;
  reason: string;
  ground?: unknown;
}

/** 关令端口：拿产物判地面真值。**只看真跑出来的，不看 artifact.note 自报。** */
export type Gate = (artifact: UnitArtifact) => UnitVerdict | Promise<UnitVerdict>;

export interface UnitSpec {
  /** 单元任务编号，用于编排 output 目录（output/<taskId>/...）。 */
  taskId: string;
  /** 开发任务描述（首轮输入）。 */
  task: string;
  executor: Executor;
  gate: Gate;
  /** 单元内最大轮次，默认 3。 */
  maxRounds?: number;
}

/** 单轮记录（落库单位）。 */
export interface RoundRecord {
  round: number;
  /** 是否续跑（非首轮即 resume 同一会话）。 */
  resumed: boolean;
  /** 本轮输入：首轮=task，后续=上一轮的反馈 delta。 */
  input: string;
  /** 本轮执行者会话；resume 时应与上一轮一致。 */
  sessionId: string;
  artifact: UnitArtifact;
  verdict: UnitVerdict;
  /** 路由决策（最该被记录的那条"决策"）。 */
  route: { action: "advance" | "reassign"; target: string; reason: string };
}

export interface UnitResult {
  taskId: string;
  status: "converged" | "max_rounds";
  rounds: number;
  records: RoundRecord[];
  finalArtifact?: UnitArtifact;
}

export interface RunUnitOptions {
  /** 产出根目录；逐轮写到 <outDir>/<taskId>/round-N。 */
  outDir: string;
  /**
   * 运行日志。外部传入（live 路径：executor 与 runUnit 共用同一 log，会话事件实时入时间线）；
   * 省略则 runUnit 自建一个静默 log（mock/集测路径）。传入时调用方须已准备好 taskDir。
   */
  log?: RunLog;
  /** 附加元信息（如 backend 标签），写进 manifest.json。 */
  meta?: Record<string, unknown>;
}

/**
 * 跑一个最小单元。返回内存结果，同时把全程轨迹落到 <outDir>/<taskId>/：
 * 逐轮 round-N 文件 + summary/trace + **events.jsonl（时序日志）+ timeline.md**。
 */
export async function runUnit(spec: UnitSpec, opts: RunUnitOptions): Promise<UnitResult> {
  const maxRounds = spec.maxRounds ?? 3;
  const taskDir = path.join(opts.outDir, spec.taskId);

  let log = opts.log;
  if (!log) {
    // 自建路径：幂等清旧产出 + 静默 log（不打屏，给 hermetic 集测用）。
    await fs.rm(taskDir, { recursive: true, force: true });
    await fs.mkdir(taskDir, { recursive: true });
    log = new RunLog(path.join(taskDir, "events.jsonl"), false);
  } else {
    await fs.mkdir(taskDir, { recursive: true });
  }
  log.emit({ source: "loop", kind: "run_start", data: { taskId: spec.taskId, task: spec.task } });

  const records: RoundRecord[] = [];
  let sessionId = "";
  let feedback = "";
  let result: UnitResult | undefined;

  for (let round = 1; round <= maxRounds; round++) {
    const resumed = round > 1;
    const input = resumed ? feedback : spec.task;
    log.setRound(round);
    log.emit({ source: "loop", kind: "round_start", data: { resumed } });

    // 执行者：首轮 start 开会话；后续 resume 续跑同一会话 + 喂反馈 delta。
    // （live 执行器会经共享 log 把本轮会话事件实时打进时间线。）
    const artifact = resumed
      ? await spec.executor.resume(sessionId, feedback)
      : await spec.executor.start(spec.task);
    sessionId = artifact.sessionId;

    // 关令判地面真值。
    const verdict = await spec.gate(artifact);
    const action: "advance" | "reassign" = verdict.pass ? "advance" : "reassign";
    const route = { action, target: verdict.target, reason: verdict.reason };
    log.emit({ source: "gate", kind: "verdict", data: { pass: verdict.pass, reason: verdict.reason, target: verdict.target, ground: verdict.ground } });

    const rec: RoundRecord = { round, resumed, input, sessionId, artifact, verdict, route };
    records.push(rec);
    await writeRound(taskDir, rec);
    log.emit({ source: "loop", kind: "round_end", data: { pass: verdict.pass } });

    if (verdict.pass) {
      result = { taskId: spec.taskId, status: "converged", rounds: round, records, finalArtifact: artifact };
      break;
    }
    // 不过：反馈 delta 路由回收件人，下一轮 resume 喂入。
    feedback = verdict.feedback;
  }

  if (!result) {
    result = { taskId: spec.taskId, status: "max_rounds", rounds: maxRounds, records, finalArtifact: records[records.length - 1]?.artifact };
  }
  log.setRound(undefined);
  log.emit({ source: "loop", kind: "run_end", data: { status: result.status, rounds: result.rounds } });
  await writeRunArtifacts(taskDir, spec, result, log, opts.meta);
  return result;
}

// ── 落库（recorder）—— 按复盘维度各出文件 ────────────────────────────
// 运行根：manifest.json(整体) · report.md(综述复盘) · timeline.md(时序人读) · events.jsonl(时序机器)
//        · decisions.jsonl(决策切片) · metrics.json(成本)
// 逐轮 rounds/NN：input.md · session.md(思维) · verdict.json(决策+地面真值) · output.txt(产物快照) · changes.diff(演进)

function roundDir(taskDir: string, round: number): string {
  return path.join(taskDir, "rounds", String(round).padStart(2, "0"));
}

/** 逐轮把"原始事实"落盘（运行中调用）。 */
async function writeRound(taskDir: string, rec: RoundRecord): Promise<void> {
  const dir = roundDir(taskDir, rec.round);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "input.md"), rec.input + "\n", "utf8");
  await fs.writeFile(path.join(dir, "output.txt"), rec.artifact.content + "\n", "utf8");
  await fs.writeFile(
    path.join(dir, "verdict.json"),
    JSON.stringify(
      { round: rec.round, resumed: rec.resumed, sessionId: rec.sessionId, action: rec.route.action, ...rec.verdict },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  if (typeof rec.artifact.diff === "string" && rec.artifact.diff.trim()) {
    await fs.writeFile(path.join(dir, "changes.diff"), rec.artifact.diff, "utf8");
  }
}

/** 运行结束后，从事件 + 记录折出所有"派生"复盘文件。 */
async function writeRunArtifacts(
  taskDir: string,
  spec: UnitSpec,
  result: UnitResult,
  log: RunLog,
  meta?: Record<string, unknown>,
): Promise<void> {
  const events = log.events();
  const { perRound, totals } = deriveMetrics(events);
  const start = events[0];
  const end = events[events.length - 1];

  // 时序（人读）
  await fs.writeFile(
    path.join(taskDir, "timeline.md"),
    log.renderTimeline({ taskId: spec.taskId, status: result.status, rounds: result.rounds }),
    "utf8",
  );

  // 整体身份证
  const lastRec = result.records[result.records.length - 1];
  const manifest = {
    taskId: result.taskId,
    ...(meta ?? {}),
    model: (events.find((e) => e.kind === "session_init")?.data?.model as string) ?? null,
    status: result.status,
    rounds: result.rounds,
    sessionId: result.finalArtifact?.sessionId ?? null,
    startedAt: start?.iso ?? null,
    endedAt: end?.iso ?? null,
    durationMs: (end?.t ?? 0) - (start?.t ?? 0),
    tokens: totals.tokens,
    toolCalls: totals.toolCalls,
    finalVerdict: { pass: lastRec?.verdict.pass ?? null, reason: lastRec?.verdict.reason ?? null },
    task: spec.task,
  };
  await fs.writeFile(path.join(taskDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

  // 决策切片（信任轴）：只抽每轮关令裁决
  const decisions = events
    .filter((e) => e.kind === "verdict")
    .map((e) => ({ round: e.round, iso: e.iso, ...e.data }));
  await fs.writeFile(
    path.join(taskDir, "decisions.jsonl"),
    decisions.map((d) => JSON.stringify(d)).join("\n") + "\n",
    "utf8",
  );

  // 成本
  await fs.writeFile(
    path.join(taskDir, "metrics.json"),
    JSON.stringify({ taskId: result.taskId, status: result.status, rounds: result.rounds, totals, perRound }, null, 2) + "\n",
    "utf8",
  );

  // 逐轮·思维：执行者会话
  for (const r of result.records) {
    await fs.writeFile(path.join(roundDir(taskDir, r.round), "session.md"), renderRoundSession(events, r.round), "utf8");
  }

  // 综述复盘报告（人读入口）
  await fs.writeFile(path.join(taskDir, "report.md"), renderReport(spec, result, perRound, totals, manifest), "utf8");
}

function renderReport(
  spec: UnitSpec,
  result: UnitResult,
  perRound: ReturnType<typeof deriveMetrics>["perRound"],
  totals: ReturnType<typeof deriveMetrics>["totals"],
  manifest: { model: string | null; durationMs: number },
): string {
  const L: string[] = [];
  L.push(`# 复盘报告 · ${result.taskId}`);
  L.push("");
  L.push(`- 模型：${manifest.model ?? "-"}`);
  L.push(`- 结果：**${result.status}**，共 ${result.rounds} 轮，总耗时 ${(manifest.durationMs / 1000).toFixed(1)}s`);
  L.push(`- 成本：in ${totals.tokens.input} / out ${totals.tokens.output} tokens · 工具 ${totals.toolCalls} 次`);
  L.push(`- 任务：${spec.task.split("\n")[0]}`);
  L.push("");
  L.push("## 逐轮");
  for (const r of result.records) {
    const m = perRound.find((x) => x.round === r.round);
    L.push("");
    L.push(`### 第 ${r.round} 轮（${r.resumed ? "续跑" : "首轮"}）`);
    L.push(`- 输入：${r.input.split("\n")[0].slice(0, 80)}`);
    L.push(`- 节点：工具 ${m?.toolCalls ?? 0} 次 · 改文件 [${(m?.filesTouched ?? []).map((f) => f.split("/").pop()).join(", ") || "无"}] · ${((m?.durationMs ?? 0) / 1000).toFixed(1)}s`);
    if (typeof r.artifact.diff === "string") {
      const stat = (r.artifact.diff.match(/^ \d+ files? changed.*$/m) || [])[0]?.trim();
      L.push(`- 产物变化：见 \`rounds/${String(r.round).padStart(2, "0")}/changes.diff\`${stat ? `（${stat}）` : ""}`);
    }
    L.push(`- 关令：${r.verdict.pass ? "✓ 放行" : "✗ 打回"} · ${r.verdict.reason}`);
    const failed = (r.verdict.ground as { failed?: string[] } | undefined)?.failed ?? [];
    if (!r.verdict.pass && failed.length) L.push(`- 未达标：${failed.join("；")}`);
    if (!r.verdict.pass && r.verdict.feedback) L.push(`- 反馈 → \`${r.route.target}\``);
  }
  L.push("");
  L.push("## 定性");
  const qual =
    result.status === "converged"
      ? result.rounds === 1
        ? "一轮即过：节点首发命中地面真值契约。"
        : `${result.rounds} 轮收敛：经 ${result.rounds - 1} 次打回 + 反馈续跑后达标。`
      : `撞上限未收敛（${result.rounds} 轮）：最后一轮仍未过关令，下游拿到的是被迫产出（force-ship），需人工介入。`;
  L.push(`- ${qual}`);
  L.push("");
  return L.join("\n");
}
