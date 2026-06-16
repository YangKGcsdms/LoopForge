import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../env.js";

/**
 * 凭据存储（SK）。
 * 起步阶段用本地 JSON 文件落盘（backend/.data/credentials.json，已 gitignore）。
 * 接口稳定，后续可替换为 keychain / 加密 / 数据库实现而不动调用方。
 *
 * ⚠️ 当前为明文存储，仅适合本地开发壳。生产化前务必替换为安全后端。
 */

interface CredentialRecord {
  apiKey: string;
  updatedAt: string;
}

type CredentialFile = Record<string, CredentialRecord>;

const filePath = path.join(env.dataDir, "credentials.json");

async function readAll(): Promise<CredentialFile> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as CredentialFile;
  } catch {
    return {};
  }
}

async function writeAll(data: CredentialFile): Promise<void> {
  await fs.mkdir(env.dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

/** 写入/更新某 Provider 的 SK。 */
export async function setApiKey(provider: string, apiKey: string): Promise<void> {
  const all = await readAll();
  all[provider] = { apiKey, updatedAt: new Date().toISOString() };
  await writeAll(all);
}

/** 取原始 SK（仅供后端内部校验使用，绝不经 API 原样返回前端）。 */
export async function getApiKey(provider: string): Promise<string | undefined> {
  const all = await readAll();
  const stored = all[provider]?.apiKey;
  if (stored) return stored;
  // 兜底：允许通过环境变量提供 Cursor 的 SK。
  if (provider === "cursor" && env.cursorApiKeyFromEnv) return env.cursorApiKeyFromEnv;
  return undefined;
}

/** 删除某 Provider 的 SK。 */
export async function deleteApiKey(provider: string): Promise<void> {
  const all = await readAll();
  delete all[provider];
  await writeAll(all);
}

/** 配置状态（脱敏，安全返回前端）。 */
export interface CredentialStatus {
  configured: boolean;
  maskedKey?: string;
  updatedAt?: string;
  source?: "store" | "env";
}

export async function getStatus(provider: string): Promise<CredentialStatus> {
  const all = await readAll();
  const record = all[provider];
  if (record?.apiKey) {
    return {
      configured: true,
      maskedKey: maskKey(record.apiKey),
      updatedAt: record.updatedAt,
      source: "store",
    };
  }
  if (provider === "cursor" && env.cursorApiKeyFromEnv) {
    return { configured: true, maskedKey: maskKey(env.cursorApiKeyFromEnv), source: "env" };
  }
  return { configured: false };
}

/** 仅保留首尾少量字符，中间打码。 */
export function maskKey(key: string): string {
  if (key.length <= 8) return "*".repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
