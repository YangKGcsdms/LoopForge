import { Router } from "express";
import { getProvider, listProviderInfos } from "../sdk/index.js";
import { deleteApiKey, getApiKey, getStatus, setApiKey } from "../config/store.js";
import { getPreferences, setPreferences } from "../config/prefs.js";

export const configRouter = Router();

/** Provider 列表（前端「SK 配置」下拉用）。目前仅 cursor 为 supported。 */
configRouter.get("/providers", (_req, res) => {
  res.json({ providers: listProviderInfos() });
});

/** 读取用户偏好（含所选 Provider）。 */
configRouter.get("/preferences", async (_req, res) => {
  res.json(await getPreferences());
});

/** 更新用户偏好（provider + 上次提交的输入草稿）。落库持久化。 */
configRouter.put("/preferences", async (req, res) => {
  const { provider, lastRequirement, lastGoal, lastCwd } = req.body ?? {};
  const patch: Record<string, string> = {};
  if (provider !== undefined) {
    if (typeof provider !== "string" || !getProvider(provider)) {
      return res.status(400).json({ error: "unsupported_provider", provider });
    }
    patch.provider = provider;
  }
  if (typeof lastRequirement === "string") patch.lastRequirement = lastRequirement;
  if (typeof lastGoal === "string") patch.lastGoal = lastGoal;
  if (typeof lastCwd === "string") patch.lastCwd = lastCwd;
  res.json(await setPreferences(patch));
});

/** 读取某 Provider 的 SK 配置状态（脱敏）。 */
configRouter.get("/sk", async (req, res) => {
  const provider = String(req.query.provider ?? "cursor");
  if (!getProvider(provider)) {
    return res.status(400).json({ error: "unsupported_provider", provider });
  }
  res.json({ provider, ...(await getStatus(provider)) });
});

/** 写入/更新某 Provider 的 SK。 */
configRouter.put("/sk", async (req, res) => {
  const { provider = "cursor", apiKey } = req.body ?? {};
  if (!getProvider(provider)) {
    return res.status(400).json({ error: "unsupported_provider", provider });
  }
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return res.status(400).json({ error: "missing_api_key" });
  }
  await setApiKey(provider, apiKey.trim());
  res.json({ ok: true, provider, ...(await getStatus(provider)) });
});

/** 删除某 Provider 的 SK。 */
configRouter.delete("/sk", async (req, res) => {
  const provider = String(req.query.provider ?? "cursor");
  if (!getProvider(provider)) {
    return res.status(400).json({ error: "unsupported_provider", provider });
  }
  await deleteApiKey(provider);
  res.json({ ok: true, provider });
});

/**
 * 校验 SK：调用集成层的 validateCredential。
 * body.apiKey 可选——不传则用已保存的 SK。
 */
configRouter.post("/sk/validate", async (req, res) => {
  const { provider = "cursor", apiKey } = req.body ?? {};
  const impl = getProvider(provider);
  if (!impl) {
    return res.status(400).json({ error: "unsupported_provider", provider });
  }
  // 不因"空 key"直接拒绝：交给 provider 判断（如 claude-agent 可用本机 Claude Code 登录态）。
  const keyToCheck = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : (await getApiKey(provider)) ?? "";
  const result = await impl.validateCredential(keyToCheck);
  res.json({ provider, ...result });
});

/** 拉取某 Provider 的可用模型目录（用已保存的 SK）。 */
configRouter.get("/models", async (req, res) => {
  const provider = String(req.query.provider ?? "cursor");
  const impl = getProvider(provider);
  if (!impl) {
    return res.status(400).json({ error: "unsupported_provider", provider });
  }
  const apiKey = await getApiKey(provider);
  if (!apiKey) {
    return res.status(400).json({ error: "no_api_key" });
  }
  try {
    const models = await impl.listModels(apiKey);
    res.json({ provider, models });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: "models_unavailable", message });
  }
});
