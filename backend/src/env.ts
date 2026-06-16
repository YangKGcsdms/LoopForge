import path from "node:path";

/** 进程级配置。集中读取环境变量，避免散落各处。 */
export const env = {
  port: Number(process.env.PORT ?? 8787),
  /** 凭据等本地数据的落盘目录（已在 .gitignore 中忽略）。 */
  dataDir: path.join(process.cwd(), ".data"),
  /** 可选：通过环境变量直接注入的 Cursor API Key。 */
  cursorApiKeyFromEnv: process.env.CURSOR_API_KEY?.trim() || undefined,
};
