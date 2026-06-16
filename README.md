# LoopForge

驾驭多家编码 agent SDK（**Cursor SDK** / **Claude Agent SDK**）的自驱编排层：
难度评估 → 出方案 → 拆解成 3~5 工时任务 → 每个 TODO 自循环开发（开发→评审→矫正→收敛），按节点用途路由模型控成本。

> 配套文档见 `docs/`：
> - `Cursor_SDK_TypeScript_官方文档.md` —— 官方 SDK 参考基准
> - `AI开发流水线设计_CursorSDK版.md` —— 思路参考（待评估，非工程指导）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + TypeScript + TailwindCSS |
| 后端 | Express + TypeScript（`tsx` 运行，免构建） |
| 集成 | SDK 集成操作层（`backend/src/sdk`），动态接入 `@cursor/sdk` |

## 目录结构

```
.
├── package.json              # npm workspaces + concurrently（一条命令拉起前后端）
├── frontend/                 # Vue3 + Tailwind 前端
│   └── src/
│       ├── App.vue
│       ├── api/client.ts     # 对接后端 /api
│       └── components/SkConfig.vue   # SK 配置页
└── backend/                  # Express API 壳
    └── src/
        ├── server.ts / app.ts        # API 壳（中间件 + 路由 + 错误处理）
        ├── routes/                   # /api/health、/api/config/*
        ├── config/store.ts           # SK 落盘（backend/.data，已 gitignore）
        └── sdk/                      # ★ SDK 集成操作层
            ├── provider.ts           # SdkProvider 契约（含规划中的 agent 操作）
            ├── registry.ts           # Provider 注册表（当前仅 cursor）
            ├── types.ts
            └── cursor/cursorProvider.ts   # 封装 @cursor/sdk（动态 import + 降级）
```

## 快速开始

```bash
npm install        # 安装前后端依赖（workspaces）
npm run dev        # 同时启动后端(:8787) 与前端(:5173)
```

打开 http://localhost:5173 ，在「SK 配置」页粘贴 Cursor API Key，保存后点「验证连接」。

### 激活真实 Cursor SDK

集成层默认以动态 import 接入 `@cursor/sdk`，**未安装时不会崩溃**，只是校验会提示需要安装。激活：

```bash
npm i -w backend @cursor/sdk
```

装上后，「验证连接」会真正调用 `Cursor.me()` 校验 SK，`/api/config/models` 可拉取模型目录。

## API（后端壳）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/config/providers` | Provider 列表（仅 cursor supported） |
| GET | `/api/config/sk?provider=cursor` | SK 配置状态（脱敏） |
| PUT | `/api/config/sk` | 保存 SK `{ provider, apiKey }` |
| DELETE | `/api/config/sk?provider=cursor` | 清除 SK |
| POST | `/api/config/sk/validate` | 校验 SK（经集成层） |
| GET | `/api/config/models?provider=cursor` | 模型目录（需已装 SDK） |

## 环境变量

复制 `.env.example` 为 `.env`（可选）。`PORT` 改后端端口；`CURSOR_API_KEY` 可直接注入 SK（优先级低于页面保存值，且作为兜底）。

## 安全说明

- SK 仅发送到本地后端，明文落盘于 `backend/.data/credentials.json`（已 gitignore）。**仅适合本地开发**，生产化前需替换为安全存储（keychain/加密/KMS）。
- API 永不原样返回 SK，只返回脱敏后的 `maskedKey`。
