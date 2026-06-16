/**
 * 节点钩子的默认实现。persistHook 是默认链里最重要的一个：
 * 把每次节点执行落成一条 NodeRunRecord（只记摘要 + 小模型总结，不记 diff），
 * 库里攒下的就是「哪个节点、输入什么、产出什么」的可扫时间线，也是现成的 eval 数据集。
 */

import { randomUUID } from "node:crypto";
import type {
  EvaluatorVerdict,
  GateDecision,
  NodeHook,
  NodeOutputEvent,
  NodeRunRecord,
  NodeRunStore,
} from "./node.js";

/** 落库钩子：节点产出后写一条 NodeRunRecord。 */
export function persistHook(store: NodeRunStore): NodeHook {
  return {
    name: "persist",
    async onOutput(evt: NodeOutputEvent<unknown, unknown>): Promise<void> {
      const { result } = evt;
      const record: NodeRunRecord = {
        id: randomUUID(),
        nodeId: result.nodeId,
        kind: result.kind,
        loopId: evt.ctx.loopId,
        iteration: evt.ctx.iteration,
        inputDigest: digest(evt.input),
        outputSummary: result.summary ?? "(无总结)",
        verdict: evt.kind === "evaluator" ? (result.output as EvaluatorVerdict | undefined) : undefined,
        decision: evt.kind === "gate" ? (result.output as GateDecision | undefined) : undefined,
        status: result.status,
        model: result.model?.id,
        usage: result.usage,
        requestId: result.requestId,
        durationMs: result.durationMs,
        createdAt: new Date().toISOString(),
      };
      await store.append(record);
    },
  };
}

/** 日志钩子：把节点开始/结束打到 stdout，便于本地观察。 */
export function logHook(): NodeHook {
  return {
    name: "log",
    onInput(evt) {
      console.log(`[node] → ${evt.nodeId} (${evt.kind})`);
    },
    onOutput(evt) {
      const r = evt.result;
      console.log(`[node] ← ${r.nodeId} ${r.status} repairs=${r.repairs} ${r.durationMs}ms`);
    },
  };
}

/** 入参摘要：截断到可读长度，不存全量。 */
function digest(input: unknown, max = 280): string {
  let s: string;
  try {
    s = typeof input === "string" ? input : JSON.stringify(input);
  } catch {
    s = String(input);
  }
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
