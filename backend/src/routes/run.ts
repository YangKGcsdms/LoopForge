import { Router } from "express";
import { getApiKey } from "../config/store.js";
import {
  runPipeline,
  makeMockSender,
  senderFor,
  type NodeHook,
  type Sender,
  type Workspace,
} from "../sdk/orchestration/index.js";

export const runRouter = Router();

type Deps = { sender: Sender };

/** 装配 sender：dryRun 用 mock；否则按 provider 用 SK（claude-agent 可空，走登录态）。路由策略由 provider 决定。 */
async function resolveDeps(dryRun: boolean, provider: string, cwd?: string): Promise<Deps | { error: string }> {
  if (dryRun) return { sender: makeMockSender() };
  const apiKey = await getApiKey(provider);
  if (!apiKey && provider !== "claude-agent") {
    return { error: "未配置 SK，请用 dryRun 或先在 SK 配置页填入。" };
  }
  return { sender: senderFor(provider, apiKey ?? "", { defaultCwd: cwd }) };
}

function parseBody(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const cwd = typeof b.cwd === "string" && b.cwd.trim() ? b.cwd.trim() : undefined;
  const provider = typeof b.provider === "string" ? b.provider : "cursor";
  return { requirement: b.requirement, goal: b.goal, cwd, provider, dryRun: b.dryRun !== false };
}

/** 非流式：POST /api/run/pipeline */
runRouter.post("/pipeline", async (req, res) => {
  const { requirement, goal, cwd, provider, dryRun } = parseBody(req.body);
  if (typeof requirement !== "string" || typeof goal !== "string") {
    return res.status(400).json({ error: "missing_requirement_or_goal" });
  }
  const d = await resolveDeps(dryRun, provider, cwd);
  if ("error" in d) return res.status(400).json({ error: "no_api_key", detail: d.error });
  const workspace: Workspace | undefined = cwd ? { cwd } : undefined;
  const result = await runPipeline({ requirement, goal }, {
    send: d.sender,
    summarize: d.sender,
    providerId: provider,
    workspace,
  });
  res.json({ dryRun, ...result });
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
  const cwd =
    typeof req.query.cwd === "string" && req.query.cwd.trim() ? req.query.cwd.trim() : undefined;
  const provider = typeof req.query.provider === "string" ? req.query.provider : "cursor";
  const dryRun = req.query.dryRun !== "false";
  if (!requirement || !goal) {
    send("error", { message: "缺少 requirement 或 goal" });
    return res.end();
  }

  try {
    const d = await resolveDeps(dryRun, provider, cwd);
    if ("error" in d) {
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
      send: d.sender,
      summarize: d.sender,
      providerId: provider,
      workspace,
      hooks: [streamHook],
      onEvent: send,
    });
  } catch (e) {
    send("error", { message: e instanceof Error ? e.message : String(e) });
  } finally {
    res.end();
  }
});
