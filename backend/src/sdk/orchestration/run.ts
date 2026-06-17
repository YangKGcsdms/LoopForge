/**
 * 节点执行契约 —— 「传入内容 → 返回固定结构」的核心实现。
 *
 * runNode 不直接依赖 @cursor/sdk，而是依赖注入一个 Sender 边界：
 * 落地时把 Sender 接到 SdkProvider.send（内部走 Agent.send + run.wait）。
 * 这样契约与具体 SDK 解耦，单测时塞个假 Sender 就能跑。
 */

import type { Contract } from "./contract.js";
import type {
  ActEvidence,
  Mode,
  ModelRef,
  NodeHook,
  NodeInputEvent,
  NodeKind,
  NodePurpose,
  NodeOutputEvent,
  NodeResult,
  NodeRunContext,
  NodeTemplate,
  TokenUsage,
  Verification,
} from "./node.js";

/** 底层发送请求：把 SDK 的 send 收口成这个最小形状。 */
export interface SendRequest {
  system: string;
  user: string;
  model?: ModelRef;
  mode?: Mode;
  tools?: string[];
  /** 工作目录：项目指定的代码目录，落地映射成 Agent 的 local.cwd。 */
  cwd?: string;
}

/** 底层发送结果：对应 run.wait() 的 result + 元数据。 */
export interface SendResult {
  result: string;
  requestId?: string;
  usage?: TokenUsage;
  model?: ModelRef;
  durationMs: number;
}

/** think 发送原语的抽象边界。落地时 = (req) => provider.send（只读单发）。 */
export type Sender = (req: SendRequest) => Promise<SendResult>;

/**
 * 内部 SDK session 的流式事件（镜像 sdk AgentStreamEvent，编排层保持解耦）。
 * act 跑 agentic loop 时实时往外抛，供前端呈现"类 GUI Claude Code"的运行中输出。
 */
export type ActStreamEvent =
  | { kind: "text"; delta: string }
  | { kind: "thinking"; delta: string }
  | { kind: "tool_use"; tool: string; input: unknown }
  | { kind: "tool_result"; ok: boolean | null; preview?: string }
  | { kind: "ask_human"; question: string };

/** act 请求：在 cwd 下开真工具跑 agentic loop。approve/askHuman/tools 已在构造 ActSender 时闭包绑定。 */
export interface ActRequest {
  system: string;
  user: string;
  model?: ModelRef;
  cwd: string;
  tools?: string[];
  /** 内部 SDK session 流式事件回调（runNode 注入，带节点上下文转发到 SSE）。 */
  onMessage?: (event: ActStreamEvent) => void;
}

/** act 结果 = send 结果 + 采集到的证据。 */
export interface ActResult extends SendResult {
  evidence: ActEvidence;
}

/** act 原语的抽象边界。落地时 = (req) => provider.act（真工具+审批+证据）。 */
export type ActSender = (req: ActRequest) => Promise<ActResult>;

/** 独立校验器：在 cwd 下跑 git diff + 配置的 test/typecheck，返回地面真值。 */
export type Verifier = (cwd: string) => Promise<Verification>;

/** runNode 的依赖注入：send 必给，act/verify（act 节点用）、summarize、hooks 可选。 */
export interface NodeDeps {
  send: Sender;
  /** act 节点执行原语；省略时 act 节点降级走 send（无证据，并告警）。 */
  act?: ActSender;
  /** act 后的独立校验器；省略时 act 节点无 verification（评审只能靠 evidence）。 */
  verify?: Verifier;
  /** 小模型总结器；省略则不生成 summary。 */
  summarize?: Sender;
  /** 全局附加钩子（如 persistHook），与 template.hooks 合并。 */
  hooks?: NodeHook[];
  /** 按节点路由模型（按用途/难度）：返回覆盖模型，省略则用 template.model。 */
  resolveModel?: (info: { id: string; kind: NodeKind; purpose?: NodePurpose }) => ModelRef | undefined;
  /** act 节点内部 SDK session 的流式事件回调（带节点上下文），落地转 SSE 给前端实时展示。 */
  onActMessage?: (info: { nodeId: string; kind: NodeKind; iteration?: number; event: ActStreamEvent }) => void;
}

function instruction<O>(c: Contract<O>): string {
  return `严格只输出符合以下契约的 JSON，不要任何解释或 markdown：\n${c.describe()}`;
}

function safeStringify(v: unknown): string {
  try {
    return typeof v === "string" ? v : JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/**
 * 执行一个节点：组装提示词 → send → 解析校验 → 失败带错误修复重试 → 钩子 → 结果。
 */
export async function runNode<I, O>(
  template: NodeTemplate<I, O>,
  input: I,
  ctx: NodeRunContext,
  deps: NodeDeps,
): Promise<NodeResult<O>> {
  const hooks = [...(template.hooks ?? []), ...(deps.hooks ?? [])];
  const model = deps.resolveModel?.({ id: template.id, kind: template.kind, purpose: template.purpose }) ?? template.model;
  const prompt = template.render(input, ctx);
  const system = [template.role, prompt.static, instruction(template.output)]
    .filter(Boolean)
    .join("\n\n");
  const baseUser = [prompt.dynamic, `输入：\n${safeStringify(input)}`].filter(Boolean).join("\n\n");

  const inEvt: NodeInputEvent<I> = { nodeId: template.id, kind: template.kind, ctx, input, prompt };
  for (const h of hooks) await h.onInput?.(inEvt);

  const maxRepairs = template.maxRepairs ?? 2;
  // act 节点：有 deps.act 才走 act 原语（真工具+证据）；否则降级 send（无证据）并告警一次。
  const isAct = template.exec === "act" && !!deps.act;
  if (template.exec === "act" && !deps.act) {
    console.warn(`[runNode] act 节点 ${template.id} 无 deps.act，降级走 send（无证据，无独立校验）`);
  }
  const cwd = ctx.workspace?.cwd ?? process.cwd();
  let user = baseUser;
  let repairs = 0;
  let totalMs = 0;
  let last: SendResult | undefined;
  let evidence: ActEvidence | undefined;
  let value: O | undefined;
  let ok = false;
  let errored: string | undefined;

  try {
    while (true) {
      let sent: SendResult;
      if (isAct) {
        // 把 act 内部 SDK 的流式事件挂上节点上下文，转给 deps.onActMessage（落地推 SSE）。
        const onMessage = deps.onActMessage
          ? (event: ActStreamEvent) =>
              deps.onActMessage!({ nodeId: template.id, kind: template.kind, iteration: ctx.iteration, event })
          : undefined;
        const r = await deps.act!({ system, user, model, cwd, tools: template.tools, onMessage });
        evidence = r.evidence; // 留最后一轮的证据
        sent = r;
      } else {
        sent = await deps.send({
          system,
          user,
          model,
          mode: template.mode,
          tools: template.tools,
          cwd: ctx.workspace?.cwd,
        });
      }
      last = sent;
      totalMs += sent.durationMs;

      const parsed = template.output.parse(sent.result);
      if (parsed.ok) {
        value = parsed.value;
        ok = true;
        break;
      }
      if (repairs >= maxRepairs) break;
      repairs++;
      user = `${baseUser}\n\n上一次输出不符合契约，错误：\n- ${parsed.errors.join("\n- ")}\n请仅输出符合契约的 JSON。`;
    }
  } catch (e) {
    errored = e instanceof Error ? e.message : String(e);
  }

  // act 节点：成功后跑独立校验（git diff + test/typecheck），拿地面真值。verify 失败不阻断主结果。
  let verification: Verification | undefined;
  if (ok && isAct && deps.verify) {
    try {
      verification = await deps.verify(cwd);
    } catch (e) {
      console.warn(`[runNode] verify 失败（${template.id}）：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  let summary: string | undefined;
  if (ok && deps.summarize) {
    try {
      const s = await deps.summarize({
        system: "用一句话（不超过 30 字）总结这个节点做了什么、产出了什么。",
        user: safeStringify(value),
      });
      summary = s.result.trim();
      totalMs += s.durationMs;
    } catch {
      // 总结失败不影响主结果
    }
  }

  const result: NodeResult<O> = {
    nodeId: template.id,
    kind: template.kind,
    status: errored ? "error" : ok ? "ok" : "repair_exhausted",
    output: ok ? value : undefined,
    raw: last?.result,
    repairs,
    model: last?.model ?? model,
    usage: last?.usage,
    requestId: last?.requestId,
    durationMs: totalMs,
    summary,
    evidence,
    verification,
    error: errored,
  };

  const outEvt: NodeOutputEvent<I, O> = { nodeId: template.id, kind: template.kind, ctx, input, prompt, result };
  for (const h of hooks) await h.onOutput?.(outEvt);

  return result;
}
