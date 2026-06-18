/**
 * 复盘 / 回放 —— 从一次运行的 events.jsonl 重建 timeline.md（含思考/自报全文）。零计费、不碰 LLM。
 *
 * 这是"逐事件可复盘"的兑现：events.jsonl 是权威记录，任何历史运行都能据此还原时间线。
 *
 * 用法（仓库根）：
 *   node --import tsx backend/src/sdk/orchestration/unit-replay.ts output/U003-site-deepseek/events.jsonl
 *   npm --workspace backend run unit:replay -- <绝对或相对 events.jsonl 路径>
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderTimeline, type LogEvent } from "./unit-log.js";

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    console.error("用法：unit-replay.ts <events.jsonl 路径>");
    process.exitCode = 1;
    return;
  }
  const jsonlPath = path.resolve(process.cwd(), arg);
  const events: LogEvent[] = readFileSync(jsonlPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LogEvent);

  const runEnd = events.find((e) => e.kind === "run_end")?.data as { status?: string; rounds?: number } | undefined;
  const taskId =
    (events.find((e) => e.kind === "run_start")?.data as { taskId?: string } | undefined)?.taskId ??
    path.basename(path.dirname(jsonlPath));
  const status = runEnd?.status ?? "unknown";
  const rounds = runEnd?.rounds ?? events.filter((e) => e.kind === "round_start").length;

  const md = renderTimeline(events, { taskId, status, rounds });
  const out = path.join(path.dirname(jsonlPath), "timeline.md");
  writeFileSync(out, md);
  console.log(`已从 ${events.length} 条事件重建时间线 → ${out}\n`);
  console.log(md);
}

main();
