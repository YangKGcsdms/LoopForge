/**
 * 自驱开发流水线 —— 把"难度评估 → 拆解出 N 个 TODO → 逐 TODO 自循环开发"编排成一个可复用函数。
 * 与 HTTP 解耦：路由只负责装配 sender/catalog 并把事件透传给 SSE。
 */

import { runNode, type ActSender, type Sender, type Verifier } from "./run.js";
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
  const { send, act, verify, summarize, providerId, workspace, hooks = [], onEvent } = deps;
  const emit = (event: string, data: unknown) => onEvent?.(event, data);

  // 路由策略先定好（按 provider），难度评估节点也要按它路由模型，否则会用错 provider 的模型。
  const resolver = resolverFor(providerId);
  const routing = routingScheme(providerId);

  // 1) 前置难度评估
  emit("phase", { name: "难度评估" });
  const assess = await runNode(
    difficultyAssessor,
    { task: input.requirement, goal: input.goal },
    { workspace },
    { send, hooks, resolveModel: resolver },
  );
  const difficulty: Difficulty = assess.output?.difficulty ?? "medium";
  emit("difficulty", { value: difficulty, reason: assess.output?.reason ?? null });
  emit("routing", routing);

  // 2) 出方案（强化开端：先给整体方案，再拆解）
  emit("phase", { name: "出方案" });
  const planRun = await runNode(planNode, { requirement: input.requirement, goal: input.goal, difficulty }, { workspace }, {
    send,
    summarize,
    resolveModel: resolver,
    hooks,
  });
  const plan = planRun.output ?? null;
  const planSummary = plan ? formatPlan(plan) : undefined;

  // 3) 依据方案拆解 loop 出 TODO
  emit("phase", { name: "拆解 TODO 列表" });
  const dec = await runLoop(decomposeLoop, { requirement: input.requirement, goal: input.goal, planSummary }, { workspace }, {
    send,
    summarize,
    resolveModel: resolver,
    hooks,
  });
  const subtasks = dec.output?.subtasks ?? [];
  emit("todos", { subtasks, decomposeStatus: dec.status });

  // 4) 逐个 TODO 自循环开发
  const todos: PipelineTodo[] = [];
  let developed = 0;
  for (const task of subtasks) {
    emit("phase", { name: `开发：${task.id} ${task.title}` });
    const dev = await runLoop(devLoopSpec(input.goal), { task }, { workspace }, {
      send,
      act, // devStep 是 act 节点：真改代码 + 审批 + 证据
      verify, // act 后独立校验，喂给 devReviewer/devRedTeam 判地面真值
      summarize,
      resolveModel: resolver,
      hooks,
    });
    if (dev.status === "converged") developed += 1;
    todos.push({ subtask: task, status: dev.status, iterations: dev.iterations });
  }
  emit("done", { decompose: dec.status, todos: subtasks.length, developed });

  return {
    difficulty: { value: difficulty, reason: assess.output?.reason ?? null },
    routing,
    plan,
    decompose: { status: dec.status, iterations: dec.iterations, subtasks },
    todos,
    developed,
  };
}
