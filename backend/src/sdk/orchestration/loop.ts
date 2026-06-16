/**
 * Loop runner —— evaluator-optimizer 骨架：产出 → 评审 → 闸门 → 收敛判定 → 矫正后重来。
 *
 * 矫正机制：把上一轮评审 verdict 塞进 ctx.priorVerdict，产出节点的 render 会读它自我修正，
 * 所以默认不需要额外 reduce；需要改输入本身时才传 correct。
 * 7 个 loop 都是这一个 runLoop，只换 producer / evaluator / 退出条件。
 */

import { runNode, type NodeDeps } from "./run.js";
import { goalGate } from "./nodes/gate.js";
import type {
  EvaluatorNode,
  EvaluatorVerdict,
  GateDecision,
  NodeResult,
  NodeRunContext,
  NodeTemplate,
} from "./node.js";

/**
 * 多评审合议 —— 主评审 + 对抗评审的 verdict 合并：
 * 全员 pass 才 pass；requiredFixes 取并集；完成情况取最严（任一未完成即未完成）；偏差取最差。
 * 单评审时 combine([v]) === v，对既有单评审 loop 无行为变化。
 */
export function combineVerdicts(verdicts: EvaluatorVerdict[]): EvaluatorVerdict {
  return {
    completion: {
      done: verdicts.every((v) => v.completion.done),
      evidence: verdicts.map((v) => v.completion.evidence).filter(Boolean).join(" ｜ "),
    },
    deviation: {
      score: Math.max(...verdicts.map((v) => v.deviation.score)),
      reason: verdicts.map((v) => v.deviation.reason).filter(Boolean).join(" ｜ "),
    },
    pass: verdicts.every((v) => v.pass),
    requiredFixes: [...new Set(verdicts.flatMap((v) => v.requiredFixes))],
  };
}

export interface LoopSpec<I, O, EI> {
  id: string;
  producer: NodeTemplate<I, O>;
  evaluator: EvaluatorNode<EI>;
  /** 对抗评审员：与主评审并行跑，全员通过才收敛（治单个评审员橡皮图章）。 */
  adversaries?: EvaluatorNode<EI>[];
  /** 把产出映射成评审输入。 */
  toEvalInput: (output: O, input: I, ctx: NodeRunContext) => EI;
  /** 闸门：基于评审结论决定放行/阻断/重派；默认 goalGate。 */
  gate?: (verdict: EvaluatorVerdict) => GateDecision;
  /** 收敛判定：默认 decision.action === "allow"。 */
  done?: (verdict: EvaluatorVerdict, decision: GateDecision) => boolean;
  /** 矫正：产出下一轮输入；默认沿用原输入（靠 priorVerdict 在 render 里自我修正）。 */
  correct?: (input: I, output: O, verdict: EvaluatorVerdict) => I;
  /** 迭代上限，默认 5。 */
  maxIterations?: number;
}

export interface LoopIteration<O> {
  iteration: number;
  produced: NodeResult<O>;
  reviewed: NodeResult<EvaluatorVerdict>;
  decision: GateDecision;
}

export interface LoopResult<O> {
  loopId: string;
  status: "converged" | "max_iterations" | "blocked" | "error";
  iterations: number;
  output?: O;
  verdict?: EvaluatorVerdict;
  decision?: GateDecision;
  history: LoopIteration<O>[];
}

export async function runLoop<I, O, EI>(
  spec: LoopSpec<I, O, EI>,
  initialInput: I,
  ctx: NodeRunContext,
  deps: NodeDeps,
): Promise<LoopResult<O>> {
  const gate = spec.gate ?? ((v) => goalGate(v));
  const done = spec.done ?? ((_v, d) => d.action === "allow");
  const maxIterations = spec.maxIterations ?? 5;

  const history: LoopIteration<O>[] = [];
  let input = initialInput;
  let priorVerdict: EvaluatorVerdict | undefined;

  for (let n = 1; n <= maxIterations; n++) {
    const iterCtx: NodeRunContext = { ...ctx, loopId: spec.id, iteration: n, priorVerdict };

    const produced = await runNode(spec.producer, input, iterCtx, deps);
    if (produced.status === "error" || produced.output === undefined) {
      return { loopId: spec.id, status: "error", iterations: n, output: produced.output, history };
    }

    const evalInput = spec.toEvalInput(produced.output, input, iterCtx);
    // 主评审 + 对抗评审并行跑；任一节点失败即 loop error。
    const evaluatorNodes = [spec.evaluator, ...(spec.adversaries ?? [])];
    const reviews = await Promise.all(
      evaluatorNodes.map((ev) => runNode(ev, evalInput, iterCtx, deps)),
    );
    if (reviews.some((r) => r.status === "error" || r.output === undefined)) {
      return { loopId: spec.id, status: "error", iterations: n, output: produced.output, history };
    }

    // 合议：全员通过才算过。history.reviewed 记主评审，决策用合并 verdict。
    const verdict = combineVerdicts(reviews.map((r) => r.output!));
    const decision = gate(verdict);
    history.push({ iteration: n, produced, reviewed: reviews[0], decision });

    if (done(verdict, decision)) {
      return { loopId: spec.id, status: "converged", iterations: n, output: produced.output, verdict, decision, history };
    }
    if (decision.action === "block") {
      return { loopId: spec.id, status: "blocked", iterations: n, output: produced.output, verdict, decision, history };
    }

    priorVerdict = verdict;
    input = spec.correct ? spec.correct(input, produced.output, verdict) : input;
  }

  const last = history[history.length - 1];
  return {
    loopId: spec.id,
    status: "max_iterations",
    iterations: maxIterations,
    output: last?.produced.output,
    verdict: priorVerdict ?? last?.reviewed.output,
    decision: last?.decision,
    history,
  };
}
