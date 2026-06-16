import { defineContract, type ContractResult } from "../contract.js";
import type { EvaluatorVerdict } from "../node.js";

/** 所有评审节点共用的输出契约（双维度判定）。 */
export const verdictContract = defineContract<EvaluatorVerdict>({
  name: "evaluator.verdict",
  schema: `{
  "completion": { "done": boolean, "evidence": string },
  "deviation":  { "score": number, "reason": string },  // score 0~1：0 贴合、1 跑偏
  "pass": boolean,
  "requiredFixes": string[]
}`,
  validate(data): ContractResult<EvaluatorVerdict> {
    const d = data as Partial<EvaluatorVerdict>;
    const errors: string[] = [];
    if (typeof d.completion?.done !== "boolean") errors.push("completion.done 必须是 boolean");
    if (typeof d.deviation?.score !== "number") errors.push("deviation.score 必须是 number");
    if (typeof d.pass !== "boolean") errors.push("pass 必须是 boolean");
    if (!Array.isArray(d.requiredFixes)) errors.push("requiredFixes 必须是数组");
    if (errors.length) return { ok: false, errors };
    return { ok: true, value: data as EvaluatorVerdict };
  },
});
