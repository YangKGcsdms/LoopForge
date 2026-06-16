import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";

/**
 * 后端的「API 服务器壳」。
 * 只负责：中间件装配、路由挂载、统一错误处理。
 * 真正与 Cursor SDK 打交道的逻辑都在 ./sdk 集成操作层里。
 */
export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // 全部业务 API 挂在 /api 下
  app.use("/api", apiRouter);

  // 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "not_found" });
  });

  // 统一错误处理
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : "internal_error";
    console.error("[backend] 未捕获错误:", err);
    res.status(500).json({ error: "internal_error", message });
  });

  return app;
}
