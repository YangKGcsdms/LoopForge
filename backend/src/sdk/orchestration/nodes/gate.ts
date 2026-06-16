/**
 * 闸门 —— 故意写成确定性函数，不套 agent。
 * 阈值判断和硬红线是该精确、可复现、便宜的活，按设计原则「确定性的钉死」用普通代码。
 */

import type { EvaluatorVerdict, GateDecision } from "../node.js";

export interface GateConfig {
  /** deviation.score 超过此值即不放行，默认 0.3。 */
  deviationThreshold?: number;
  /** 硬红线：命中任一即 block，不看评审。匹配命令的子串或正则。 */
  hardNever?: Array<string | RegExp>;
}

const DEFAULT_HARD_NEVER: Array<string | RegExp> = [
  /rm\s+-rf\s+\//,
  /drop\s+(table|database)/i,
  /git\s+push\s+--force/i,
  /chmod\s+-R\s+777\s+\//,
];

/** 目标闸门：评审两维都达标且偏差不超阈值才放行，否则阻断/重派。 */
export function goalGate(verdict: EvaluatorVerdict, config: GateConfig = {}): GateDecision {
  const threshold = config.deviationThreshold ?? 0.3;
  if (!verdict.pass || verdict.deviation.score > threshold) {
    return {
      action: verdict.deviation.score > threshold ? "reassign" : "block",
      reason: verdict.requiredFixes.length
        ? `未通过：${verdict.requiredFixes.join("；")}`
        : `偏差 ${verdict.deviation.score} 超阈值 ${threshold}`,
    };
  }
  return { action: "allow", reason: "完成情况与目标偏差均达标" };
}

/**
 * 硬红线检查：执行危险动作前调用，命中即 block。
 * 对应 Cursor SDK 里 .cursor/hooks.json 的文件钩子那层——这里给个进程内的等价物。
 */
export function checkHardNever(command: string, config: GateConfig = {}): GateDecision | null {
  const rules = config.hardNever ?? DEFAULT_HARD_NEVER;
  for (const rule of rules) {
    const hit = typeof rule === "string" ? command.includes(rule) : rule.test(command);
    if (hit) {
      return { action: "block", reason: `命中硬红线：${String(rule)}`, hardRuleHit: String(rule) };
    }
  }
  return null;
}
