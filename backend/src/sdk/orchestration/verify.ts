/**
 * 独立校验器 —— act 节点跑完后，编排层在 workspace 里**自己**跑 git diff + 配置的 test/typecheck，
 * 拿不经 agent 的「地面真值」。这是"信任轴"的落点：戳穿 agent 自报的 testsRun/filesTouched。
 *
 * 设计：
 * - filesChanged 用 `git diff --name-only HEAD` + 未跟踪文件，取真实改动（不信 agent）。
 * - checks 是项目指定的命令（如 `npm test` / `npm run typecheck`），真 exit code。
 * - testsPass：有校验且全过=true；有失败=false；**没配校验=null**（评审不得据此判 done）。
 * - 非 git 仓 / 命令缺失都降级（不抛），返回能拿到的部分；verify 本身失败由 runNode 兜底。
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Verification, VerificationCheck } from "./node.js";
import type { Verifier } from "./run.js";

const pexec = promisify(execFile);

export interface VerifyCheckSpec {
  name: string;
  command: string;
}

export interface VerifyConfig {
  /** 要独立跑的校验命令（typecheck/test/lint）。空 = 只采 git diff，testsPass=null。 */
  checks?: VerifyCheckSpec[];
  /** 单条命令超时 ms，默认 120s。 */
  timeoutMs?: number;
}

async function sh(command: string, cwd: string, timeoutMs: number): Promise<{ exitCode: number; output: string }> {
  try {
    const { stdout, stderr } = await pexec("bash", ["-lc", command], { cwd, timeout: timeoutMs, maxBuffer: 8_000_000 });
    return { exitCode: 0, output: `${stdout}${stderr}`.trim() };
  } catch (e: any) {
    const out = `${e?.stdout ?? ""}${e?.stderr ?? ""}`.trim() || (e instanceof Error ? e.message : String(e));
    const code = typeof e?.code === "number" ? e.code : 1;
    return { exitCode: code, output: out };
  }
}

/** 造一个独立校验器。checks 由调用方按目标项目配（如 npm test / typecheck）。 */
export function makeVerifier(config: VerifyConfig = {}): Verifier {
  const timeoutMs = config.timeoutMs ?? 120_000;
  return async (cwd: string): Promise<Verification> => {
    // 真实改动 = 已跟踪改动 ∪ 新增未跟踪文件（HEAD 不存在时 git diff 静默为空）。
    const tracked = await sh("git diff --name-only HEAD 2>/dev/null", cwd, timeoutMs);
    const untracked = await sh("git ls-files --others --exclude-standard 2>/dev/null", cwd, timeoutMs);
    const filesChanged = [...new Set([...splitLines(tracked.output), ...splitLines(untracked.output)])];
    const stat = await sh("git diff --stat HEAD 2>/dev/null", cwd, timeoutMs);

    const checks: VerificationCheck[] = [];
    for (const c of config.checks ?? []) {
      const r = await sh(c.command, cwd, timeoutMs);
      checks.push({
        name: c.name,
        command: c.command,
        exitCode: r.exitCode,
        ok: r.exitCode === 0,
        output: r.output.slice(0, 4000),
      });
    }
    const testsPass = checks.length === 0 ? null : checks.every((c) => c.ok);
    return { filesChanged, diffStat: stat.output, checks, testsPass };
  };
}

function splitLines(s: string): string[] {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}
