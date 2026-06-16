/** 工作流页的纯展示逻辑：节点输出 → 可读文本 + 档位/类型/难度的样式映射。抽出以便单测。 */

export function tierClass(tier: string): string {
  if (tier === "strong") return "bg-violet-100 text-violet-700";
  if (tier === "mid") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

export function kindClass(kind: string): string {
  if (kind === "evaluator") return "bg-amber-100 text-amber-700";
  if (kind === "gate") return "bg-rose-100 text-rose-700";
  return "bg-sky-100 text-sky-700";
}

export function diffClass(v: string): string {
  if (v === "hard") return "bg-rose-100 text-rose-700";
  if (v === "medium") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

/** 把节点输出渲染成可读文本（供打字机逐字显示）。 */
export function renderNodeOutput(p: { summary: string | null; output: unknown }): string {
  const o = p.output as Record<string, any> | null;
  if (o && Array.isArray(o.subtasks)) {
    const lines: string[] = o.subtasks.map(
      (s: any) => `• ${s.id} ${s.title}（${s.estimateHours}h）— ${s.acceptance}`,
    );
    if (o.ambiguities?.length) lines.push(`⚠ 不明确：${o.ambiguities.join("；")}`);
    if (o.toSupplement?.length) lines.push(`＋ 待补充：${o.toSupplement.join("；")}`);
    return lines.join("\n");
  }
  if (o && Array.isArray(o.filesTouched)) {
    const lines = [`产出：${o.summary}`, `改动：${o.filesTouched.join("，")}`];
    if (o.testsRun) lines.push(`测试：${o.testsRun.passed} 过 / ${o.testsRun.failed} 败`);
    lines.push(`自检：${o.selfCheck}`);
    return lines.join("\n");
  }
  if (o && typeof o.approach === "string") {
    const lines = [`思路：${o.approach}`];
    if (o.phases?.length) lines.push(`阶段：${o.phases.join(" → ")}`);
    if (o.acceptance?.length) lines.push(`验收：${o.acceptance.join("；")}`);
    if (o.risks?.length) lines.push(`风险：${o.risks.join("；")}`);
    if (o.openQuestions?.length) lines.push(`待澄清：${o.openQuestions.join("；")}`);
    return lines.join("\n");
  }
  if (o && o.difficulty) return `难度判定：${o.difficulty}\n理由：${o.reason}`;
  if (o && typeof o.pass === "boolean") {
    const lines = [
      `完成情况：${o.completion?.done ? "✓ 达标" : "✗ 未达标"}（${o.completion?.evidence ?? ""}）`,
      `目标偏差：${o.deviation?.score}（${o.deviation?.reason ?? ""}）`,
      `通过：${o.pass ? "是" : "否"}`,
    ];
    if (o.requiredFixes?.length) lines.push(`矫正项：${o.requiredFixes.join("；")}`);
    return lines.join("\n");
  }
  return p.summary ?? JSON.stringify(o);
}
