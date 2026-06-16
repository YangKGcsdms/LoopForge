import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 前端 dev 服务器：把 /api 代理到后端 API 壳（默认 8787），实现"前后端一体"开发体验。
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
