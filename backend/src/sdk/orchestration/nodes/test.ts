/**
 * 单测 loop 的产出节点：在指定工作目录下为子任务补测试。
 * 评审复用 devReviewer 那套双维度判定（看测试是否真覆盖、是否真过）。
 */

import { defineContract, type ContractResult } from "../contract.js";
import type { NodeTemplate } from "../node.js";
import type { Subtask } from "./decompose.js";

export interface TestWriterInput {
  task: Subtask;
}

export interface TestWriterOutput {
  testFiles: string[];
  cases: string[];
  summary: string;
}

const testWriterContract = defineContract<TestWriterOutput>({
  name: "test-writer.output",
  schema: `{ "testFiles": string[], "cases": string[], "summary": string }`,
  validate(data): ContractResult<TestWriterOutput> {
    const d = data as Partial<TestWriterOutput>;
    const errors: string[] = [];
    if (!Array.isArray(d.testFiles)) errors.push("testFiles 必须是数组");
    if (!Array.isArray(d.cases)) errors.push("cases 必须是数组");
    if (typeof d.summary !== "string") errors.push("summary 必须是 string");
    if (errors.length) return { ok: false, errors };
    return { ok: true, value: data as TestWriterOutput };
  },
});

/** 测试编写：在 ctx.workspace.cwd 下补覆盖充分的测试，写完跑一遍确认通过。 */
export const testWriterNode: NodeTemplate<TestWriterInput, TestWriterOutput> = {
  id: "test-writer",
  kind: "producer",
  purpose: "test",
  role: "你是测试工程师，为给定改动补充覆盖充分的测试。",
  output: testWriterContract,
  mode: "agent",
  tools: ["read", "write", "shell"],
  render(input, ctx) {
    const cwd = ctx.workspace?.cwd ?? process.cwd();
    return {
      static: `在工作目录 ${cwd} 下为子任务补测试，覆盖正常与边界路径，写完跑一遍确认通过。`,
      dynamic: `子任务[${input.task.id}]：${input.task.title}\n验收标准：${input.task.acceptance}`,
    };
  },
};
