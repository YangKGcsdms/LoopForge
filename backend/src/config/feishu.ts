/**
 * 飞书审批配置 —— 存储优先（.data/feishu.json，已 gitignore），环境变量兜底。
 * 三参（App ID / App Secret / Receive ID）+ receive_id 类型，由前端「配置」卡片填入。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../env.js";
import { maskKey } from "./store.js";
import type { FeishuApproverConfig } from "../sdk/approval/feishuApprover.js";

type ReceiveIdType = FeishuApproverConfig["receiveIdType"];
const RECEIVE_ID_TYPES: ReceiveIdType[] = ["user_id", "open_id", "union_id", "chat_id", "email"];

interface StoredFeishu {
  appId?: string;
  appSecret?: string;
  receiveId?: string;
  receiveIdType?: ReceiveIdType;
}

const filePath = path.join(env.dataDir, "feishu.json");

async function readStore(): Promise<StoredFeishu> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as StoredFeishu;
  } catch {
    return {};
  }
}

async function writeStore(data: StoredFeishu): Promise<void> {
  await fs.mkdir(env.dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

/** 从环境变量读飞书配置（兜底）。 */
export function feishuConfigFromEnv(): FeishuApproverConfig | null {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  const receiveId = process.env.FEISHU_RECEIVE_ID;
  if (!appId || !appSecret || !receiveId) return null;
  return {
    appId,
    appSecret,
    receiveId,
    receiveIdType: (process.env.FEISHU_RECEIVE_ID_TYPE as ReceiveIdType) ?? "open_id",
    timeoutMs: process.env.FEISHU_APPROVAL_TIMEOUT_MS ? Number(process.env.FEISHU_APPROVAL_TIMEOUT_MS) : undefined,
  };
}

/** 合并配置：存储优先、env 兜底；三项齐全才返回完整 config，否则 null（不启用审批）。 */
export async function getFeishuConfig(): Promise<FeishuApproverConfig | null> {
  const s = await readStore();
  const e = feishuConfigFromEnv();
  const appId = s.appId ?? e?.appId;
  const appSecret = s.appSecret ?? e?.appSecret;
  const receiveId = s.receiveId ?? e?.receiveId;
  if (!appId || !appSecret || !receiveId) return null;
  return {
    appId,
    appSecret,
    receiveId,
    receiveIdType: s.receiveIdType ?? e?.receiveIdType ?? "user_id",
    timeoutMs: e?.timeoutMs,
  };
}

/** 写入飞书配置（部分字段）。空串不覆盖既有值。 */
export async function setFeishuConfig(patch: Partial<StoredFeishu>): Promise<void> {
  const next: StoredFeishu = { ...(await readStore()) };
  if (typeof patch.appId === "string" && patch.appId.trim()) next.appId = patch.appId.trim();
  if (typeof patch.appSecret === "string" && patch.appSecret.trim()) next.appSecret = patch.appSecret.trim();
  if (typeof patch.receiveId === "string" && patch.receiveId.trim()) next.receiveId = patch.receiveId.trim();
  if (patch.receiveIdType && RECEIVE_ID_TYPES.includes(patch.receiveIdType)) next.receiveIdType = patch.receiveIdType;
  await writeStore(next);
}

export async function clearFeishuConfig(): Promise<void> {
  await writeStore({});
}

export interface FeishuStatus {
  configured: boolean;
  /** 脱敏后的 App ID。 */
  appId?: string;
  receiveId?: string;
  receiveIdType?: ReceiveIdType;
  source?: "store" | "env";
}

/** 脱敏状态给前端（不回传 secret）。 */
export async function getFeishuStatus(): Promise<FeishuStatus> {
  const s = await readStore();
  const cfg = await getFeishuConfig();
  if (!cfg) return { configured: false };
  return {
    configured: true,
    appId: maskKey(cfg.appId),
    receiveId: cfg.receiveId,
    receiveIdType: cfg.receiveIdType,
    source: s.appId && s.appSecret && s.receiveId ? "store" : "env",
  };
}
