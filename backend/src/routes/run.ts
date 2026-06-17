import { Router } from "express";
import { join } from "node:path";
import { getApiKey } from "../config/store.js";
import { env } from "../env.js";
import {
  runPipeline,
  makeMockSender,
  makeMockActSender,
  senderFor,
  actSenderFor,
  makeVerifier,
  persistHook,
  JsonlNodeRunStore,
  makeFileCheckpointStore,
  makeRunId,
  type ActSender,
  type CheckpointStore,
  type NodeHook,
  type RunManifest,
  type Sender,
  type Verifier,
  type VerifyCheckSpec,
  type Workspace,
} from "../sdk/orchestration/index.js";
import { runtimeApprover, SAFE_TOOLS } from "../sdk/approval/index.js";

export const runRouter = Router();

type Deps = { send: Sender; act?: ActSender; verify?: Verifier };

/** 断点续跑用的 checkpoint 单例（与审计用的 NodeRunStore 分家，各落各的）。 */
const checkpointStore: CheckpointStore = makeFileCheckpointStore();

/** 取已有 run 或新建：resume 命中已存在的运行则复用其 runId，否则建新。 */
async function resolveRun(
  resume: string | undefined,
  input: { requirement: string; goal: string },
  provider: string,
  cwd?: string,
): Promise<RunManifest> {
  if (resume) {
    const existing = await checkpointStore.loadRun(resume);
    if (existing) {
      const manifest: RunManifest = { ...existing.manifest, status: "running", updatedAt: new Date().toISOString() };
      await checkpointStore.saveManifest(manifest);
      return manifest;
    }
  }
  const now = new Date().toISOString();
  const manifest: RunManifest = {
    runId: makeRunId(),
    input,
    provider,
    cwd,
    status: "running",
    createdAt: now,
    updatedAt: now,
  };
  await checkpointStore.saveManifest(manifest);
  return manifest;
}

/**
 * 落盘审计单例 —— 真跑的每条 NodeRunRecord append 到 .data/node-runs.jsonl，
 * 攒成可扫时间线 + 评估蒸馏的原料。dryRun（mock 数据）不落盘，免污染 eval 数据集。
 * 注：这与 checkpointStore 是两套——审计记摘要时间线，checkpoint 存全量值供续跑。
 */
let runStore: JsonlNodeRunStore | undefined;
function persistHooks(dryRun: boolean): NodeHook[] {
  if (dryRun) return [];
  runStore ??= new JsonlNodeRunStore(join(env.dataDir, "node-runs.jsonl"));
  return [persistHook(runStore)];
}

/**
 * 装配执行原语：think(send) + act(act-runner，绑定飞书审批) + verify(独立校验)。
 * dryRun 用 mock；真跑按 provider 用 SK（claude-agent 可空，走本机登录态）。Cursor 已冻结直接拒绝。
 */
async function resolveDeps(
  dryRun: boolean,
  provider: string,
  cwd?: string,
  verifyChecks?: VerifyCheckSpec[],
): Promise<Deps | { error: string }> {
  if (provider === "cursor") {
    return { error: "Cursor 已冻结，项目只走 Claude 路线（provider=claude-agent）。" };
  }
  if (dryRun) {
    const mock = makeMockSender();
    return { send: mock, act: makeMockActSender(mock) };
  }
  const apiKey = await getApiKey(provider);
  if (!apiKey && provider !== "claude-agent") {
    return { error: "未配置 SK，请用 dryRun 或先在 SK 配置页填入。" };
  }
  const key = apiKey ?? "";
  return {
    // think 节点：只读单发。
    send: senderFor(provider, key, { defaultCwd: cwd }),
    // act 节点：真工具 + 安全工具自动放行，Bash 等走飞书长连接审批。
    act: actSenderFor(provider, key, { defaultCwd: cwd, allowedTools: SAFE_TOOLS, approve: runtimeApprover() }),
    // act 后独立校验：git diff + 请求里配置的 test/typecheck 命令（拿地面真值）。
    verify: makeVerifier({ checks: verifyChecks }),
  };
}

/** 解析请求里可选的独立校验命令（act 后跑，拿地面真值）。 */
function parseVerifyChecks(raw: unknown): VerifyCheckSpec[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const checks = raw
    .filter((c): c is { name?: unknown; command?: unknown } => !!c && typeof c === "object")
    .filter((c) => typeof c.command === "string")
    .map((c, i) => ({ name: typeof c.name === "string" ? c.name : `check-${i + 1}`, command: c.command as string }));
  return checks.length ? checks : undefined;
}

function parseBody(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const cwd = typeof b.cwd === "string" && b.cwd.trim() ? b.cwd.trim() : undefined;
  const provider = typeof b.provider === "string" ? b.provider : "claude-agent";
  const resume = typeof b.resume === "string" && b.resume.trim() ? b.resume.trim() : undefined;
  return {
    requirement: b.requirement,
    goal: b.goal,
    cwd,
    provider,
    dryRun: b.dryRun !== false,
    verifyChecks: parseVerifyChecks(b.verifyChecks),
    resume,
  };
}

/** 非流式：POST /api/run/pipeline */
runRouter.post("/pipeline", async (req, res) => {
  const { requirement, goal, cwd, provider, dryRun, verifyChecks, resume } = parseBody(req.body);
  if (typeof requirement !== "string" || typeof goal !== "string") {
    return res.status(400).json({ error: "missing_requirement_or_goal" });
  }
  const d = await resolveDeps(dryRun, provider, cwd, verifyChecks);
  if ("error" in d) return res.status(400).json({ error: "no_api_key", detail: d.error });
  const workspace: Workspace | undefined = cwd ? { cwd } : undefined;
  const manifest = await resolveRun(resume, { requirement, goal }, provider, cwd);
  try {
    const result = await runPipeline({ requirement, goal }, {
      send: d.send,
      act: d.act,
      verify: d.verify,
      summarize: d.send,
      providerId: provider,
      workspace,
      hooks: persistHooks(dryRun), // 真跑落盘审计；dryRun 不落
      checkpoint: { store: checkpointStore, runId: manifest.runId }, // 断点续跑
    });
    await checkpointStore.saveManifest({ ...manifest, status: "done", updatedAt: new Date().toISOString() });
    res.json({ dryRun, runId: manifest.runId, ...result });
  } catch (e) {
    await checkpointStore.saveManifest({ ...manifest, status: "failed", updatedAt: new Date().toISOString() });
    res.status(500).json({ error: "pipeline_failed", runId: manifest.runId, message: e instanceof Error ? e.message : String(e) });
  }
});

/** 运行历史：GET /api/run/history */
runRouter.get("/history", async (_req, res) => {
  res.json({ runs: await checkpointStore.listRuns() });
});

interface DetailSubtask {
  id: string;
  title: string;
  estimateHours: number;
  acceptance: string;
}

/** 单次运行详情：GET /api/run/detail/:runId —— 含任务列表与验收标准。 */
runRouter.get("/detail/:runId", async (req, res) => {
  const file = await checkpointStore.loadRun(req.params.runId);
  if (!file) return res.status(404).json({ error: "not_found" });
  const decompose = file.steps["decompose"]?.value as { subtasks?: DetailSubtask[] } | undefined;
  const subtasks = decompose?.subtasks ?? [];
  const todos = subtasks.map((s) => ({
    id: s.id,
    title: s.title,
    estimateHours: s.estimateHours,
    acceptance: s.acceptance,
    status: (file.steps[`dev:${s.id}`]?.status as string | undefined) ?? "pending",
  }));
  const difficulty = (file.steps["assess"]?.value as { difficulty?: string; reason?: string | null } | undefined) ?? null;
  res.json({ manifest: file.manifest, difficulty, todos });
});

/** 流式：GET /api/run/pipeline/stream（EventSource） */
runRouter.get("/pipeline/stream", async (req, res) => {
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const requirement = String(req.query.requirement ?? "");
  const goal = String(req.query.goal ?? "");
  const cwd = typeof req.query.cwd === "string" && req.query.cwd.trim() ? req.query.cwd.trim() : undefined;
  const provider = typeof req.query.provider === "string" ? req.query.provider : "claude-agent";
  const dryRun = req.query.dryRun !== "false";
  let verifyChecks: VerifyCheckSpec[] | undefined;
  try {
    verifyChecks = parseVerifyChecks(JSON.parse(String(req.query.verifyChecks ?? "null")));
  } catch {
    verifyChecks = undefined;
  }
  const resume = typeof req.query.resume === "string" && req.query.resume.trim() ? req.query.resume.trim() : undefined;
  if (!requirement || !goal) {
    send("error", { message: "缺少 requirement 或 goal" });
    return res.end();
  }

  // 建/续 run，并把 runId 第一时间回传前端（用于断点续跑）
  const manifest = await resolveRun(resume, { requirement, goal }, provider, cwd);
  send("run-started", { runId: manifest.runId, resumed: !!resume });

  try {
    const d = await resolveDeps(dryRun, provider, cwd, verifyChecks);
    if ("error" in d) {
      await checkpointStore.saveManifest({ ...manifest, status: "failed", updatedAt: new Date().toISOString() });
      send("error", { message: d.error });
      return res.end();
    }
    const workspace: Workspace | undefined = cwd ? { cwd } : undefined;
    const streamHook: NodeHook = {
      name: "sse",
      onOutput(evt) {
        send("node-end", {
          id: evt.nodeId,
          kind: evt.kind,
          status: evt.result.status,
          summary: evt.result.summary ?? null,
          output: evt.result.output ?? null,
          error: evt.result.error ?? null,
          iteration: evt.ctx.iteration ?? null,
        });
      },
    };
    await runPipeline({ requirement, goal }, {
      send: d.send,
      act: d.act,
      verify: d.verify,
      summarize: d.send,
      providerId: provider,
      workspace,
      hooks: [...persistHooks(dryRun), streamHook], // 真跑落盘 + SSE 推流
      onEvent: send,
      checkpoint: { store: checkpointStore, runId: manifest.runId }, // 断点续跑
    });
    await checkpointStore.saveManifest({ ...manifest, status: "done", updatedAt: new Date().toISOString() });
  } catch (e) {
    await checkpointStore.saveManifest({ ...manifest, status: "failed", updatedAt: new Date().toISOString() });
    send("error", { message: e instanceof Error ? e.message : String(e) });
  } finally {
    res.end();
  }
});
