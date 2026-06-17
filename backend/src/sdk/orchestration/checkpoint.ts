/**
 * 单次流水线·断点续跑 checkpoint。
 *
 * 与审计用的 NodeRunStore 分家：这里按 runId + stepKey + inputHash 存**完整产出值**，
 * 只为「失败后已成功步骤不重算」服务。起步用本地 JSON 落 .data/runs/{runId}.json，
 * 接口稳定，后续可换 SQLite/Postgres 不动调用方。
 *
 * 详见 docs/单次流水线节点持久化与断点续跑设计.md
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { env } from "../../env.js";

/** 单个步骤的 checkpoint：只有 status==="ok" 才会被回放复用。 */
export interface StepCheckpoint<V = unknown> {
  stepKey: string;
  inputHash: string;
  status: "ok" | "failed";
  /** 完整产出值（ok 时必填）——回放的本体。 */
  value?: V;
  attempt: number;
  error?: string;
  updatedAt: string;
}

/** 一次运行的清单。 */
export interface RunManifest {
  runId: string;
  input: { requirement: string; goal: string };
  provider: string;
  cwd?: string;
  status: "running" | "done" | "failed" | "aborted";
  createdAt: string;
  updatedAt: string;
}

/** 落盘文件结构。 */
interface RunFile {
  manifest: RunManifest;
  steps: Record<string, StepCheckpoint>;
}

export interface CheckpointStore {
  loadRun(runId: string): Promise<RunFile | undefined>;
  saveManifest(manifest: RunManifest): Promise<void>;
  getStep(runId: string, stepKey: string): Promise<StepCheckpoint | undefined>;
  putStep(runId: string, step: StepCheckpoint): Promise<void>;
  listRuns(limit?: number): Promise<RunManifest[]>;
}

/** 生成运行 id。 */
export function makeRunId(): string {
  return `run_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

/** 稳定 JSON（键排序），用于算 inputHash，避免键序差异导致命中失败。 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortDeep((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

/** 对任意输入算稳定哈希。 */
export function hashInput(input: unknown): string {
  return createHash("sha1").update(stableStringify(input)).digest("hex").slice(0, 16);
}

const runsDir = path.join(env.dataDir, "runs");

function runPath(runId: string): string {
  return path.join(runsDir, `${runId}.json`);
}

async function readRun(runId: string): Promise<RunFile | undefined> {
  try {
    const raw = await fs.readFile(runPath(runId), "utf8");
    return JSON.parse(raw) as RunFile;
  } catch {
    return undefined;
  }
}

async function writeRun(file: RunFile): Promise<void> {
  await fs.mkdir(runsDir, { recursive: true });
  await fs.writeFile(runPath(file.manifest.runId), JSON.stringify(file, null, 2), "utf8");
}

/** 默认实现：本地 JSON 落 .data/runs/。 */
export function makeFileCheckpointStore(): CheckpointStore {
  return {
    async loadRun(runId) {
      return readRun(runId);
    },
    async saveManifest(manifest) {
      const existing = await readRun(manifest.runId);
      const file: RunFile = existing
        ? { ...existing, manifest }
        : { manifest, steps: {} };
      await writeRun(file);
    },
    async getStep(runId, stepKey) {
      const file = await readRun(runId);
      return file?.steps[stepKey];
    },
    async putStep(runId, step) {
      const file = (await readRun(runId)) ?? {
        manifest: {
          runId,
          input: { requirement: "", goal: "" },
          provider: "",
          status: "running" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        steps: {},
      };
      file.steps[step.stepKey] = step;
      file.manifest.updatedAt = new Date().toISOString();
      await writeRun(file);
    },
    async listRuns(limit = 50) {
      try {
        const names = await fs.readdir(runsDir);
        const runs: RunManifest[] = [];
        for (const name of names.filter((n) => n.endsWith(".json"))) {
          const file = await readRun(name.replace(/\.json$/, ""));
          if (file) runs.push(file.manifest);
        }
        return runs
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, limit);
      } catch {
        return [];
      }
    },
  };
}
