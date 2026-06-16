import fs from "node:fs";
import path from "node:path";

// 最简 .env 加载（无依赖）：把 backend/.env 的 KEY=VALUE 注入 process.env（不覆盖已存在的）。
// 放在 env 读取之前执行，确保后续 process.env.* 能读到 .env 里的值。
(function loadDotEnv(): void {
  try {
    const txt = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  } catch {
    // 无 .env 文件则忽略
  }
})();

/** 进程级配置。集中读取环境变量，避免散落各处。 */
export const env = {
  port: Number(process.env.PORT ?? 8787),
  /** 凭据等本地数据的落盘目录（已在 .gitignore 中忽略）。 */
  dataDir: path.join(process.cwd(), ".data"),
  /** 可选：通过环境变量直接注入的 Cursor API Key。 */
  cursorApiKeyFromEnv: process.env.CURSOR_API_KEY?.trim() || undefined,
};
