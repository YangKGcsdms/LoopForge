import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../env.js";

/**
 * 用户偏好持久化。
 * 与凭据（credentials.json）分离，落盘于 backend/.data/preferences.json（已 gitignore）。
 * 目前仅记录"所选 Provider/SDK"，后续可扩展更多偏好项。
 */

export interface Preferences {
  /** 当前选择的 SDK / Provider（cursor | claude-agent | …）。 */
  provider: string;
}

const defaults: Preferences = { provider: "cursor" };

const filePath = path.join(env.dataDir, "preferences.json");

/** 读取偏好（缺失/损坏时回落默认值）。 */
export async function getPreferences(): Promise<Preferences> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return { ...defaults, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return { ...defaults };
  }
}

/** 合并写入偏好，返回写入后的完整对象。 */
export async function setPreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const next = { ...(await getPreferences()), ...patch };
  await fs.mkdir(env.dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}
