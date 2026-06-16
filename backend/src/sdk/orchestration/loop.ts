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

export interface LoopSpec<I, O, EI> {
  id: string;
  producer: NodeTemplate<I, O>;
  evaluator: EvaluatorNode<EI>;
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
    const reviewed = await runNode(spec.evaluator, evalInput, iterCtx, deps);
    if (reviewed.status === "error" || reviewed.output === undefined) {
      return { loopId: spec.id, status: "error", iterations: n, output: produced.output, history };
    }

    const verdict = reviewed.output;
    const decision = gate(verdict);
    history.push({ iteration: n, produced, reviewed, decision });

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
    verdict: last?.reviewed.output,
    decision: last?.decision,
    history,
  };
}
