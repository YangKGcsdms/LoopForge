# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目

LoopForge —— 套在 **Claude Code（CC）这个"打不过的黑盒"外面的一层壳**。CC 的 harness/通用能力上限自建无法超越，所以**不碰它的内部**；壳只在外面补 CC 给不了的两样东西——**连续性**（持久/续跑/移交）和**信任**（边界/验证/审计）——把短命、需盯、困在单 session 的 vibe 工作，转成有界、可持久、可续跑、可审计、可移交的单元，即"**放心托管**"。

三轴模型（架构灵魂）：**能力=CC 提供（节点内部别碰）/ 连续性=壳提供 / 信任=壳提供**。砍刀准则：任何特性先问"加的是能力还是连续性/信任"——加能力=和 CC 竞争=砍；加连续性/信任=核心。完整设计见 `docs/架构设计_CC壳与节点切分.md`（**工程基准**）。

核心流程：难度评估 → 出方案 → 拆解成 N 个 3~5 工时 TODO → 每个 TODO 自循环开发（开发→**独立校验**→评审→矫正→收敛），按节点用途路由模型控成本。**Cursor SDK 已冻结**（代码休眠保留），只走 Claude 路线。npm workspaces monorepo：`backend`（Express + TS）+ `frontend`（Vue3 + Vite + Tailwind v3）。Node ≥ 20。

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

**测试框架（基准：`docs/测试框架与验收标准.md`）**：两层——① 单测(`*.test.ts`，纯逻辑) ② 集测{`chains.integration.test.ts` 三条 mock 链路(完整pipeline/接地气/审批)真正走一遍，零计费 · `live.itest.ts` 每类节点用 haiku+登录态真集成一次、断言符合契约}。新增功能点须配"一层单测 + 一层集测"。验收标准见该 md。

后端用 `tsx` 直接跑 TS，**运行无需构建**（`dev` = `tsx watch src/server.ts`）。`build` 只是 tsc 产出，平时改完用 `typecheck` 验类型即可。

## 架构

### SDK 集成层 `backend/src/sdk`
`provider.ts` 定义 `SdkProvider` 契约（`info` / `validateCredential` / `listModels` / `send` / 可选 `act`）。**`send` = think 原语**（只读、单发结构化）；**`act` = act 原语**（开真工具 + `canUseTool` 审批 + 观测消息流聚合 `evidence`，见 `claude/evidence.ts` 纯函数 reducer）。`claude/claudeProvider.ts` 实现两者；`cursor/cursorProvider.ts` **已冻结**（`info().supported=false`，代码休眠保留，别删别引用）。都用动态 import 懒加载、未装时优雅降级。

### 编排层 `backend/src/sdk/orchestration`（核心）
四层抽象，自底向上：
- **`contract.ts`** — `Contract<T>`：把输出 schema 注入 prompt、解析 agent 回复、校验结构。
- **`run.ts` / `node.ts`** — `runNode` + `NodeTemplate`。节点 `render(input, ctx)` 产出 `{static, dynamic}` 两段提示；`kind` = producer | evaluator | gate，`purpose` = plan | control | execute | validate | review | test，**`exec` = think | act（关键切分轴）**。`runNode` 按 `exec` 分流：**think 走 `deps.send`（只读）；act 走 `deps.act`（真工具+审批），并把 `evidence` 挂上 `NodeResult`，再调 `deps.verify(cwd)` 做独立校验**。其余照旧：契约解析校验 → 有界 repair 重试 → hooks → 可选小模型摘要 → `resolveModel` 覆盖路由。
- **`loop.ts`** — `runLoop`：evaluator-optimizer 骨架（producer → [act 节点：采 evidence + verify] → evaluator → gate → 收敛/矫正）。**producer 是 act 节点时，把 `evidence`/`verification` 注入跑评审用的 evalCtx**，让 evaluator 判地面真值。矫正靠把上一轮 verdict 塞进 `ctx.priorVerdict`，producer 的 render 读它自我修正。**注意：迭代到 `maxIterations` 仍不收敛时，返回最后一轮产出、状态记 `max_iterations`，不阻断调用方。**
- **`pipeline.ts`** — `runPipeline`：整条自驱流程（难度 → plan → decompose loop → 逐 TODO dev loop），按 `providerId` 选路由，边跑边 emit SSE 事件。

具体节点在 `nodes/`：`router.ts`（难度评估 + 路由表）、`plan.ts`、`decompose.ts`、`dev.ts`（devStep[act] + devReviewer + devRedTeam）、`gate.ts`、`test.ts`（testWriter[act]）。`hooks.ts` 是节点输入/输出钩子，`mock.ts` 是 dryRun 用的假 sender，`verify.ts` 是 act 后的独立校验器。

**验证模型（重要，核心设计）：** **think 节点**（plan/decompose/各 reviewer）只读、不碰文件，输出是结构化 JSON。**act 节点**（devStep/testWriter）真改代码并采 `evidence`（从 `tool_use`/`tool_result` 流聚合）；act 后由 **`verify.ts` 在 `workspace.cwd` 独立跑 `git diff` + 配置的 test/typecheck**（真 exit code，不经 agent）。`loop.ts` 把 `evidence` + `verification` 注入 evalCtx，**`devReviewer`/`devRedTeam` 判这份地面真值、不判 agent 自报**——`testsPass===false|null` 时 `completion.done` 不得为 true。这是"信任轴"的落点；动 loop 或排查"产出跑不起来"时，独立校验（verify）才是真信号，agent 的 `testsRun`/`filesTouched` 只是参考。

### 路由 `nodes/router.ts`
现役只有 `CLAUDE_ROUTING`（per-purpose → Claude 模型别名）；`CURSOR_ROUTING`/`MODEL_POOL` 随 Cursor 冻结而**休眠**（保留不删）。`routingFor`/`resolverFor` 产出 `runNode` 用的 `resolveModel`。**act 节点（execute/test）至少 sonnet**——别用 haiku 跑自主多轮开发；review 也用 sonnet（评审质量定流水线可靠性）；think 的 plan/control 用 opus，validate 用 haiku。`CLAUDE_POOL` 是 allowlist（admin 禁用了 `fable`，已排除）——**只在池内路由**。

### HTTP 壳 `backend/src/routes`
SK 配置、模型目录（`GET /api/models?provider=`）、流水线运行（`POST` + `GET /api/run/pipeline/stream` 的 SSE）。run 路由装配 **`send`（think）+ `act`（act-runner，绑定飞书 `approve`）+ `verify`（独立校验器）** + 路由 resolver + hooks，交给 `runPipeline`；dryRun 用 mock。**默认 `provider="claude-agent"`，传 `cursor` 直接拒绝（已冻结）。**

### 前端 `frontend/src`
**设备分流外壳**：`App.vue` 只创建共享态（`useRun` SSE 运行态 + 打字机队列、`useWorkflowForm` 表单态、`useDevice` 视图判定）并按设备分发到 `layouts/DesktopApp.vue`（两栏：左配置 / 右结果）或 `mobile/MobileApp.vue`（三页 Tab + 底栏）。两版**共享同一份态**，切换不丢进度。桌面用 `components/` 下 WorkflowForm / WorkflowResults / SkConfig；H5 用 `mobile/MobileForm` / `MobileResults`（同 composable、各自展示层）。`useModels` 拉模型目录+路由池，`useTheme` 管明/暗/自动换肤。

**设计语言 = 暖色账本 / Anthropic 编辑风（取自 `~/projects/carter_book`）**：暖羊皮纸底 + terracotta `#c96442` 单点品牌色 + 账本红绿 + 暖色暗夜；三字体 Source Serif 4（标题/数字/正文）· Inter（UI/大写宽字距标签）· JetBrains Mono（代码/ID）；**发丝线代替阴影**、圆角 ≤12px。**单一来源 = `style.css`**：`:root` CSS 变量（`[data-theme=dark]` 切换即整站换肤）+ 编辑感工具类（`.kicker` / `.section-label`(ornament+caps+rule) / `.label-caps` / `.seq` / `.tone-*` chip 调色）。`tailwind.config.js` 把语义色绑到这些变量（`bg-surface`/`text-ink`/`border-hair`/`text-brand`/`bg-up`…），组件用这些语义类 + 工具类拼装；`lib/format.ts`→`semantic-colors.ts` 把 tier/kind/diff 映射成 `.tone-*`。`Base*`（Button/Input/Select/Tag、StatusBadge）是暖色基件；`BaseCard` 现已被编辑风的 section+发丝线取代、暂未使用。**别散写冷色 Tailwind（slate/violet…）或加阴影。**

## 约定与坑

- **ESM + `.js` 后缀导入**：后端是 ESM、`moduleResolution: "Bundler"`，import 路径写 `.js`（实际指向 `.ts`），由 tsx 解析。
- **前端测试没有 DOM**：测试经 `node --import tsx --test` 跑，**没有 jsdom**。`@vue/test-utils` 虽列在 devDependencies，但 `mount()` 在这套 runner 下跑不起来——不要写组件挂载测试，改测纯函数（如 `lib/format.ts`、composable 里可抽离的逻辑）。
- **`@cursor/sdk` 依赖 `@connectrpc/connect-node`**：这是 SDK 自己漏声明的依赖，已手动装进 backend，**别删**，否则 `Agent.create` 崩。
- **Claude Agent SDK 认证**：不设 `ANTHROPIC_API_KEY` 时用本机 Claude Code 登录态（订阅计费）；设了才走 API 计费。`claudeProvider` 只在 key 非空时注入 env。
- **`backend/.data`**：保存用户填的 SK（`credentials.json`，已 gitignore）。**不要删**——删了用户得重新配 key。
- 根目录的 `IMPLEMENTATION_NOTES_S*` / `VERIFICATION_S*` / `ACCESSIBILITY_CHECKLIST.md` / `validate-tokens.js` / `test-workflow-split.mjs` 是一次代码生成跑遗留的产物，**非权威文档**，可忽略。

## 文档

`docs/` 沉淀了官方 SDK 参考（作为基准）：`Cursor_SDK_TypeScript_官方文档.md`、`claude-agent-sdk/`（Claude Agent SDK 全量沉淀 + `README.md` 索引）。`AI开发流水线设计_CursorSDK版.md`、`通用节点与Loop编排层设计.md` 是思路参考，非工程基准。
