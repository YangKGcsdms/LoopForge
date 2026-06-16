import { createApp } from "./app.js";
import { env } from "./env.js";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[backend] API 壳已启动 → http://localhost:${env.port}`);
  console.log(`[backend] 健康检查    → http://localhost:${env.port}/api/health`);
});

// 优雅退出
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`\n[backend] 收到 ${signal}，正在关闭…`);
    server.close(() => process.exit(0));
  });
}
