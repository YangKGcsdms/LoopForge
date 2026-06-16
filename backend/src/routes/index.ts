import { Router } from "express";
import { healthRouter } from "./health.js";
import { configRouter } from "./config.js";
import { modelsRouter } from "./models.js";
import { runRouter } from "./run.js";

/** 聚合所有 API 路由，由 app.ts 挂到 /api 下。 */
export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/config", configRouter);
apiRouter.use("/models", modelsRouter);
apiRouter.use("/run", runRouter);
