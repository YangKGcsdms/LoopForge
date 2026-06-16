import { Router } from "express";
import { getProvider } from "../sdk/index.js";
import { getApiKey } from "../config/store.js";
import { poolFor, routingScheme } from "../sdk/orchestration/index.js";

export const modelsRouter = Router();

/**
 * GET /api/models?provider=cursor —— 路由池（按难度路由用的 allowlist）。
 * 配了 SK 时与实时模型列表取交集，标注每个池内模型 available（admin 禁用的会标 false）。
 */
modelsRouter.get("/", async (req, res) => {
  const provider = String(req.query.provider ?? "cursor");
  const impl = getProvider(provider);
  if (!impl) return res.status(400).json({ error: "unsupported_provider", provider });

  const apiKey = await getApiKey(provider);
  let liveIds: Set<string> | null = null;
  let note: string | undefined;
  if (apiKey) {
    try {
      liveIds = new Set((await impl.listModels(apiKey)).map((m) => m.id));
    } catch (err) {
      note = err instanceof Error ? err.message : String(err);
    }
  } else {
    note = "未配置 SK，可用性未知";
  }
  const models = poolFor(provider).map((m) => ({ ...m, available: liveIds ? liveIds.has(m.id) : null }));
  res.json({ source: liveIds ? "live" : "fallback", provider, models, routing: routingScheme(provider), note });
});
