/**
 * NodeRunStore 落地实现 —— 把每次节点执行的 NodeRunRecord 攒成可扫时间线，
 * 也是后续"评估蒸馏"（回归/eval 数据集）的原料底盘。
 *
 * - InMemoryNodeRunStore：进程内，测试 / 临时用。
 * - JsonlNodeRunStore：append-only JSONL 落盘，可审计、跨重启留存（连续性的最小落点）。
 *
 * 刻意不耦合 env：file 由调用方注入，方便用临时文件做 hermetic 单测。
 */

import { appendFile, readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { NodeRunRecord, NodeRunStore } from "./node.js";

type ListFilter = { loopId?: string; nodeId?: string; limit?: number };

function filtered(records: NodeRunRecord[], filter?: ListFilter): NodeRunRecord[] {
  let out = records;
  if (filter?.loopId) out = out.filter((r) => r.loopId === filter.loopId);
  if (filter?.nodeId) out = out.filter((r) => r.nodeId === filter.nodeId);
  if (filter?.limit !== undefined) out = out.slice(-filter.limit); // 取最近 N 条
  return out;
}

export class InMemoryNodeRunStore implements NodeRunStore {
  private records: NodeRunRecord[] = [];
  async append(record: NodeRunRecord): Promise<void> {
    this.records.push(record);
  }
  async list(filter?: ListFilter): Promise<NodeRunRecord[]> {
    return filtered(this.records, filter);
  }
  /** 测试便捷：全量快照。 */
  all(): NodeRunRecord[] {
    return [...this.records];
  }
}

export class JsonlNodeRunStore implements NodeRunStore {
  constructor(private readonly file: string) {}

  async append(record: NodeRunRecord): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    await appendFile(this.file, `${JSON.stringify(record)}\n`, "utf8");
  }

  async list(filter?: ListFilter): Promise<NodeRunRecord[]> {
    let text = "";
    try {
      text = await readFile(this.file, "utf8");
    } catch {
      return []; // 文件还不存在 = 空时间线
    }
    const records = text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as NodeRunRecord);
    return filtered(records, filter);
  }
}
