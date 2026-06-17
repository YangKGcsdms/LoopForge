import { Router } from "express";
import { getApiKey } from "../config/store.js";
import {
  runPipeline,
  makeMockSender,
  makeMockActSender,
  senderFor,
  actSenderFor,
  makeVerifier,
  type ActSender,
  type NodeHook,
  type Sender,
  type Verifier,
  type VerifyCheckSpec,
  type Workspace,
} from "../sdk/orchestration/index.js";
import { runtimeApprover, SAFE_TOOLS } from "../sdk/approval/index.js";

export const runRouter = Router();

type Deps = { send: Sender; act?: ActSender; verify?: Verifier };

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
  return {
    requirement: b.requirement,
    goal: b.goal,
    cwd,
    provider,
    dryRun: b.dryRun !== false,
    verifyChecks: parseVerifyChecks(b.verifyChecks),
  };
}

/** 非流式：POST /api/run/pipeline */
runRouter.post("/pipeline", async (req, res) => {
  const { requirement, goal, cwd, provider, dryRun, verifyChecks } = parseBody(req.body);
  if (typeof requirement !== "string" || typeof goal !== "string") {
    return res.status(400).json({ error: "missing_requirement_or_goal" });
  }
  const d = await resolveDeps(dryRun, provider, cwd, verifyChecks);
  if ("error" in d) return res.status(400).json({ error: "no_api_key", detail: d.error });
  const workspace: Workspace | undefined = cwd ? { cwd } : undefined;
  const result = await runPipeline({ requirement, goal }, {
    send: d.send,
    act: d.act,
    verify: d.verify,
    summarize: d.send,
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
  const provider = typeof req.query.provider === "string" ? req.query.provider : "claude-agent";
  const dryRun = req.query.dryRun !== "false";
  let verifyChecks: VerifyCheckSpec[] | undefined;
  try {
    verifyChecks = parseVerifyChecks(JSON.parse(String(req.query.verifyChecks ?? "null")));
  } catch {
    verifyChecks = undefined;
  }
  if (!requirement || !goal) {
    send("error", { message: "缺少 requirement 或 goal" });
    return res.end();
  }

  try {
    const d = await resolveDeps(dryRun, provider, cwd, verifyChecks);
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
      send: d.send,
      act: d.act,
      verify: d.verify,
      summarize: d.send,
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
