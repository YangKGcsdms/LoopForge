/**
 * 自驱开发流水线 —— 把"难度评估 → 拆解出 N 个 TODO → 逐 TODO 自循环开发"编排成一个可复用函数。
 * 与 HTTP 解耦：路由只负责装配 sender/catalog 并把事件透传给 SSE。
 */

import { runNode, type ActSender, type NodeDeps, type Sender, type Verifier } from "./run.js";
import { runLoop, type LoopSpec } from "./loop.js";
import {
  difficultyAssessor,
  resolverFor,
  routingScheme,
  type Difficulty,
} from "./nodes/router.js";
import { planNode, type PlanOutput } from "./nodes/plan.js";
import {
  decomposeNode,
  decomposeReviewer,
  type DecomposeInput,
  type DecomposeOutput,
  type Subtask,
} from "./nodes/decompose.js";
import {
  devStepNode,
  devReviewer,
  devRedTeam,
  type DevReviewInput,
  type DevStepInput,
  type DevStepOutput,
} from "./nodes/dev.js";
import type { NodeHook, NodePurpose, Workspace } from "./node.js";
import { hashInput, type CheckpointStore } from "./checkpoint.js";

const decomposeLoop: LoopSpec<DecomposeInput, DecomposeOutput, DecomposeOutput> = {
  id: "decompose-loop",
  producer: decomposeNode,
  evaluator: decomposeReviewer,
  toEvalInput: (o) => o,
  maxIterations: 4,
};

/** 开发 loop：devStep 实现子任务 → devReviewer 双维度评审 → 矫正收敛。 */
function devLoopSpec(goal: string): LoopSpec<DevStepInput, DevStepOutput, DevReviewInput> {
  return {
    id: "dev-loop",
    producer: devStepNode,
    evaluator: devReviewer,
    adversaries: [devRedTeam], // 对抗评审：devReviewer + 红队都判 pass 才收敛
    toEvalInput: (step, input) => ({ task: input.task, step, goal }),
    maxIterations: 3,
  };
}

/** 把整体方案压成一段文本，喂给拆解节点当上下文。 */
function formatPlan(p: PlanOutput): string {
  return [
    `思路：${p.approach}`,
    p.keyDecisions.length ? `关键决策：${p.keyDecisions.join("；")}` : "",
    p.phases.length ? `阶段：${p.phases.join(" → ")}` : "",
    p.acceptance.length ? `验收：${p.acceptance.join("；")}` : "",
    p.risks.length ? `风险：${p.risks.join("；")}` : "",
    p.openQuestions.length ? `待澄清：${p.openQuestions.join("；")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface PipelineInput {
  requirement: string;
  goal: string;
}

export interface PipelineDeps {
  send: Sender;
  /** act 节点（devStep/testWriter）执行原语；省略则降级 send（无证据）。 */
  act?: ActSender;
  /** act 后独立校验器（git diff + test/typecheck）。 */
  verify?: Verifier;
  summarize?: Sender;
  /** 选哪套路由策略：claude-agent（cursor 已冻结）。 */
  providerId: string;
  workspace?: Workspace;
  hooks?: NodeHook[];
  /** 流式事件回调（phase / difficulty / todos / done）。 */
  onEvent?: (event: string, data: unknown) => void;
  /** act 节点内部 SDK session 的流式事件回调（落地转 SSE node-stream，前端实时展示运行中节点）。 */
  onActMessage?: NodeDeps["onActMessage"];
  /** 断点续跑：给定 store + runId 后，已成功步骤直接读缓存跳过模型调用。 */
  checkpoint?: { store: CheckpointStore; runId: string };
}

export interface PipelineTodo {
  subtask: Subtask;
  status: string;
  iterations: number;
}

export interface PipelineResult {
  difficulty: { value: Difficulty; reason: string | null };
  /** 路由方案：用途 → 实际模型 id（出方案=opus、执行=composer、评审=sonnet、测试=kimi…）。 */
  routing: Record<NodePurpose, string>;
  /** 强化开端：整体实现方案（spec）。 */
  plan: PlanOutput | null;
  decompose: { status: string; iterations: number; subtasks: Subtask[] };
  todos: PipelineTodo[];
  developed: number;
}

export async function runPipeline(input: PipelineInput, deps: PipelineDeps): Promise<PipelineResult> {
  // 合并两线：act/verify（接地气 act 节点）+ checkpoint（断点续跑）同时在场。
  const { send, act, verify, summarize, providerId, workspace, hooks = [], onEvent, onActMessage, checkpoint } = deps;
  const emit = (event: string, data: unknown) => onEvent?.(event, data);

  /**
   * 步骤 memo：命中 checkpoint（同 stepKey + 同 inputHash + status=ok）则跳过 compute，直接返回缓存值。
   * 否则真跑——compute 返回 { value, ok }，ok 才落成功 checkpoint（可被续跑复用），
   * 否则落 failed（续跑必重算）。注意 runNode/runLoop 失败不抛异常而是回 status，
   * 故成败由 compute 显式给出 ok，而非靠 try/catch。无 checkpoint 时退化为直接 compute。
   */
  async function memoStep<V>(
    stepKey: string,
    stepInput: unknown,
    compute: () => Promise<{ value: V; ok: boolean; error?: string }>,
  ): Promise<V> {
    if (!checkpoint) return (await compute()).value;
    const inputHash = hashInput(stepInput);
    const hit = await checkpoint.store.getStep(checkpoint.runId, stepKey);
    if (hit?.status === "ok" && hit.inputHash === inputHash) {
      emit("step-cached", { stepKey });
      return hit.value as V;
    }
    const prevAttempt = hit?.attempt ?? 0;
    try {
      const { value, ok, error } = await compute();
      await checkpoint.store.putStep(checkpoint.runId, {
        stepKey,
        inputHash,
        status: ok ? "ok" : "failed",
        value: ok ? value : undefined,
        attempt: prevAttempt + 1,
        error: ok ? undefined : error,
        updatedAt: new Date().toISOString(),
      });
      return value;
    } catch (e) {
      // compute 自身抛异常（非预期）：落 failed 并继续抛出
      await checkpoint.store.putStep(checkpoint.runId, {
        stepKey,
        inputHash,
        status: "failed",
        attempt: prevAttempt + 1,
        error: e instanceof Error ? e.message : String(e),
        updatedAt: new Date().toISOString(),
      });
      throw e;
    }
  }

  // 路由策略先定好（按 provider），难度评估节点也要按它路由模型，否则会用错 provider 的模型。
  const resolver = resolverFor(providerId);
  const routing = routingScheme(providerId);

  // 1) 前置难度评估
  emit("phase", { name: "难度评估" });
  const assessVal = await memoStep(
    "assess",
    { task: input.requirement, goal: input.goal },
    async () => {
      const assess = await runNode(
        difficultyAssessor,
        { task: input.requirement, goal: input.goal },
        { workspace },
        { send, hooks, resolveModel: resolver },
      );
      return {
        value: {
          difficulty: (assess.output?.difficulty ?? "medium") as Difficulty,
          reason: assess.output?.reason ?? null,
        },
        ok: assess.status === "ok",
        error: assess.error,
      };
    },
  );
  const difficulty: Difficulty = assessVal.difficulty;
  emit("difficulty", { value: difficulty, reason: assessVal.reason });
  emit("routing", routing);

  // 2) 出方案（强化开端：先给整体方案，再拆解）
  emit("phase", { name: "出方案" });
  const plan = await memoStep<PlanOutput | null>(
    "plan",
    { requirement: input.requirement, goal: input.goal, difficulty },
    async () => {
      const planRun = await runNode(
        planNode,
        { requirement: input.requirement, goal: input.goal, difficulty },
        { workspace },
        { send, summarize, resolveModel: resolver, hooks },
      );
      return { value: planRun.output ?? null, ok: planRun.status === "ok", error: planRun.error };
    },
  );
  const planSummary = plan ? formatPlan(plan) : undefined;

  // 3) 依据方案拆解 loop 出 TODO
  emit("phase", { name: "拆解 TODO 列表" });
  const decVal = await memoStep(
    "decompose",
    { requirement: input.requirement, goal: input.goal, planSummary },
    async () => {
      const dec = await runLoop(
        decomposeLoop,
        { requirement: input.requirement, goal: input.goal, planSummary },
        { workspace },
        { send, summarize, resolveModel: resolver, hooks },
      );
      return {
        value: {
          status: dec.status,
          iterations: dec.iterations,
          subtasks: dec.output?.subtasks ?? [],
        },
        ok: dec.status === "converged",
      };
    },
  );
  const subtasks = decVal.subtasks;
  emit("todos", { subtasks, decomposeStatus: decVal.status });

  // 4) 逐个 TODO 自循环开发（每个 TODO 一个 checkpoint，已收敛的不重算）
  const todos: PipelineTodo[] = [];
  let developed = 0;
  for (const task of subtasks) {
    emit("phase", { name: `开发：${task.id} ${task.title}` });
    // 合并：memoStep 续跑包装（已收敛的 TODO 不重算）⊕ act/verify（devStep 真改代码 + 接地气评审）。
    const devVal = await memoStep(
      `dev:${task.id}`,
      { task, goal: input.goal },
      async () => {
        const dev = await runLoop(devLoopSpec(input.goal), { task }, { workspace }, {
          send,
          act, // devStep 是 act 节点：真改代码 + 证据（默认全自动，纠结才问）
          verify, // act 后独立校验，喂给 devReviewer/devRedTeam 判地面真值
          summarize,
          resolveModel: resolver,
          onActMessage, // 内部 SDK session 流式事件 → SSE node-stream
          hooks,
        });
        // 只有收敛才算成功；未收敛/阻断/出错都落 failed，续跑重算该 TODO
        return { value: { status: dev.status, iterations: dev.iterations }, ok: dev.status === "converged" };
      },
    );
    if (devVal.status === "converged") developed += 1;
    todos.push({ subtask: task, status: devVal.status, iterations: devVal.iterations });
  }
  emit("done", { decompose: decVal.status, todos: subtasks.length, developed });

  return {
    difficulty: { value: difficulty, reason: assessVal.reason },
    routing,
    plan,
    decompose: { status: decVal.status, iterations: decVal.iterations, subtasks },
    todos,
    developed,
  };
}
