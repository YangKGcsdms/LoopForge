/**
 * 节点执行契约 —— 「传入内容 → 返回固定结构」的核心实现。
 *
 * runNode 不直接依赖 @cursor/sdk，而是依赖注入一个 Sender 边界：
 * 落地时把 Sender 接到 SdkProvider.send（内部走 Agent.send + run.wait）。
 * 这样契约与具体 SDK 解耦，单测时塞个假 Sender 就能跑。
 */

import type { Contract } from "./contract.js";
import type {
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

/** 发送原语的抽象边界。落地时 = (req) => provider 跑一次 Run。 */
export type Sender = (req: SendRequest) => Promise<SendResult>;

/** runNode 的依赖注入：send 必给，summarize（小模型总结器）/ 附加钩子可选。 */
export interface NodeDeps {
  send: Sender;
  /** 小模型总结器；省略则不生成 summary。 */
  summarize?: Sender;
  /** 全局附加钩子（如 persistHook），与 template.hooks 合并。 */
  hooks?: NodeHook[];
  /** 按节点路由模型（按用途/难度）：返回覆盖模型，省略则用 template.model。 */
  resolveModel?: (info: { id: string; kind: NodeKind; purpose?: NodePurpose }) => ModelRef | undefined;
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
  let user = baseUser;
  let repairs = 0;
  let totalMs = 0;
  let last: SendResult | undefined;
  let value: O | undefined;
  let ok = false;
  let errored: string | undefined;

  try {
    while (true) {
      const sent = await deps.send({
        system,
        user,
        model,
        mode: template.mode,
        tools: template.tools,
        cwd: ctx.workspace?.cwd,
      });
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
    error: errored,
  };

  const outEvt: NodeOutputEvent<I, O> = { nodeId: template.id, kind: template.kind, ctx, input, result };
  for (const h of hooks) await h.onOutput?.(outEvt);

  return result;
}
