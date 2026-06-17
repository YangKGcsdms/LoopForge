/**
 * 证据 reducer —— 把 Claude Agent SDK 的消息流（tool_use / tool_result）聚合成 AgentEvidence。
 *
 * 刻意写成「纯函数 + 可变累加器」：act() 边消费流边 applyMessage，结束 finalize。
 * 这样核心逻辑能用合成消息做 hermetic 单测，不依赖真 SDK、不计费。
 * 解析对 SDK 消息形状做防御（content 可能在 message.content 或顶层 content；tool_result 内容可能是
 * 字符串或 block 数组），形状偶有出入时降级为部分证据而非崩溃。
 */

import type { AgentEvidence, ToolCallRecord } from "../types.js";

/** 改文件类工具：从其入参里抠出 file_path。 */
const FILE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit", "Update"]);

export interface EvidenceAcc {
  toolCalls: ToolCallRecord[];
  filesTouched: string[];
  bashRuns: Array<{ command: string; ok: boolean | null; output?: string }>;
  /** tool_use_id → 该调用在 toolCalls/bashRuns 里的下标，用于 tool_result 回填。 */
  _pending: Map<string, { callIndex: number; bashIndex?: number }>;
}

export function newEvidence(): EvidenceAcc {
  return { toolCalls: [], filesTouched: [], bashRuns: [], _pending: new Map() };
}

function blocksOf(message: any): any[] {
  const content = message?.message?.content ?? message?.content;
  return Array.isArray(content) ? content : [];
}

function filePathOf(input: any): string | undefined {
  const p = input?.file_path ?? input?.path ?? input?.notebook_path;
  return typeof p === "string" && p ? p : undefined;
}

function addUnique(arr: string[], v: string): void {
  if (!arr.includes(v)) arr.push(v);
}

/** tool_result 的 content 可能是 string 或 [{type:'text',text}]；压成一行预览（截断）。 */
function previewResult(content: unknown, max = 600): string {
  let s: string;
  if (typeof content === "string") s = content;
  else if (Array.isArray(content)) {
    s = content.map((b: any) => (typeof b?.text === "string" ? b.text : typeof b === "string" ? b : "")).join("");
  } else {
    try {
      s = JSON.stringify(content);
    } catch {
      s = String(content);
    }
  }
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** 消费一条 SDK 消息，累加证据。 */
export function applyMessage(acc: EvidenceAcc, message: any): void {
  const type = message?.type;
  if (type === "assistant") {
    for (const block of blocksOf(message)) {
      if (block?.type !== "tool_use" || typeof block?.name !== "string") continue;
      const callIndex = acc.toolCalls.length;
      acc.toolCalls.push({ tool: block.name, input: block.input, ok: null });

      const fp = FILE_TOOLS.has(block.name) ? filePathOf(block.input) : undefined;
      if (fp) addUnique(acc.filesTouched, fp);

      let bashIndex: number | undefined;
      if (block.name === "Bash" && typeof block.input?.command === "string") {
        bashIndex = acc.bashRuns.length;
        acc.bashRuns.push({ command: block.input.command, ok: null });
      }
      if (typeof block.id === "string") acc._pending.set(block.id, { callIndex, bashIndex });
    }
    return;
  }
  if (type === "user") {
    for (const block of blocksOf(message)) {
      if (block?.type !== "tool_result" || typeof block?.tool_use_id !== "string") continue;
      const p = acc._pending.get(block.tool_use_id);
      if (!p) continue;
      const ok = block.is_error ? false : true;
      const preview = previewResult(block.content);
      acc.toolCalls[p.callIndex].ok = ok;
      acc.toolCalls[p.callIndex].resultPreview = preview;
      if (p.bashIndex !== undefined) {
        acc.bashRuns[p.bashIndex].ok = ok;
        acc.bashRuns[p.bashIndex].output = preview;
      }
      acc._pending.delete(block.tool_use_id);
    }
  }
}

/** 收口成不可变的 AgentEvidence（剥掉内部 _pending）。 */
export function finalizeEvidence(acc: EvidenceAcc): AgentEvidence {
  return { toolCalls: acc.toolCalls, filesTouched: acc.filesTouched, bashRuns: acc.bashRuns };
}

/** 便捷：一次性把整段消息折叠成证据（测试 / 离线用）。 */
export function collectEvidence(messages: Iterable<any>): AgentEvidence {
  const acc = newEvidence();
  for (const m of messages) applyMessage(acc, m);
  return finalizeEvidence(acc);
}
