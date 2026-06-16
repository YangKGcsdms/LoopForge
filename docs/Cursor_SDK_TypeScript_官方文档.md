# Cursor TypeScript SDK 官方使用文档（沉淀版）

> 来源：Cursor 官方文档 `@cursor/sdk` → SDK / TypeScript。
> 本文为忠实整理的参考版，便于快速检索 API、配置、错误与限制。
> 配套阅读：`AI开发流水线设计_CursorSDK版.md`（用这些原语搭流水线的设计）。

`@cursor/sdk` 让你从自己的代码里调用 Cursor 智能体——和运行在 Cursor IDE / CLI / Web 里的是同一个智能体。上手最快的方式：在 Cursor 中运行 `/sdk` 技能。

端到端示例见 **Cursor Cookbook**（SDK 快速开始、app-builder 原型、云端 agents 看板、编码智能体 CLI），适合作为 CI 自动修复机器人、缺陷分诊 worker、代码评审流程、产品内嵌 agents、编排器的起点。

---

## 一、核心概念

| 概念 | 描述 |
|---|---|
| **智能体（Agent）** | 持久化容器，保存对话状态、工作区配置和设置，可跨多个提示词持续保留 |
| **Run** | 一次提示词提交。拥有自己的流、状态、结果和取消控制 |
| **SDKMessage** | 一次 Run 期间发出的标准化流事件，所有运行时结构一致 |

---

## 二、运行时：本地 vs 云端

SDK 用统一接口封装本地和云端运行时，**代码写法相同**，运行时由传给 `Agent.create()` 的 key（`local` 或 `cloud`）决定，两者都用同一个 `CURSOR_API_KEY`。

| 运行时 | 作用 | 何时使用 |
|---|---|---|
| **本地** | 直接在你的 Node 进程内联运行智能体循环，文件从磁盘读取 | 针对工作树的开发脚本和 CI 检查 |
| **云端（Cursor 托管）** | 在隔离 VM 中运行并克隆你的仓库，VM 由 Cursor 管理 | 调用方没有该仓库；需并行多个 agents；任务需在调用方断开后继续 |
| **云端（自托管）** | 同上，但 VM 由你通过自托管用量池运行 | 同云端托管场景；且代码/机密/产物必须留在你的环境 |

> ⚠️ **"Local" 指智能体循环和文件系统访问在哪运行，不是模型在哪运行。** 两种模式下所有推理都走 Cursor 托管模型。本地模式把文件留在你机器上；云端在 Cursor 环境运行。无论哪种，模型本身都是托管的。

REST API 见官方 **Cloud Agents API**。

---

## 三、安装与认证

### 安装

```bash
npm install @cursor/sdk
```

> 包名以 `@` 开头。npm 上不存在不带作用域的 `cursor/sdk`。

**运行时支持**：SDK 带原生依赖——默认本地 checkpoint 存储用的 `sqlite3`，以及按平台区分的 `@cursor/sdk-<os>-<arch>` 二进制（用于沙箱和 ripgrep）。因此它更偏 Node 环境。

- 导入 `@cursor/sdk` 不会立即加载本地智能体栈；本地执行器在第一次本地 acquire 时才加载。仅用 Cloud 或仅用类型的用户无需承担本地导入成本。
- 一个进程内第一个本地智能体承担一次性导入开销，之后该模块保持缓存。
- `@cursor/sdk@1.0.16+` 发布自包含 `.d.ts`，类型解析无需拉取未发布的 workspace 包。**升级后重跑类型检查**，`TurnEndedUpdate` 等流类型才会解析为实际类型而非 `any`。

### 认证

创建智能体前先设置 `CURSOR_API_KEY`（或传 `apiKey`）。SDK 支持本地和云端运行时使用**用户 API 密钥**和**服务账户 API 密钥**；**暂不支持团队 Admin API 密钥**。

- 用户 API 密钥：Cursor Dashboard → API 密钥
- 服务账户 API 密钥：团队设置 → 服务账户

```bash
export CURSOR_API_KEY="your-key"
```

### 用量与计费

SDK 运行遵循与 IDE / Cloud Agents 相同的定价、请求用量池和隐私模式规则。支出在团队用量仪表盘中显示并标记为 **SDK**。

- 服务账户 API 密钥：按拥有该服务账户的团队计费。
- 用户 API 密钥：按该用户的方案计费。

---

## 四、快速开始

让本地智能体直接处理当前工作树并实时接收事件流：

```typescript
import { Agent } from "@cursor/sdk";

const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5" },
  local: { cwd: process.cwd() },
});

const run = await agent.send("Summarize what this repository does");
for await (const event of run.stream()) {
  console.log(event);
}
```

每个事件都是带判别字段的 `SDKMessage`。一次性提示词用 `Agent.prompt()`。

> ⚠️ **快速开始会自动批准工具调用。** 默认本地智能体直接执行工具调用（shell、edit、write 等），无头模式下也不会有人工介入提示。要限制工具调用，配置 hooks（如 `beforeShellExecution` / `preToolUse`），或用 `local.sandboxOptions.enabled: true` 运行。

---

## 五、创建智能体

```typescript
function Agent.create(options: AgentOptions): Promise<SDKAgent>;
```

`Agent.create()` 验证选项并立即返回句柄。传 `local` 或 `cloud` 选择运行时。

```typescript
// 本地 agent
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5" },
  local: { cwd: "/path/to/repo" },
});

// 云端 agent
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5" },
  cloud: {
    repos: [{ url: "https://github.com/your-org/your-repo", startingRef: "main" }],
    autoCreatePR: true,
  },
});
```

- `agent.agentId` 立即有值。本地为 `agent-<uuid>`，云端为 `bc-<uuid>`。
- SDK 启动的云端 agents 会从默认列表过滤掉。要在 Cursor Web/窗口看到，点 **Filter > Source > SDK**。

### 会话级环境变量（仅云端）

某次运行需要短期凭证、只应在该智能体生命周期内存在的值时，传 `cloud.envVars`：

```typescript
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  cloud: {
    repos: [{ url: "https://github.com/your-org/your-repo" }],
    envVars: { STAGING_API_TOKEN: process.env.STAGING_API_TOKEN! },
  },
});
```

- 静态加密存储，注入到云端 shell，随智能体一同删除。
- 不能与调用方提供的 `agentId` 一起用；省略 `agentId`，从 `agent.agentId` 读服务器生成的 ID。
- 变量名不能以 `CURSOR_` 开头。

### 模型参数

用 `model.params` 传每个模型的选项（如 reasoning effort）。参数 ID 和取值因模型而异，用 `Cursor.models.list()` 查看。所选模型需要 Max Mode 时，Cursor 会为 SDK 请求自动启用。

> Composer 2 已停用；传 `composer-2` / `composer-2-fast` 会在认证时改用 Composer 2.5，现有脚本仍可跑。

```typescript
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5", params: [{ id: "thinking", value: "high" }] },
  local: { cwd: process.cwd() },
});
```

### Agent.prompt()（一次性）

```typescript
function Agent.prompt(message: string, options?: AgentOptions): Promise<RunResult>;
```

创建智能体 → 发一条提示词 → 等待结束 → 销毁。

```typescript
const result = await Agent.prompt("What does the auth middleware do?", {
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5" },
  local: { cwd: process.cwd() },
});
```

---

## 六、SDKAgent 句柄

`Agent.create()` 和 `Agent.resume()` 返回：

```typescript
interface SDKAgent {
  readonly agentId: string;
  readonly model: ModelSelection | undefined;
  send(message: string | SDKUserMessage, options?: SendOptions): Promise<Run>;
  close(): void;
  reload(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
  listArtifacts(): Promise<SDKArtifact[]>;
  downloadArtifact(path: string): Promise<Buffer>;
}
```

| 成员 | 描述 |
|---|---|
| `agentId` | 稳定标识符。本地 `agent-<uuid>`，云端 `bc-<uuid>` |
| `model` | 当前模型选择；每次成功 `send({ model })` 后更新。设置前为 `undefined`（含未传 model 的已恢复智能体） |
| `send` | 用给定提示词启动新运行，返回 `Run` |
| `close` | 开始释放但不等待完成（触发即走） |
| `reload` | 不释放，直接重读文件系统配置（钩子、项目 MCP、子智能体） |
| `[Symbol.asyncDispose]` | 异步释放，可配 `await using` 自动清理 |
| `listArtifacts` | 列出生成的文件（仅云端；本地返回空列表） |
| `downloadArtifact` | 按路径下载文件（仅云端；本地抛错） |

---

## 七、发送消息与 Run

每次 `agent.send()` 返回一个 `Run`。智能体跨运行保留对话上下文；一次 Run 是处理单个提示词的工作单元。

```typescript
type RunStatus = "running" | "finished" | "error" | "cancelled";
type RunOperation = "stream" | "wait" | "cancel" | "conversation";

interface Run {
  readonly id: string;
  readonly requestId?: string;
  readonly agentId: string;
  readonly status: RunStatus;
  readonly result?: string;
  readonly model?: ModelSelection;
  readonly durationMs?: number;
  readonly git?: RunGitInfo;
  readonly createdAt?: number;
  stream(): AsyncGenerator<SDKMessage, void>;
  wait(): Promise<RunResult>;
  cancel(): Promise<void>;
  conversation(): Promise<ConversationTurn[]>;
  supports(operation: RunOperation): boolean;
  unsupportedReason(operation: RunOperation): string | undefined;
  onDidChangeStatus(listener: (status: RunStatus) => void): () => void;
}

interface RunGitInfo {
  branches: Array<{ repoUrl: string; branch?: string; prUrl?: string }>;
}

interface RunResult {
  id: string;
  requestId?: string;
  status: "finished" | "error" | "cancelled";
  result?: string;
  model?: ModelSelection;
  durationMs?: number;
  git?: RunGitInfo;
}
```

### 流式传输

```typescript
const run = await agent.send("Find the bug in src/auth.ts");
for await (const event of run.stream()) {
  switch (event.type) {
    case "assistant":
      for (const block of event.message.content) {
        if (block.type === "text") process.stdout.write(block.text);
      }
      break;
    case "thinking":
      process.stdout.write(event.text);
      break;
    case "tool_call":
      console.log(`[tool] ${event.name}: ${event.status}`);
      break;
    case "status":
      console.log(`[status] ${event.status}`);
      break;
  }
}

// 同一智能体继续对话，上一次运行的对话状态自动加载
const run2 = await agent.send("Fix it and add a regression test");
await run2.wait();
```

同时发图像和文本：

```typescript
const run = await agent.send({
  text: "What's in this screenshot?",
  images: [{ data: base64Png, mimeType: "image/png" }],
});
```

### 非流式等待

```typescript
const result = await run.wait();
console.log(result.status);      // "finished" | "error" | "cancelled"
console.log(result.result);      // 助手最终文本（如有）
console.log(result.model);       // 实际使用的 ModelSelection
console.log(result.durationMs);
console.log(result.git);         // 云端运行：{ branches: [{ repoUrl, branch?, prUrl? }] }
```

> **助手最终文本就在 `result.result`（string）**，无需翻 `text`/`message`/`messages`/`content`。需要每一步会话记录时调 `run.conversation()`：

```typescript
const result = await run.wait();
const finalText = result.result ?? "";
const turns = await run.conversation();
const lastAssistant = turns
  .flatMap((t) => (t.type === "agentConversationTurn" ? t.turn.steps : []))
  .filter((s) => s.type === "assistantMessage")
  .at(-1);
console.log(lastAssistant?.message.text);
```

### 取消运行

```typescript
await run.cancel();
```

状态变 `"cancelled"`，实时流中止，进行中的工具调用停止，`run.wait()` 解析为 `status: "cancelled"`。部分输出（已写入的文本）保留在 Run 对象上。对本地和云端正在运行的 run 都有效；已结束的 run 无效果。

### 读取运行状态

```typescript
console.log(run.status);  // "running" | "finished" | "error" | "cancelled"
const stop = run.onDidChangeStatus((status) => {
  console.log(`status changed to ${status}`);
});
// 调用 stop() 移除监听器
const turns = await run.conversation();  // 结构化逐轮视图，无需订阅实时流
```

### 用 requestId 关联运行

每次 `agent.send()` 平台生成一个 UUID，在 `Run` 和 `RunResult` 上以 `requestId` 提供。用它把脚本/CI 运行与后端日志、用量分析、支持会话对应，而不要只凭 `agentId` 猜。

```typescript
const run = await agent.send("Audit the auth middleware");
console.log(run.requestId);
const result = await run.wait();
logger.info({ requestId: result.requestId }, "run finished");
```

`requestId` 随运行持久化，贯穿内存 / SQLite / JSONL 存储；与 `error.requestId` 一并记录可贯穿成功与失败路径。

### 单次运行的模型覆盖

传给 `send()` 的 `model` 覆盖该运行的模型选择，**之后持续生效**：后续未指定覆盖时继续用这个新模型。要切回，再传一个 `model`，或从 `agent.model` 读当前选择。

```typescript
const run = await agent.send("Plan the refactor", {
  model: { id: "composer-2.5", params: [{ id: "thinking", value: "high" }] },
});
console.log(agent.model);  // 发送成功后更新为覆盖模型
```

`run.model` / `result.model` 反映此次运行实际使用的模型，运行开始后不可改。

### 对话模式（plan / agent）

传 `mode: "plan"` 或 `mode: "agent"` 控制一次运行是先探索规划还是直接改。`Agent.create()` 里设 `mode` 为首次运行设初始模式；后续 `send()` 省略 `mode` 保持当前模式，传 `mode` 仅切换该次。

```typescript
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5" },
  mode: "plan",
  cloud: { repos: [{ url: "https://github.com/your-org/your-repo" }] },
});
await (await agent.send("Design the auth refactor")).wait();
await (await agent.send("Looks good, start building", { mode: "agent" })).wait();
```

### 流式原始增量（onDelta / onStep）

`run.stream()` 产出标准化 `SDKMessage`。要更底层的更新（逐 token 文本、流式工具调用参数、思考增量、步骤分界），传 `onDelta` / `onStep`：

```typescript
const run = await agent.send("Refactor the utils module", {
  onDelta: ({ update }) => {
    if (update.type === "text-delta") process.stdout.write(update.text);
    if (update.type === "thinking-delta") process.stdout.write(update.text);
  },
  onStep: ({ step }) => {
    console.log(`[step] ${step.type}`);
  },
});
```

回调执行完才处理下一次更新，可做背压控制。`InteractionUpdate` 包括 `text-delta`、`thinking-delta`、`thinking-completed`、`tool-call-started`、`tool-call-completed`、`partial-tool-call`、`token-delta`、`step-started`、`step-completed`、`turn-ended`，以及少量 summary 增量和 shell 输出增量。

### 单次发送选项（SendOptions）

| 属性 | 类型 | 描述 |
|---|---|---|
| `model` | `ModelSelection` | 单次模型覆盖。省略用 `agent.model`。**持续生效**：成功后更新 `agent.model` |
| `mode` | `"agent" \| "plan"` | 单次对话模式覆盖。后续省略则保持当前模式 |
| `mcpServers` | `Record<string, McpServerConfig>` | 内联 MCP 定义。本次运行**完全替换**创建时的服务器 |
| `onStep` | `(args: { step }) => void \| Promise<void>` | 每个已完成步骤（文本/思考/工具批次）后回调 |
| `onDelta` | `(args: { update }) => void \| Promise<void>` | 每个原始 `InteractionUpdate` 回调 |
| `local.force` | `boolean` | 仅本地，默认 false。开始前结束卡住的活动运行（云端服务端返 409，不需要此机制） |
| `local.customTools` | `Record<string, SDKCustomTool>` | 仅本地。本次运行的自定义工具，替换创建时的 |

---

## 八、流式事件（SDKMessage）

来自 `run.stream()`，按 `type` 区分，都含 `agent_id` 和 `run_id`。

```typescript
type SDKMessage =
  | SDKSystemMessage
  | SDKUserMessageEvent
  | SDKAssistantMessage
  | SDKThinkingMessage
  | SDKToolUseMessage
  | SDKStatusMessage
  | SDKTaskMessage
  | SDKRequestMessage;
```

| type | 描述 | 关键字段 |
|---|---|---|
| `"system"` | 初始化元数据，运行开始时发一次 | `subtype?`("init"), `model?`, `tools?` |
| `"user"` | 此次运行的用户提示词回显 | `message.content: TextBlock[]` |
| `"assistant"` | 模型文本输出 | `message.content: (TextBlock \| ToolUseBlock)[]` |
| `"thinking"` | 思考内容 | `text`, `thinking_duration_ms?` |
| `"tool_call"` | 工具调用生命周期。开始时带 `args`，完成时再发一次带 `result` | `call_id`, `name`, `status`, `args?`, `result?`, `truncated?` |
| `"status"` | 云端运行生命周期状态变化 | `status`, `message?` |
| `"task"` | 任务级里程碑与摘要 | `status?`, `text?` |
| `"request"` | 等待用户输入或批准 | `request_id` |

> 结果数据（最终文本、模型、时长、git 元数据）在流结束后保存在 Run 对象上，用 `run.wait()` 读。
>
> ⚠️ **工具调用 schema 不稳定。** `tool_call` 的 `args` / `result` 反映各工具内部结构，可能随工具演进变化，工具名也可能改。把 `args` / `result` 当 `unknown` 防御式解析；外层结构（`type`、`call_id`、`name`、`status`）是稳定的。

<details>
<summary>消息类型完整定义</summary>

```typescript
interface SDKSystemMessage {
  type: "system";
  subtype?: "init";
  agent_id: string;
  run_id: string;
  model?: ModelSelection;
  tools?: string[];
}
interface SDKUserMessageEvent {
  type: "user";
  agent_id: string;
  run_id: string;
  message: { role: "user"; content: TextBlock[] };
}
interface SDKAssistantMessage {
  type: "assistant";
  agent_id: string;
  run_id: string;
  message: { role: "assistant"; content: Array<TextBlock | ToolUseBlock> };
}
interface SDKThinkingMessage {
  type: "thinking";
  agent_id: string;
  run_id: string;
  text: string;
  thinking_duration_ms?: number;
}
interface SDKToolUseMessage {
  type: "tool_call";
  agent_id: string;
  run_id: string;
  call_id: string;
  name: string;
  status: "running" | "completed" | "error";
  args?: unknown;
  result?: unknown;
  truncated?: { args?: boolean; result?: boolean };
}
interface SDKStatusMessage {
  type: "status";
  agent_id: string;
  run_id: string;
  status: "CREATING" | "RUNNING" | "FINISHED" | "ERROR" | "CANCELLED" | "EXPIRED";
  message?: string;
}
interface SDKTaskMessage {
  type: "task";
  agent_id: string;
  run_id: string;
  status?: string;
  text?: string;
}
interface SDKRequestMessage {
  type: "request";
  agent_id: string;
  run_id: string;
  request_id: string;
}
interface TextBlock { type: "text"; text: string; }
interface ToolUseBlock { type: "tool_use"; id: string; name: string; input: unknown; }
```
</details>

- `SDKToolUseMessage` 大多发两次：先 `status: "running"` 带 `args`，完成时再发 `status: "completed"`（或 `"error"`）带 `result`。`truncated` 标明是否因负载过大截断。
- `SDKStatusMessage` 涵盖云端生命周期：`CREATING`（VM 预配 + 仓库克隆）、`RUNNING`（工作中），其余为终态。

### InteractionUpdate（onDelta 的原始增量）

比 `SDKMessage` 更细粒度：文本逐 token，工具调用随参数累积报告部分状态，思考实时到达。

```typescript
type InteractionUpdate =
  | TextDeltaUpdate | ThinkingDeltaUpdate | ThinkingCompletedUpdate
  | ToolCallStartedUpdate | ToolCallCompletedUpdate | PartialToolCallUpdate
  | TokenDeltaUpdate | StepStartedUpdate | StepCompletedUpdate
  | TurnEndedUpdate | UserMessageAppendedUpdate
  | SummaryUpdate | SummaryStartedUpdate | SummaryCompletedUpdate
  | ShellOutputDeltaUpdate;
```

<details>
<summary>更新类型完整定义</summary>

```typescript
interface TextDeltaUpdate { type: "text-delta"; text: string; }
interface ThinkingDeltaUpdate { type: "thinking-delta"; text: string; }
interface ThinkingCompletedUpdate { type: "thinking-completed"; thinkingDurationMs: number; }
interface ToolCallStartedUpdate { type: "tool-call-started"; callId: string; toolCall: ToolCall; modelCallId: string; }
interface PartialToolCallUpdate { type: "partial-tool-call"; callId: string; toolCall: ToolCall; modelCallId: string; }
interface ToolCallCompletedUpdate { type: "tool-call-completed"; callId: string; toolCall: ToolCall; modelCallId: string; }
interface TokenDeltaUpdate { type: "token-delta"; tokens: number; }
interface StepStartedUpdate { type: "step-started"; stepId: number; }
interface StepCompletedUpdate { type: "step-completed"; stepId: number; stepDurationMs: number; }
interface TurnEndedUpdate {
  type: "turn-ended";
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; };
}
interface UserMessageAppendedUpdate { type: "user-message-appended"; userMessage: UserMessage; }
interface SummaryUpdate { type: "summary"; summary: string; }
interface SummaryStartedUpdate { type: "summary-started"; }
interface SummaryCompletedUpdate { type: "summary-completed"; }
interface ShellOutputDeltaUpdate { type: "shell-output-delta"; event: Record<string, unknown>; }
```
</details>

> `turn-ended` 的 `usage` 可用来估算真实 token 成本。`PartialToolCallUpdate` 在模型提交工具调用前流式传参，同样适用"工具结构不稳定"的免责声明。

### 对话类型（run.conversation()）

按轮次组织的结构化视图，也作为 `onStep` 回调参数的一部分。

```typescript
type ConversationTurn =
  | { type: "agentConversationTurn"; turn: AgentConversationTurn }
  | { type: "shellConversationTurn"; turn: ShellConversationTurn };

interface AgentConversationTurn { userMessage?: UserMessage; steps: ConversationStep[]; }
interface ShellConversationTurn { shellCommand?: ShellCommand; shellOutput?: ShellOutput; }

type ConversationStep =
  | { type: "assistantMessage"; message: AssistantMessage }
  | { type: "toolCall"; message: ToolCall }
  | { type: "thinkingMessage"; message: ThinkingMessage };

interface AssistantMessage { text: string; }
interface ThinkingMessage { text: string; thinkingDurationMs?: number; }
interface UserMessage { text: string; }
interface ShellCommand { command: string; workingDirectory?: string; }
interface ShellOutput { stdout: string; stderr: string; exitCode: number; }
```

> `ToolCall` 是涵盖所有内置工具（shell、edit、read、write、glob、grep、ls、semSearch、mcp、task 等）的可辨识联合，结构仅供内部使用（见上方稳定性说明）。

---

## 九、恢复智能体会话

```typescript
function Agent.resume(agentId: string, options?: Partial<AgentOptions>): Promise<SDKAgent>;
```

按 ID 重连现有智能体。运行时按 ID 前缀自动检测（`bc-` 云端，其他本地）。

```typescript
await using agent = await Agent.resume("bc-abc123", {
  apiKey: process.env.CURSOR_API_KEY!,
});
const run = await agent.send("Also update the changelog");
await run.wait();
```

> 恢复时 `agent.model` 为 `undefined`，除非再次传 `model`。**内联 `mcpServers` 不在恢复后保留**（通常含机密、只存内存）——恢复时重传，或用基于文件的 MCP 配置（`.cursor/mcp.json` + `local.settingSources`）。

---

## 十、查看智能体与运行记录

列表端点返回 `{ items, nextCursor? }`，用游标分页。

```typescript
// 列出
function Agent.list(options?: ListAgentsOptions): Promise<ListResult<SDKAgentInfo>>;
type ListAgentsOptions = { limit?: number; cursor?: string; } & (
  | { runtime?: undefined }
  | { runtime: "local"; cwd?: string }
  | { runtime: "cloud"; prUrl?: string; includeArchived?: boolean; apiKey?: string }
);

// 获取（按 ID 前缀自动判断 bc- → 云端，否则本地）
function Agent.get(agentId: string, options?: GetAgentOptions): Promise<SDKAgentInfo>;
interface GetAgentOptions { cwd?: string; apiKey?: string; }

// 列出运行
function Agent.listRuns(agentId: string, options?: ListRunsOptions): Promise<ListResult<Run>>;
type ListRunsOptions = { limit?: number; cursor?: string; } & (
  | { runtime?: "local"; cwd?: string }
  | { runtime: "cloud"; apiKey?: string }
);

// 获取运行（云端需父级 agentId）
function Agent.getRun(runId: string, options?: GetRunOptions): Promise<Run>;
type GetRunOptions =
  | { runtime?: "local"; cwd?: string }
  | { runtime: "cloud"; agentId: string; apiKey?: string };
```

```typescript
const { items, nextCursor } = await Agent.list({
  runtime: "local",
  cwd: process.cwd(),
});
```

### 云端代理生命周期

云端代理保留在团队工作区直到归档或删除。`Agent.list({ runtime: "cloud" })` 默认隐藏已归档，传 `includeArchived: true` 可见，也可按 `prUrl` 过滤。

```typescript
function Agent.archive(agentId: string, options?: AgentOperationOptions): Promise<void>;
function Agent.unarchive(agentId: string, options?: AgentOperationOptions): Promise<void>;
function Agent.delete(agentId: string, options?: AgentOperationOptions): Promise<void>;
interface AgentOperationOptions { cwd?: string; apiKey?: string; }

await Agent.archive(agentId);     // 软删除；会话记录仍可读
await Agent.unarchive(agentId);   // 恢复
await Agent.delete(agentId);      // 永久删除；后续读取返回 404
```

### SDKAgentInfo

```typescript
type SDKAgentInfo = {
  agentId: string;
  name: string;
  summary: string;
  lastModified: number;
  status?: "running" | "finished" | "error";
  createdAt?: number;
  archived?: boolean;
} & (
  | { runtime?: undefined }
  | { runtime: "local"; cwd?: string }
  | { runtime: "cloud"; env?: { type: "cloud" | "pool" | "machine"; name?: string }; repos?: string[] }
);
```

---

## 十一、Cursor 命名空间

读账户级信息、目录内容，做进程范围 SDK 配置。读方法都可选传 `{ apiKey }`，否则回退 `CURSOR_API_KEY`。

### Cursor.configure()

```typescript
function Cursor.configure(options: CursorConfigureOptions): void;
interface CursorConfigureOptions {
  local?: {
    store?: LocalAgentStore | null;
    useHttp1ForAgent?: boolean | null;
  };
}
```

为本地智能体设默认值，应用到后续 `Agent.*`。单次调用字段会覆盖；传 `null` 清除默认。

| 选项 | 描述 |
|---|---|
| `local.store` | 省略 `local.store` 时的默认本地存储，默认 SQLite |
| `local.useHttp1ForAgent` | 强制本地后端流式用带 SSE 的 HTTP/1.1 而非 HTTP/2（代理环境或不支持 HTTP/2 的 fetch 栈有用） |

```typescript
import { Cursor, JsonlLocalAgentStore } from "@cursor/sdk";
Cursor.configure({
  local: {
    store: new JsonlLocalAgentStore("/var/lib/cursor-agents"),
    useHttp1ForAgent: true,
  },
});
```

### Cursor.me()

```typescript
function Cursor.me(options?: CursorRequestOptions): Promise<SDKUser>;
interface CursorRequestOptions { apiKey?: string; }
interface SDKUser { apiKeyName: string; userEmail?: string; createdAt: string; }
```

### Cursor.models.list()

```typescript
function Cursor.models.list(options?: CursorRequestOptions): Promise<SDKModel[]>;
type SDKModel = ModelListItem;
interface ModelListItem {
  id: string;
  displayName: string;
  description?: string;
  parameters?: ModelParameterDefinition[];
  variants?: ModelVariant[];
}
interface ModelParameterDefinition {
  id: string;
  displayName?: string;
  values: Array<{ value: string; displayName?: string }>;
}
interface ModelVariant { params: ModelParameterValue[]; displayName: string; description?: string; isDefault?: boolean; }
```

调 `Agent.create()` / `agent.send()` 前先查有效 model id 和各模型 params：

```typescript
const models = await Cursor.models.list();
const composer = models.find((model) => model.id === "composer-2.5");
console.log(composer?.parameters);
// [{ id: "thinking", displayName: "Thinking",
//    values: [{ value: "low", displayName: "Low" }, { value: "high", displayName: "High" }] }]
```

**最佳实践**：
- **先动态发现，不硬编码**：启动时（或每进程一次）调 `Cursor.models.list()` 并缓存。模型 ID 和参数结构会随新模型上线变化。
- **模型需要参数时显式传**：`parameters` 非空即参数化模型；不传则用每个参数的第一个允许值，可能不符预期。
- **按能力解析，不按 id**——目标模型不可用时回退 `{ id: "auto" }`：

```typescript
const models = await Cursor.models.list();
const composer = models.find((m) => m.id === "composer-2");
const reasoning = composer?.parameters?.find((p) => p.id === "thinking");
const high = reasoning?.values.find((v) => v.value === "high")?.value;
const model = composer
  ? { id: composer.id, params: high ? [{ id: "thinking", value: high }] : undefined }
  : { id: "auto" };
```

### Cursor.repositories.list()（仅云端）

```typescript
function Cursor.repositories.list(options?: CursorRequestOptions): Promise<SDKRepository[]>;
interface SDKRepository { url: string; }
```

返回调用用户所属团队已连接的 GitHub 仓库。

---

## 十二、配置来源优先级

MCP 服务器、子智能体、钩子都结合内联选项与磁盘配置解析，**优先级一致**：

> 单次发送内联 > 创建时内联 > 项目文件 > 用户文件 > 团队/仪表盘配置

| 功能 | 内联 | 项目文件 | 用户文件 | Cloud/仪表盘 |
|---|---|---|---|---|
| **MCP 服务器** | `create()` / `send()` 的 `mcpServers` | `.cursor/mcp.json`（需 `settingSources` 含 `"project"`） | `~/.cursor/mcp.json`（需含 `"user"`） | `cursor.com/agents` 配置（仅云端） |
| **子智能体** | `create()` 的 `agents` | `.cursor/agents/*.md`（frontmatter：name、description、model?） | n/a | 云端针对克隆仓库读相同项目文件 |
| **钩子** | 无（仅文件） | `.cursor/hooks.json`（+脚本） | `~/.cursor/hooks.json` | 云端运行项目钩子；企业版还支持团队/企业托管钩子 |
| **设置来源** | `local.settingSources` 选择加载哪些层 | `.cursor/` | `~/.cursor/` | 云端始终加载 project/team/plugins，忽略 `local.settingSources` |

> 内联值适合绝不应落盘的机密（单次运行 API 密钥、租户 token）。文件配置适合策略——尤其钩子，它是项目边界而非每次运行的开关。

---

## 十三、MCP 服务器

本地智能体从最多 5 个来源加载，名称冲突按首个匹配优先：

1. `agent.send()` 的 `mcpServers`（本次运行**完全替换**创建时的，不合并）
2. `Agent.create()` 的 `mcpServers`
3. 插件服务器（需 `settingSources` 含 `"plugins"`）
4. `.cursor/mcp.json` 项目服务器（需含 `"project"`）
5. `~/.cursor/mcp.json` 用户服务器（需含 `"user"`）

> 未设 `local.settingSources` 则只加载内联服务器。本地 MCP 需 OAuth 登录时，SDK 无法提示登录——只有你已在 Cursor 应用登录过才可用（SDK 复用已保存登录态）。

云端代理来源：`send()` 的 `mcpServers` → `create()` 的 `mcpServers` → `cursor.com/agents` 的用户/团队 MCP。内联服务器若不含 auth/headers 且你之前在 `cursor.com/agents` 授权过该 URL，用个人 API token 的运行会自动复用 OAuth token（服务账户 key 不与用户关联，无法回退用户认证）。`local.settingSources` 不适用于云端。

### 本地示例

```typescript
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "auto" },
  local: { cwd: process.cwd() },
  mcpServers: {
    docs: {
      type: "http",
      url: "https://example.com/mcp",
      auth: { CLIENT_ID: "client-id", scopes: ["read", "write"] },
    },
    filesystem: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
      cwd: process.cwd(),
    },
  },
});
```

### 云端示例

```typescript
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5" },
  cloud: { repos: [{ url: "https://github.com/your-org/your-repo", startingRef: "main" }] },
  mcpServers: {
    linear: {
      type: "http",
      url: "https://mcp.linear.app/sse",
      headers: { Authorization: `Bearer ${process.env.LINEAR_API_KEY!}` },
    },
    figma: {
      type: "http",
      url: "https://api.figma.com/mcp",
      auth: {
        CLIENT_ID: process.env.FIGMA_CLIENT_ID!,
        CLIENT_SECRET: process.env.FIGMA_CLIENT_SECRET!,
        scopes: ["file_content:read"],
      },
    },
    github: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN! },
    },
  },
});
```

- **headers**：透传静态 API 密钥/Bearer token，Cursor 每次请求透传。
- **auth**：OAuth 保护的服务器。云端时 Cursor 服务端跑一次 OAuth 流程并跨运行复用 token；本地无法开浏览器登录，只能复用 Cursor 应用已登录的 token。
- 云端 HTTP 的 headers/auth 由 Cursor 后端处理，敏感字段脱敏不进 VM；stdio 的 `env` 值进 VM（按运行时机密对待）。
- `cursor.com/agents` 配置的 MCP，OAuth 始终按用户隔离（即使团队级服务器）。

---

## 十四、子智能体

主智能体通过 Agent 工具创建命名子智能体。内联：

```typescript
const agent = await Agent.create({
  model: { id: "composer-2.5" },
  apiKey: process.env.CURSOR_API_KEY!,
  local: { cwd: process.cwd() },
  agents: {
    "code-reviewer": {
      description: "Expert code reviewer for quality and security.",
      prompt: "Review code for bugs, security issues, and proven approaches.",
      model: "inherit",
    },
    "test-writer": {
      description: "Writes tests for code changes.",
      prompt: "Write comprehensive tests for the given code.",
    },
  },
});
```

- 仓库中 `.cursor/agents/*.md`（含 name、description、可选 model frontmatter）也会被读，内联定义覆盖同名文件定义。
- **嵌套子智能体**：子智能体可创建自己的子智能体，每层都能访问同一组命名子智能体和自定义工具，开箱即用无需配置。

---

## 十五、自定义工具（仅本地）

无需搭建单独 MCP 服务器即可把你的函数给智能体用。传入 `local.customTools`，SDK 注册为名为 `custom-user-tools` 的 MCP 服务器，子智能体（含嵌套）也能用，受同一权限控制。

> ⚠️ **仅本地。** 给云端代理传 `local.customTools` 会抛 `ConfigurationError`。

```typescript
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5" },
  local: {
    cwd: process.cwd(),
    customTools: {
      get_deployment_status: {
        description: "Look up the current deployment status for a service.",
        inputSchema: {
          type: "object",
          properties: { service: { type: "string", description: "Service name" } },
          required: ["service"],
        },
        async execute({ service }) {
          const res = await fetch(`https://deploys.internal/api/${service}`);
          const body = await res.json();
          return `Service ${service} is ${body.status} (build ${body.build}).`;
        },
      },
    },
  },
});
await agent.send("Is the checkout service deployed yet?").then((r) => r.wait());
```

`create()` 设的工具应用于每次运行；`send()` 传 `local.customTools` 替换该次运行的工具：

```typescript
await agent.send("Roll forward if the canary is healthy", {
  local: {
    customTools: {
      promote_canary: {
        description: "Promote the current canary build to production.",
        async execute() {
          await promoteCanary();
          return { content: [{ type: "text", text: "Promoted." }] };
        },
      },
    },
  },
});
```

### 工具定义与结果

```typescript
interface SDKCustomTool {
  description?: string;
  inputSchema?: Record<string, SDKJsonValue>;
  execute: (args: Record<string, SDKJsonValue>, context: SDKCustomToolContext)
    => SDKCustomToolResult | Promise<SDKCustomToolResult>;
}
interface SDKCustomToolContext { toolCallId?: string; }

type SDKCustomToolResult =
  | string
  | SDKJsonValue
  | { content: SDKCustomToolContent[]; isError?: boolean; structuredContent?: Record<string, SDKJsonValue>; };
type SDKCustomToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType?: string };
```

| 字段 | 描述 |
|---|---|
| `description` | 展示给模型，告知何时调用。默认空字符串 |
| `inputSchema` | 参数 JSON Schema。默认接受任意属性的开放对象 |
| `execute` | 你的回调，接收解析后的 `args` 和含 `toolCallId` 的 `context`，在你的进程运行 |

返回值：`string` → 纯文本；任意 JSON 值 → 作为文本发回，对象还填 `structuredContent`；envelope → 完全控制（混合文本+base64 图像、`isError: true` 报失败、附 `structuredContent`）。`execute` 抛异常也作为工具错误报给智能体。

---

## 十六、钩子（仅文件配置）

> ⚠️ **钩子只支持文件配置，没有可编程回调。** 钩子是项目策略边界，不是单次运行的开关。

- **本地**：`.cursor/hooks.json` 加到 `local.cwd` 的仓库，或 `~/.cursor/hooks.json` 做 user-level。
- **云端**：`.cursor/hooks.json` 及脚本提交到 `cloud.repos` 的仓库，SDK 创建的云端代理自动加载项目钩子；企业版还运行团队钩子和企业管理钩子。

配置格式见官方 **钩子** 文档。

---

## 十七、沙箱（仅本地）

默认 `local.sandboxOptions.enabled: false`——智能体可读写工作目录、执行 shell、无限制访问网络（无头运行无人工批准，默认开沙箱会静默阻止合法调用或要求不适合脚本的回调）。

启用后限制每次 shell 工具调用及子进程：

- **文件系统**：写入仅限工作目录（`local.cwd`）和少量允许路径，工作区外无法读。
- **Shell**：在平台沙箱运行（Linux bubblewrap，macOS seatbelt，加 `@cursor/sdk-<os>-<arch>` 辅助程序），特权操作被拒。
- **网络**：默认禁出站。放 `.cursor/sandbox.json` 列允许主机；存在时也读 `~/.cursor/sandbox.json` 用户级策略。

```typescript
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2" },
  local: { cwd: process.cwd(), sandboxOptions: { enabled: true } },
});
```

> 主机不支持沙箱隔离（旧 Linux 没 bubblewrap、缺辅助二进制）时抛 `ConfigurationError`，消息指出缺失依赖。禁用 `sandboxOptions.enabled` 或改云端模式即可恢复。云端运行始终在隔离 VM 中，`sandboxOptions` 不适用。

---

## 十八、Auto-review 模式（仅本地）

默认本地智能体不受限制执行所有工具调用。设 `local.autoReview: true` 后，本地工具调用改走 Auto-review（与 IDE 同一分类器），按安全性 + 与本次运行意图的匹配度，允许/阻止 Shell、MCP、Fetch 调用。

```typescript
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5" },
  local: { cwd: process.cwd(), autoReview: true },
});
```

- 需已连接后端启用分类器；不可用则回退默认行为。
- 无头运行无交互批准，被拦截的调用直接拒绝（不转批准请求），智能体收到拦截原因并可换法。
- 可用工作区 `permissions.json` 的 `autoRun` 块引导分类器（同 IDE）。

> ⚠️ **分类器是尽力而为的便捷功能，不是安全边界。** 严格控制必须叠 `sandboxOptions` 或允许列表。云端运行本身在隔离 VM，不适用。

---

## 十九、产出物（Artifacts）

```typescript
interface SDKArtifact { path: string; sizeBytes: number; updatedAt: string; }

const artifacts: SDKArtifact[] = await agent.listArtifacts();
for (const artifact of artifacts) console.log(artifact.path, artifact.sizeBytes);
const buffer = await agent.downloadArtifact(artifacts[0].path);
```

> 产出物支持取决于运行时。**本地 SDK 智能体目前不返回任何产出物**，`downloadArtifact` 会抛异常。

---

## 二十、资源管理与生命周期

### 释放

```typescript
await using agent = await Agent.create({ /* ... */ }); // 代码块结束自动释放
// 或显式：
await agent[Symbol.asyncDispose]();
```

`agent.close()` 是不等待即开始释放的方式（不用 `await using` 语法时优先它）。`agent.reload()` 不释放，加载文件系统配置更改（钩子、项目 MCP、子智能体）。

### 对话上下文

- **本地**：对话状态持久化到检查点存储（默认主目录磁盘 SQLite，可换 JSONL/自定义）。每次 `send()` 加载最新检查点传给模型，进程重启后仍保留，新进程 `Agent.resume(agentId)` 从上次停处继续。
- **云端**：服务器端持久化，从任何地方重连回到同一段对话。

**看似上下文丢失但其实不是**：
- 新 `Agent.create()` 总启动带新 `agentId` 的全新智能体——要续对话，第一次保存 `agent.agentId` 再 `Agent.resume(agentId)`。
- `Agent.prompt()` 一次性创建-运行-释放，没有第二轮（设计如此）。
- 内联 `mcpServers` 不在 `Agent.resume()` 后保留（含机密）——恢复时重传或用文件配置。

### 重连进行中的运行

```typescript
const agent = await Agent.resume("bc-abc123", { apiKey: process.env.CURSOR_API_KEY! });
const run = await agent.send("Apply the suggested fix");
const result = await run.wait();
```

重连时若运行已进行中，`Agent.getRun(runId, { runtime: "cloud", agentId })`（或本地版）返回 `Run`，可 `stream()` / `wait()` / `cancel()`。

---

## 二十一、调度器模式

维护 `agentId → 长存 SDKAgent` 的映射，按键（用户/仓库/工单）路由提示词；进程重启清空内存映射后，从磁盘 `Agent.resume()` 恢复。

```typescript
import { Agent, type SDKAgent } from "@cursor/sdk";

const agents = new Map<string, SDKAgent>();

async function getAgent(key: string, savedId?: string): Promise<SDKAgent> {
  const existing = agents.get(key);
  if (existing) return existing;
  const agent = savedId
    ? await Agent.resume(savedId, { apiKey: process.env.CURSOR_API_KEY! })
    : await Agent.create({
        apiKey: process.env.CURSOR_API_KEY!,
        model: { id: "composer-2" },
        local: { cwd: process.cwd() },
      });
  agents.set(key, agent);
  return agent;
}

async function handleMessage(key: string, prompt: string, savedId?: string) {
  const agent = await getAgent(key, savedId);
  const run = await agent.send(prompt);
  return run.wait();
}
```

> Cloud SSE 流在运行开始后保留一段历史积压，分发给多订阅者的调度器可在每个订阅者处 `run.stream()` 不丢之前事件。真正长跑的云端运行通常改扇出到 `run.wait()`，订阅者需结构化记录时轮询 `run.conversation()`。

---

## 二十二、本地智能体存储

本地智能体把元数据、对话检查点、运行记录、运行事件持久化到磁盘，使后续操作和 `Agent.resume()` 跨进程重启保留。默认 `SqliteLocalAgentStore`（主目录状态根下磁盘 SQLite），可用 `local.store` 替换。

| 存储 | 导入 | 何时使用 |
|---|---|---|
| `SqliteLocalAgentStore` | `@cursor/sdk` | 默认。工作区状态根下磁盘 SQLite |
| `JsonlLocalAgentStore` | `@cursor/sdk` | 你指定目录下的便携 NDJSON 文件，便于查看/复制/比较 |
| 自定义 `LocalAgentStore` | 你的代码 | 持久化到任何位置：内存/Redis/Postgres/托管数据库 |

> 云端代理服务器端持久化，`local.store` 仅适用于本地。

### JSONL 存储

写 4 个 NDJSON 文件（`agents.ndjson`、`runs.ndjson`、`run_events.ndjson`、`checkpoints.ndjson`）：

```typescript
import { Agent, JsonlLocalAgentStore } from "@cursor/sdk";
const store = new JsonlLocalAgentStore("/var/lib/cursor-agents");
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5" },
  local: { cwd: process.cwd(), store },
});
```

> 在 `Agent.resume()` 和本地 list/get（`Agent.list/get/listRuns/getRun`）中传同一个 store 实例，读同一份数据。

### 进程级默认（避免每次传 store）

```typescript
import { Cursor, JsonlLocalAgentStore } from "@cursor/sdk";
Cursor.configure({ local: { store: new JsonlLocalAgentStore("/var/lib/cursor-agents") } });
// 后续调用用已配置存储，除非传自定义；传 store: null 清除默认改回 SQLite
```

### 自定义存储

实现 `LocalAgentStore`（4 个子存储），或分别构建再 `composeLocalAgentStore` 组合：

```typescript
interface LocalAgentStore {
  readonly agents: LocalAgentStoreAgents;            // 智能体元数据行
  readonly checkpoints: LocalAgentStoreCheckpoints;  // 内容寻址的对话数据块
  readonly runs: LocalAgentStoreRuns;                // 运行记录行
  readonly runEvents: LocalAgentStoreRunEvents;      // 仅追加的运行事件日志
}

import { composeLocalAgentStore } from "@cursor/sdk";
const store = composeLocalAgentStore({
  agents: myAgentsTable,
  checkpoints: myCheckpointBlobs,
  runs: myRunsTable,
  runEvents: myRunEventLog,
});
```

> 子存储对应默认 SQLite 表：`agents`（每智能体一行，带 `latestCheckpoint.rootBlobId` 指针）、`checkpoints`（按内容寻址的检查点 blob）、`runs`（每次运行一行）、`runEvents`（仅追加流日志）。Catalog 用不透明 cursor/nextCursor 分页；事件日志用排他 afterOffset/nextOffset 恢复。

---

## 二十三、配置参考

### AgentOptions

| 属性 | 类型 | 默认 | 描述 |
|---|---|---|---|
| `model` | `ModelSelection` | 本地必填；云端回退服务器默认 | 要用的模型 |
| `apiKey` | `string` | `CURSOR_API_KEY` env | 用户或服务账户密钥（不支持团队 Admin 密钥） |
| `name` | `string` | 自动生成 | 易识别名称，`list/get` 中作 title 返回 |
| `local` | `LocalAgentOptions` | | 本地配置 |
| `cloud` | `CloudOptions` | | 云端配置 |
| `mcpServers` | `Record<string, McpServerConfig>` | | 内联 MCP 定义 |
| `agents` | `Record<string, AgentDefinition>` | | 子智能体定义 |
| `agentId` | `string` | 自动生成 | 持久化智能体 ID，传入可保持稳定 ID |
| `mode` | `"agent" \| "plan"` | `"agent"` | 首次运行初始对话模式 |

### LocalAgentOptions

| 属性 | 类型 | 默认 | 描述 |
|---|---|---|---|
| `cwd` | `string \| string[]` | | 工作区路径或路径列表 |
| `settingSources` | `SettingSource[]` | | 加载哪些设置层 |
| `sandboxOptions` | `{ enabled: boolean }` | `{ enabled: false }` | 沙箱配置 |
| `autoReview` | `boolean` | `false` | 本地工具调用走 Auto-review |
| `customTools` | `Record<string, SDKCustomTool>` | | 以 `custom-user-tools` MCP 公开的自定义工具 |
| `store` | `LocalAgentStore` | `SqliteLocalAgentStore` | 持久化后端 |

### CloudOptions

| 属性 | 类型 | 默认 | 描述 |
|---|---|---|---|
| `env` | `{ type: "cloud"\|"pool"\|"machine"; name? }` | `{ type: "cloud" }` | 执行环境目标。`cloud`=Cursor 托管 VM（`name` 用已保存环境）；`pool`=自托管用量池；`machine`=指定我的机器 worker。省略 repos 且 env 默认可建空工作区无仓库的智能体。命名环境与显式 repos 互斥 |
| `repos` | `Array<{ url; startingRef?; prUrl? }>` | | 克隆到 VM 的仓库。单仓库一条，多仓库最多 20 条。与命名 env.name 互斥。传 `prUrl` 关联现有 PR |
| `workOnCurrentBranch` | `boolean` | `false` | 推到现有分支而非建新分支 |
| `autoCreatePR` | `boolean` | `false` | 运行结束打开 PR |
| `skipReviewerRequest` | `boolean` | `false` | 跳过把发起者加为 PR 审阅人 |
| `envVars` | `Record<string, string>` | | 会话级环境变量（见上文）|

### AgentDefinition

| 属性 | 类型 | 默认 | 描述 |
|---|---|---|---|
| `description` | `string` | 必填 | 何时用此子智能体，展示给父智能体 |
| `prompt` | `string` | 必填 | 子智能体系统提示词 |
| `model` | `ModelSelection \| "inherit"` | `"inherit"` | 模型覆盖，`"inherit"` 继承父级 |
| `mcpServers` | `Array<string \| Record<string, McpServerConfig>>` | | 此子智能体可用的 MCP（名称参考父级 `mcpServers`） |

### 其他类型

```typescript
interface ModelSelection { id: string; params?: ModelParameterValue[]; }
interface ModelParameterValue { id: string; value: string; }

type McpServerConfig =
  | { type?: "stdio"; command: string; args?: string[]; env?: Record<string, string>; cwd?: string; } // cwd 仅本地
  | { type?: "http" | "sse"; url: string; headers?: Record<string, string>;
      auth?: { CLIENT_ID: string; CLIENT_SECRET?: string; scopes?: string[]; }; };

interface SDKUserMessage { text: string; images?: SDKImage[]; }
type SDKImage =
  | { url: string; dimension?: SDKImageDimension }
  | { data: string; mimeType: string; dimension?: SDKImageDimension };
interface SDKImageDimension { width: number; height: number; }

type SettingSource = "project" | "user" | "team" | "mdm" | "plugins" | "all";

interface ListResult<T> { items: T[]; nextCursor?: string; }
```

`SettingSource` 控制本地加载哪些磁盘设置层（云端始终加载 project/team/plugins 并忽略此字段）：

| 值 | 来源 |
|---|---|
| `"project"` | 工作区 `.cursor/` |
| `"user"` | `~/.cursor/` |
| `"team"` | 仪表盘同步的团队设置 |
| `"mdm"` | MDM 管理的企业设置 |
| `"plugins"` | 插件提供的设置 |
| `"all"` | 以上全部 |

---

## 二十四、错误处理

所有 SDK 错误继承 `CursorSdkError`（向后兼容重新导出为 `CursorAgentError`）。用 `isRetryable` 驱动重试，用 `code` / `status` / `requestId` 诊断。

```typescript
class CursorSdkError extends Error {
  readonly code?: string;       // 稳定的 SDK/后端代码
  readonly status?: number;     // HTTP 状态码（如有）
  readonly cause?: unknown;     // 封装的底层错误
  readonly endpoint?: string;
  readonly requestId?: string;
  readonly operation?: string;  // 触发该错误的 SDK 操作
}
```

| 错误类 | 典型消息 | 可能原因 | 修复 |
|---|---|---|---|
| `AuthenticationError` | "API 密钥无效" | 缺/错 `CURSOR_API_KEY`、令牌过期、密钥被禁用 | 重新生成密钥；确认权限 |
| `RateLimitError` | "超出速率/用量限制" | 突发请求限制或每月上限 | 指数退避重试（临时性 `isRetryable: true`）；月上限则提升套餐 |
| `ConfigurationError` | "模型名称错误"/"API 密钥不受支持"/"文件不受支持" | `model.id` 无效、缺必填 params、不支持的文件、策略阻止 | 调 `Cursor.models.list()` 确认 id/params；检查路径 |
| `AgentBusyError` | "智能体正忙" | 云端代理已有 CREATING/RUNNING 运行时又发请求 | 等当前运行完成、取消，或轮询 `Agent.listRuns()` |
| `IntegrationNotConnectedError` | "[provider] 集成未连接" | 为仓库建云端代理但 SCM 提供方未连接团队 | 打开 `error.helpUrl` 重连后重试 |
| `NetworkError` | "服务不可用"/"超时" | 临时后端问题、网络分区、超时 | 退避重试；提工单看 `error.requestId` |
| `UnsupportedRunOperationError` | "此运行时不支持 X 操作" | 调用当前运行时无法满足的 Run 方法 | 先用 `run.supports()` / `run.unsupportedReason()` 判断 |
| `UnknownAgentError` | 服务器定义 | 未分类后端/运行时错误 | 看 `error.code` / `protoErrorCode` / `cause` |

### IntegrationNotConnectedError

```typescript
class IntegrationNotConnectedError extends ConfigurationError {
  readonly provider: string;   // "github" / "gitlab" / "azuredevops"
  readonly helpUrl: string;    // 仪表盘重连链接
}
```

> 默认消息不含 `helpUrl`，捕获时显式记录并展示给用户。今后更多错误也可能加 `helpUrl`。

```typescript
import { Agent, IntegrationNotConnectedError } from "@cursor/sdk";
// catch 时检查 error.helpUrl
```

### AgentBusyError（409）

```typescript
class AgentBusyError extends CursorAgentError {
  readonly code: "agent_busy";
  readonly status: 409;
  readonly isRetryable: false;
}
```

`isRetryable` 为 false，立即重试会一直失败直到活动 run 进入终态或被取消。其他 409（如 `agent_archived`）改抛 `ConfigurationError`。

```typescript
import { Agent, AgentBusyError } from "@cursor/sdk";
const agent = await Agent.resume("bc-00000000-0000-0000-0000-000000000001");
try {
  await agent.send({ text: "Also add tests for the auth middleware." });
} catch (err) {
  if (err instanceof AgentBusyError) {
    const runs = await Agent.listRuns(agent.agentId, { runtime: "cloud", limit: 1 });
    const active = runs.items[0];
    if (active?.status === "running") await active.cancel();
    await agent.send({ text: "Also add tests for the auth middleware." });
    return;
  }
  throw err;
}
```

> 本地智能体不返回 `agent_busy`。开始新本地运行前用 `send({ local: { force: true } })` 把卡住的本地运行标记过期。

### UnsupportedRunOperationError

```typescript
class UnsupportedRunOperationError extends ConfigurationError {
  readonly operation: RunOperation;
}
```

当前 runtime 无法使用某 Run 操作时抛。调用前用 `run.supports(operation)` 和 `run.unsupportedReason(operation)` 检查。

---

## 二十五、已知限制（重点记牢）

1. **内联 `mcpServers` 不在 `Agent.resume()` 后保留**——需要则恢复时重传。
2. **自定义工具（`local.customTools`）、Auto-review（`local.autoReview`）、自定义存储（`local.store`）仅本地。** 云端拒绝 `local.customTools`，并在服务器端持久化。
3. **本地智能体暂不支持下载产出物**（`listArtifacts()` 返回空列表，`downloadArtifact()` 抛异常）。
4. **`local.settingSources`（及它控制的文件式 MCP/子智能体路径）不适用于云端。** 云端始终加载 project/team/plugins。
5. **钩子仅支持文件式（`.cursor/hooks.json`），不支持可编程回调。**
6. **SDK 不会自动从本地安装的 Cursor app 发现凭据**，必须显式设 `CURSOR_API_KEY`（或传 `apiKey`）。
7. **本地模式需支持平台 sandbox helper 的 Node 运行时。** 默认 `SqliteLocalAgentStore` 还需 `sqlite3`；切到 `JsonlLocalAgentStore` 或自定义 `local.store` 可避免引入 SQLite 依赖。
