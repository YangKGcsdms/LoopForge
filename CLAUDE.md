# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目

LoopForge —— 驾驭多家编码 agent SDK（Cursor SDK / Claude Agent SDK）的自驱编排层（meta-harness）。核心流程：难度评估 → 出方案 → 拆解成 N 个 3~5 工时 TODO → 每个 TODO 自循环开发（开发→评审→矫正→收敛），并按节点用途路由模型控成本。npm workspaces monorepo：`backend`（Express + TS）+ `frontend`（Vue3 + Vite + Tailwind v3）。Node ≥ 20。

## 常用命令

根目录（一条命令驱动两个 workspace）：
- `npm run dev` —— concurrently 同时起后端(:8787) + 前端(:5173)
- `npm test` —— 后端 + 前端的 hermetic 测试
- `npm run typecheck` —— 后端 `tsc --noEmit` + 前端 `vue-tsc --noEmit`
- `npm run build` —— 后端 tsc 产出 + 前端 `vue-tsc && vite build`

测试用 **Node 内置 test runner + tsx**（不是 vitest/jest，选它是因为和应用同一套 `.js`→`.ts` 解析）：
- 后端全部：`npm --workspace backend test`
- 单个文件：`node --import tsx --test backend/src/sdk/orchestration/loop.test.ts`
- 单个用例：再加 `--test-name-pattern="<名字>"`
- **Live（真调 SDK、会计费）测试**：`npm --workspace backend run test:live`，只跑 `*.itest.ts`。普通 `npm test` 只跑 `*.test.ts`，绝不触发计费——保持这个 hermetic / `.itest.ts` 的划分。

后端用 `tsx` 直接跑 TS，**运行无需构建**（`dev` = `tsx watch src/server.ts`）。`build` 只是 tsc 产出，平时改完用 `typecheck` 验类型即可。

## 架构

### SDK 集成层 `backend/src/sdk`
`provider.ts` 定义 `SdkProvider` 契约（`info` / `validateCredential` / `listModels` / `send`）。`cursor/cursorProvider.ts` 与 `claude/claudeProvider.ts` 各自实现，**都用动态 import 懒加载自己的 SDK，未装时优雅降级**（返回友好提示而非崩溃）。

### 编排层 `backend/src/sdk/orchestration`（核心）
四层抽象，自底向上：
- **`contract.ts`** — `Contract<T>`：把输出 schema 注入 prompt、解析 agent 回复、校验结构。
- **`run.ts` / `node.ts`** — `runNode` + `NodeTemplate`。节点 `render(input, ctx)` 产出 `{static, dynamic}` 两段提示；`kind` = producer | evaluator | gate，`purpose` = plan | control | execute | validate | review | test。`runNode` 负责：发送 → 按契约解析校验 → **有界 repair 重试** → 输入/输出 hooks → 可选小模型摘要 → `resolveModel` 覆盖路由。
- **`loop.ts`** — `runLoop`：evaluator-optimizer 骨架（producer → evaluator → gate → 收敛/矫正）。矫正靠把上一轮 verdict 塞进 `ctx.priorVerdict`，producer 的 render 读它自我修正。**注意：迭代到 `maxIterations` 仍不收敛时，返回最后一轮产出、状态记 `max_iterations`，不阻断调用方。**
- **`pipeline.ts`** — `runPipeline`：整条自驱流程（难度 → plan → decompose loop → 逐 TODO dev loop），按 `providerId` 选路由，边跑边 emit SSE 事件。

具体节点在 `nodes/`：`router.ts`（难度评估 + 路由表）、`plan.ts`、`decompose.ts`、`dev.ts`（devStep + devReviewer）、`gate.ts`、`test.ts`。`hooks.ts` 是节点输入/输出钩子，`mock.ts` 是 dryRun 用的假 sender。

**验证模型（重要，易误判）：** 开发节点的 `testsRun` 是 agent **自报**字段，编排层自己**不**跑 build/测试；评审节点 `devReviewer` 也只读 producer 的 JSON 自报、不读文件不跑命令。即整条 loop 默认是"agent 报、agent 判"，没有独立执行兜底——动编排逻辑或排查"产出跑不起来"时要清楚这点。

### 路由 `nodes/router.ts`
**两套完全独立的 per-purpose 路由表**（`CURSOR_ROUTING` / `CLAUDE_ROUTING`），用各 SDK 的真实模型名、刻意不收敛到别名。`routingFor(providerId)` 选表，`resolverFor` 产出 `runNode` 用的 `resolveModel`。`MODEL_POOL` / `CLAUDE_POOL` 是 allowlist（admin 禁用了 `fable`，已排除）——**只在池内路由，不要改成在整个实时 catalog 上选**。

### HTTP 壳 `backend/src/routes`
SK 配置、模型目录（`GET /api/models?provider=`）、流水线运行（`POST` + `GET /api/run/pipeline/stream` 的 SSE）。run 路由负责装配 `Sender`（真 `provider.send`，dryRun 时用 mock）+ 路由 resolver + hooks，交给 `runPipeline`。

### 前端 `frontend/src`
`App.vue` 两栏布局（左配置 / 右结果）；`composables/useRun.ts` 持有共享的 SSE 运行态 + 打字机队列；`components/` 下 WorkflowForm（左）/ WorkflowResults（右）/ SkConfig，以及一套 `Base*` 设计组件（BaseCard / Button / Input / Select / Tag、StatusBadge）。**设计层的唯一来源 = `Base*` 组件 + `lib/format.ts`（语义色集中在 `lib/semantic-colors.ts`）**；加 UI 时复用它们，别再散写内联 Tailwind 或另造全局 CSS 类。

## 约定与坑

- **ESM + `.js` 后缀导入**：后端是 ESM、`moduleResolution: "Bundler"`，import 路径写 `.js`（实际指向 `.ts`），由 tsx 解析。
- **前端测试没有 DOM**：测试经 `node --import tsx --test` 跑，**没有 jsdom**。`@vue/test-utils` 虽列在 devDependencies，但 `mount()` 在这套 runner 下跑不起来——不要写组件挂载测试，改测纯函数（如 `lib/format.ts`、composable 里可抽离的逻辑）。
- **`@cursor/sdk` 依赖 `@connectrpc/connect-node`**：这是 SDK 自己漏声明的依赖，已手动装进 backend，**别删**，否则 `Agent.create` 崩。
- **Claude Agent SDK 认证**：不设 `ANTHROPIC_API_KEY` 时用本机 Claude Code 登录态（订阅计费）；设了才走 API 计费。`claudeProvider` 只在 key 非空时注入 env。
- **`backend/.data`**：保存用户填的 SK（`credentials.json`，已 gitignore）。**不要删**——删了用户得重新配 key。
- 根目录的 `IMPLEMENTATION_NOTES_S*` / `VERIFICATION_S*` / `ACCESSIBILITY_CHECKLIST.md` / `validate-tokens.js` / `test-workflow-split.mjs` 是一次代码生成跑遗留的产物，**非权威文档**，可忽略。

## 文档

`docs/` 沉淀了官方 SDK 参考（作为基准）：`Cursor_SDK_TypeScript_官方文档.md`、`claude-agent-sdk/`（Claude Agent SDK 全量沉淀 + `README.md` 索引）。`AI开发流水线设计_CursorSDK版.md`、`通用节点与Loop编排层设计.md` 是思路参考，非工程基准。
