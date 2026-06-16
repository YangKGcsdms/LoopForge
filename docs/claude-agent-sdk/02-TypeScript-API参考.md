# TypeScript SDK API 参考（沉淀自 Claude Agent SDK 官方文档）

> 源：https://code.claude.com/docs/zh-CN/agent-sdk/typescript

本文档忠实沉淀 Claude Agent SDK 官方 TypeScript API 参考页。散文部分译为中文；所有 `type` / `interface` 名、字段名、enum 取值、函数签名、代码块一律原样保留。Python 部分已省略。

> 提示：本页内容由官方文档抓取整理。个别类型（尤其 `PermissionUpdate`）在抓取过程中出现两种不同形态，本文档以更结构化、与 SDK 实际一致的联合类型（`addRules` / `replaceRules` / … 变体）为准，并在对应处保留差异说明。涉及类型字段较多，建议结合官方原页与 SDK 类型声明（`.d.ts`）二次核对。

---

## 安装

```bash
npm install @anthropic-ai/claude-agent-sdk
```

SDK 将原生 Claude Code 二进制文件作为可选依赖（optional dependency）一起打包。如果你的包管理器跳过了可选依赖，请设置 [`pathToClaudeCodeExecutable`](#options-选项) 指向单独安装的 `claude` 二进制文件。

---

## query()

与 Claude Code 交互的主要函数。创建一个异步生成器（async generator），在消息到达时以流的形式返回它们。

```typescript
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query;
```

### 参数

| 参数 | 类型 | 说明 |
|:----------|:-----|:------------|
| `prompt` | `string \| AsyncIterable<SDKUserMessage>` | 输入提示，可以是字符串或异步可迭代对象（用于流式输入模式） |
| `options` | [`Options`](#options-选项) | 可选的配置对象 |

### 返回值

返回一个 [`Query`](#query-对象) 对象，它扩展了 `AsyncGenerator<SDKMessage, void>` 并附加了额外方法。

---

## startup()

在发送提示之前预热 CLI 子进程，把初始化成本从关键路径上移走。

```typescript
function startup(params?: {
  options?: Options;
  initializeTimeoutMs?: number;
}): Promise<WarmQuery>;
```

---

## Query 对象

由 `query()` 函数返回的接口。

```typescript
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  rewindFiles(
    userMessageId: string,
    options?: { dryRun?: boolean }
  ): Promise<RewindFilesResult>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setModel(model?: string): Promise<void>;
  setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
  applyFlagSettings(settings: { [K in keyof Settings]?: Settings[K] | null }): Promise<void>;
  initializationResult(): Promise<SDKControlInitializeResponse>;
  supportedCommands(): Promise<SlashCommand[]>;
  supportedModels(): Promise<ModelInfo[]>;
  supportedAgents(): Promise<AgentInfo[]>;
  mcpServerStatus(): Promise<McpServerStatus[]>;
  accountInfo(): Promise<AccountInfo>;
  reconnectMcpServer(serverName: string): Promise<void>;
  toggleMcpServer(serverName: string, enabled: boolean): Promise<void>;
  setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult>;
  streamInput(stream: AsyncIterable<SDKUserMessage>): Promise<void>;
  stopTask(taskId: string): Promise<void>;
  close(): void;
}
```

### 方法

| 方法 | 说明 |
|:-------|:------------|
| `interrupt()` | 中断查询（仅在流式输入模式下可用） |
| `rewindFiles(userMessageId, options?)` | 将文件回滚到指定用户消息时的状态。传入 `{ dryRun: true }` 可预览变更。需要 `enableFileCheckpointing: true`。 |
| `setPermissionMode(mode)` | 更改权限模式（仅在流式输入模式下可用） |
| `setModel(model?)` | 更改模型（仅在流式输入模式下可用） |
| `setMaxThinkingTokens(maxThinkingTokens)` | **已弃用：** 改用 `thinking` 选项。更改最大思考令牌数 |
| `applyFlagSettings(settings)` | 在运行时将设置合并进会话的 flag 设置层（仅在流式输入模式下可用）。详见 [`applyFlagSettings()`](#applyflagsettings) |
| `initializationResult()` | 返回完整的初始化结果，包括受支持的命令、模型、账户信息以及输出样式配置 |
| `supportedCommands()` | 返回可用的 slash 命令 |
| `supportedModels()` | 返回带显示信息的可用模型 |
| `supportedAgents()` | 以 [`AgentInfo`](#agentinfo)`[]` 形式返回可用的子代理 |
| `mcpServerStatus()` | 返回已连接 MCP 服务器的状态 |
| `accountInfo()` | 返回账户信息 |
| `reconnectMcpServer(serverName)` | 按名称重新连接一个 MCP 服务器 |
| `toggleMcpServer(serverName, enabled)` | 按名称启用或禁用一个 MCP 服务器 |
| `setMcpServers(servers)` | 动态替换本会话的 MCP 服务器。返回已添加、已移除服务器及任何错误的信息 |
| `streamInput(stream)` | 向查询流式输入消息，用于多轮对话 |
| `stopTask(taskId)` | 按 ID 停止一个正在运行的后台任务 |
| `close()` | 关闭查询并终止底层进程。强制结束查询并清理所有资源 |

### applyFlagSettings()

在不重启查询的前提下，更改运行中会话上的任意[设置](https://code.claude.com/docs/settings)。当某些没有专用 setter 的设置需要在会话中途更改时使用它，例如在 agent 读取了不受信任的输入后收紧 `permissions`。`setModel()` 和 `setPermissionMode()` 是这两个键的专用 setter；`applyFlagSettings()` 是接受任意设置键子集的通用形式，在此处传入 `model` 的行为与 `setModel()` 完全一致。

#### 会话中途生效的设置

只有某些键会在会话中途生效：

- **在下一轮生效：** `model`、`effortLevel`、`ultracode`、`permissions`、`hooks`、`skillOverrides`、`fastMode`、`awaySummaryEnabled`、`agent`。切换 `agent` 也会在下一轮应用该 agent 的模型覆盖、hooks 和系统提示。
- **会话中途无效：** 系统提示选项。它们在启动时解析一次，因此即使调用成功，运行中的会话仍保留原始值。要更改它们，请开启新会话。

```typescript
function applyFlagSettings(
  settings: { [K in keyof Settings]?: Settings[K] | null }
): Promise<void>;
```

这些值会被写入 flag 设置层，也就是内联 `query()` 的 `settings` 选项在启动时填充的同一层。Flag 设置位于[设置优先级顺序](https://code.claude.com/docs/settings#settings-precedence)的顶端附近：它们覆盖 user、project、local 设置，只有受管策略（managed policy）设置能够覆盖它们。

连续调用会浅合并（shallow-merge）顶层键。第二次以 `{ permissions: {...} }` 调用会替换上一次调用的整个 `permissions` 对象，而不是深合并进它。要从 flag 层清除某个键并回退到较低优先级来源，请为该键传入 `null`。传入 `undefined` 无效，因为 JSON 序列化会将其移除。

仅在流式输入模式下可用，约束与 `setModel()` 和 `setPermissionMode()` 相同。

```typescript
const q = query({ prompt: messageStream });

// 在会话剩余时间内覆盖模型
await q.applyFlagSettings({ model: "claude-opus-4-6" });

// 之后：清除覆盖并回退到较低优先级的设置
await q.applyFlagSettings({ model: null });
```

> 注：`applyFlagSettings()` 仅在 TypeScript 中可用。Python SDK 不提供等价方法。

---

## 工具与 MCP

### tool()

为与 SDK MCP 服务器一起使用而创建类型安全的 MCP 工具定义。

```typescript
function tool<Schema extends AnyZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations }
): SdkMcpToolDefinition<Schema>;
```

#### 参数

| 参数 | 类型 | 说明 |
|:------------ |:---------------------------------------------------------------- |:--------------------------------- |
| `name` | `string` | 工具的名称 |
| `description` | `string` | 工具功能的描述 |
| `inputSchema` | `Schema extends AnyZodRawShape` | 定义工具输入参数的 Zod 架构（支持 Zod 3 和 Zod 4） |
| `handler` | `(args, extra) => Promise<CallToolResult>` | 执行工具逻辑的异步函数 |
| `extras` | `{ annotations?: ToolAnnotations }` | 可选的 MCP 工具注释，为客户端提供行为提示 |

#### ToolAnnotations

从 `@modelcontextprotocol/sdk/types.js` 重新导出。所有字段都是可选提示；客户端不应依赖它们做出安全决策。

| 字段 | 类型 | 默认值 | 说明 |
|:--------------- |:-------- |:---------- |:------------------------------------------------------------- |
| `title` | `string` | `undefined` | 工具的人类可读标题 |
| `readOnlyHint` | `boolean` | `false` | 如果为 `true`，工具不会修改其环境 |
| `destructiveHint` | `boolean` | `true` | 如果为 `true`，工具可能执行破坏性更新（仅在 `readOnlyHint` 为 `false` 时有意义） |
| `idempotentHint` | `boolean` | `false` | 如果为 `true`，使用相同参数的重复调用没有额外效果（仅在 `readOnlyHint` 为 `false` 时有意义） |
| `openWorldHint` | `boolean` | `true` | 如果为 `true`，工具与外部实体交互（例如网络搜索）。如果为 `false`，工具的域是封闭的（例如内存工具） |

#### 示例

```typescript
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const searchTool = tool(
  "search",
  "Search the web",
  { query: z.string() },
  async ({ query }) => {
    return { content: [{ type: "text", text: `Results for: ${query}` }] };
  },
  { annotations: { readOnlyHint: true, openWorldHint: true } }
);
```

### createSdkMcpServer()

创建在与应用程序相同的进程中运行的 MCP 服务器实例。

```typescript
function createSdkMcpServer(options: {
  name: string;
  version?: string;
  tools?: Array<SdkMcpToolDefinition<any>>;
}): McpSdkServerConfigWithInstance;
```

#### 参数

| 参数 | 类型 | 说明 |
|:--------------- |:---------------------------- |:----------------------------- |
| `options.name` | `string` | MCP 服务器的名称 |
| `options.version` | `string` | 可选版本字符串 |
| `options.tools` | `Array<SdkMcpToolDefinition>` | 使用 [`tool()`](#tool) 创建的工具定义数组 |

### MCP 服务器配置类型

#### McpServerConfig

MCP 服务器的配置。

```typescript
type McpServerConfig =
  | McpStdioServerConfig
  | McpSSEServerConfig
  | McpHttpServerConfig
  | McpSdkServerConfigWithInstance;
```

#### McpStdioServerConfig

标准输入/输出（stdio）MCP 服务器配置，用于在子进程中运行本地 MCP 服务器。

```typescript
type McpStdioServerConfig = {
  type?: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
};
```

字段：

- `type`：协议类型，默认为 `"stdio"`
- `command`：要执行的命令
- `args`：传递给命令的参数数组
- `env`：传递给子进程的环境变量

#### McpSSEServerConfig

服务器发送事件（SSE）MCP 服务器配置，用于通过 HTTP 连接到远程 MCP 服务器。

```typescript
type McpSSEServerConfig = {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
};
```

字段：

- `type`：必须为 `"sse"`
- `url`：SSE 端点的 URL
- `headers`：发送给服务器的自定义 HTTP 头

#### McpHttpServerConfig

HTTP MCP 服务器配置，用于通过 HTTP 连接到远程 MCP 服务器。

```typescript
type McpHttpServerConfig = {
  type: "http";
  url: string;
  headers?: Record<string, string>;
};
```

字段：

- `type`：必须为 `"http"`
- `url`：MCP 服务器的 HTTP 端点 URL
- `headers`：发送给服务器的自定义 HTTP 头

#### McpSdkServerConfigWithInstance

SDK MCP 服务器配置，用于在与应用程序相同的进程中运行 MCP 服务器实例。

```typescript
type McpSdkServerConfigWithInstance = {
  type: "sdk";
  name: string;
  instance: McpServer;
};
```

字段：

- `type`：必须为 `"sdk"`
- `name`：服务器的名称
- `instance`：MCP 服务器实例（通常通过 `createSdkMcpServer()` 创建）

---

## 会话管理函数

- **`listSessions()`** —— 发现并列出过去的会话及其元数据
- **`getSessionMessages()`** —— 读取过去会话的用户和助手消息
- **`getSessionInfo()`** —— 按 ID 获取单个会话的元数据
- **`renameSession()`** —— 用自定义标题重命名会话
- **`tagSession()`** —— 为会话添加或移除标签

### resolveSettings()

使用与 CLI 相同的合并引擎，解析某个目录的有效（effective）Claude Code 设置。

```typescript
function resolveSettings(
  options?: ResolveSettingsOptions
): Promise<ResolvedSettings>;
```

---

## Options 选项

`query()`（以及 `startup()`）使用的配置对象。

```typescript
type Options = {
  abortController?: AbortController;
  additionalDirectories?: string[];
  agent?: string;
  agents?: Record<string, AgentDefinition>;
  agentProgressSummaries?: boolean;
  allowDangerouslySkipPermissions?: boolean;
  allowedTools?: string[];
  betas?: SdkBeta[];
  canUseTool?: CanUseTool;
  continue?: boolean;
  cwd?: string;
  debug?: boolean;
  debugFile?: string;
  disallowedTools?: string[];
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  enableFileCheckpointing?: boolean;
  env?: Record<string, string | undefined>;
  executable?: 'bun' | 'deno' | 'node';
  executableArgs?: string[];
  extraArgs?: Record<string, string | null>;
  fallbackModel?: string;
  forkSession?: boolean;
  forwardSubagentText?: boolean;
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
  includeHookEvents?: boolean;
  includePartialMessages?: boolean;
  loadTimeoutMs?: number;
  managedSettings?: Settings;
  maxBudgetUsd?: number;
  maxThinkingTokens?: number;
  maxTurns?: number;
  mcpServers?: Record<string, McpServerConfig>;
  model?: string;
  onElicitation?: (request: ElicitationRequest, options: { signal: AbortSignal }) => Promise<ElicitationResult>;
  outputFormat?: { type: 'json_schema'; schema: JSONSchema };
  outputStyle?: string;
  pathToClaudeCodeExecutable?: string;
  permissionMode?: PermissionMode;
  permissionPromptToolName?: string;
  persistSession?: boolean;
  planModeInstructions?: string;
  plugins?: SdkPluginConfig[];
  promptSuggestions?: boolean;
  resume?: string;
  resumeSessionAt?: string;
  sandbox?: SandboxSettings;
  sessionId?: string;
  sessionStore?: SessionStore;
  sessionStoreFlush?: 'batched' | 'eager';
  settings?: string | Settings;
  settingSources?: SettingSource[];
  skills?: string[] | 'all';
  spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess;
  stderr?: (data: string) => void;
  strictMcpConfig?: boolean;
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string; excludeDynamicSections?: boolean };
  taskBudget?: { total: number };
  thinking?: ThinkingConfig;
  title?: string;
  toolAliases?: Record<string, string>;
  toolConfig?: ToolConfig;
  tools?: string[] | { type: 'preset'; preset: 'claude_code' };
};
```

### 字段一览

| 字段 | 类型 | 默认值 | 说明 |
|:------|:-----|:--------|:------------|
| `abortController` | `AbortController` | `new AbortController()` | 用于取消操作的控制器 |
| `additionalDirectories` | `string[]` | `[]` | Claude 可访问的额外目录 |
| `agent` | `string` | `undefined` | 主线程使用的 agent 名称；必须在 `agents` 选项或设置中定义 |
| `agents` | `Record<string, AgentDefinition>` | `undefined` | 以编程方式定义的子代理 |
| `agentProgressSummaries` | `boolean` | `false` | 为 `true` 时，为子代理生成单行进度摘要；通过 `task_progress` 事件的 `summary` 字段转发 |
| `allowDangerouslySkipPermissions` | `boolean` | `false` | 启用权限绕过；使用 `permissionMode: 'bypassPermissions'` 时必需 |
| `allowedTools` | `string[]` | `[]` | 无需提示即自动批准的工具。不会把 Claude 限制为只能使用这些工具；未列出的工具由 `permissionMode` 和 `canUseTool` 处理。使用 `disallowedTools` 来阻止工具 |
| `betas` | `SdkBeta[]` | `[]` | 启用测试功能 |
| `canUseTool` | `CanUseTool` | `undefined` | 用于工具使用的自定义权限函数 |
| `continue` | `boolean` | `false` | 继续最近的对话 |
| `cwd` | `string` | `process.cwd()` | 当前工作目录 |
| `debug` | `boolean` | `false` | 为 Claude Code 进程启用调试模式 |
| `debugFile` | `string` | `undefined` | 将调试日志写入指定文件路径；隐式启用调试模式 |
| `disallowedTools` | `string[]` | `[]` | 要拒绝的工具。裸名称如 `"Bash"` 会从 Claude 的上下文中移除该工具。带作用域的规则如 `"Bash(rm *)"` 会保留工具可用，并在所有权限模式（包括 `bypassPermissions`）下拒绝匹配的调用 |
| `effort` | `'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max'` | `'high'` | 控制 Claude 在响应中投入的努力级别；与自适应思考协同，引导思考深度 |
| `enableFileCheckpointing` | `boolean` | `false` | 启用文件变更跟踪以便回滚。见 [file checkpointing](https://code.claude.com/docs/zh-CN/agent-sdk/file-checkpointing) |
| `env` | `Record<string, string \| undefined>` | `process.env` | 环境变量。设置后会替换（而非合并）子进程环境，而不是与 `process.env` 合并；传入 `{ ...process.env, YOUR_VAR: 'value' }` 以保留 `PATH` 等继承变量。设置 `CLAUDE_AGENT_SDK_CLIENT_APP` 可在 User-Agent 头中标识你的应用 |
| `executable` | `'bun' \| 'deno' \| 'node'` | 自动检测 | 要使用的 JavaScript 运行时 |
| `executableArgs` | `string[]` | `[]` | 传递给可执行文件的参数 |
| `extraArgs` | `Record<string, string \| null>` | `{}` | 额外参数 |
| `fallbackModel` | `string` | `undefined` | 主模型失败时使用的备用模型 |
| `forkSession` | `boolean` | `false` | 使用 `resume` 恢复时，fork 出新的会话 ID 而不是继续原会话 |
| `forwardSubagentText` | `boolean` | `false` | 将子代理的 text 和 thinking 块作为 assistant 与 user 消息转发，并设置 `parent_tool_use_id`，以便消费者渲染嵌套的对话记录。默认情况下，仅转发子代理发出的 `tool_use` 和 `tool_result` 块 |
| `hooks` | `Partial<Record<HookEvent, HookCallbackMatcher[]>>` | `{}` | 各事件的 Hook 回调 |
| `includeHookEvents` | `boolean` | `false` | 在消息流中以 `SDKHookStartedMessage`、`SDKHookProgressMessage` 和 `SDKHookResponseMessage` 形式包含 hook 生命周期事件 |
| `includePartialMessages` | `boolean` | `false` | 包含部分消息事件 |
| `loadTimeoutMs` | `number` | `60000` | *Alpha。* 在恢复物化（resume materialization）期间，每次 `sessionStore.load()` 和 `sessionStore.listSubkeys()` 调用的超时。如果适配器未在此窗口内解析，则查询失败而非挂起。未设置 `sessionStore` 时忽略 |
| `managedSettings` | `Settings` | `undefined` | 由生成的父级提供的策略层设置。当机器拥有 IT 受控的受管设置层时被移除，除非管理员选择了 `parentSettingsBehavior: 'merge'`。无论如何都会被过滤为仅限制性（restriction-only）键 |
| `maxBudgetUsd` | `number` | `undefined` | 当客户端成本估算达到此美元值时停止查询。与 `total_cost_usd` 使用同一估算口径比较；准确性说明见 [cost tracking](https://code.claude.com/docs/zh-CN/agent-sdk/cost-tracking) |
| `maxThinkingTokens` | `number` | `undefined` | *已弃用：* 改用 `thinking`。思考过程的最大令牌数 |
| `maxTurns` | `number` | `undefined` | 最大 agent 轮次数（工具使用往返） |
| `mcpServers` | `Record<string, McpServerConfig>` | `{}` | MCP 服务器配置 |
| `model` | `string` | CLI 默认值 | 要使用的 Claude 模型 |
| `onElicitation` | `(request: ElicitationRequest, options: { signal: AbortSignal }) => Promise<ElicitationResult>` | `undefined` | 处理 MCP elicitation 请求的回调。当 MCP 服务器请求用户输入且没有 hook 先处理时调用。未提供时，未处理的 elicitation 请求会被自动拒绝 |
| `outputFormat` | `{ type: 'json_schema'; schema: JSONSchema }` | `undefined` | 为 agent 结果定义输出格式。见 [structured outputs](https://code.claude.com/docs/zh-CN/agent-sdk/structured-outputs) |
| `outputStyle` | `string` | `undefined` | *非 `Options` 字段。* 应改在内联 `settings` 对象或设置文件中设置。见 [activating output styles](https://code.claude.com/docs/zh-CN/agent-sdk/modifying-system-prompts#activate-an-output-style) |
| `pathToClaudeCodeExecutable` | `string` | 自动从打包二进制解析 | Claude Code 可执行文件的路径。仅当安装时跳过了可选依赖，或你的平台不在受支持集合中时才需要 |
| `permissionMode` | `PermissionMode` | `'default'` | 会话权限模式 |
| `permissionPromptToolName` | `string` | `undefined` | 用于权限提示的 MCP 工具名称 |
| `persistSession` | `boolean` | `true` | 为 `false` 时，禁用会话到磁盘的持久化。此后会话无法恢复 |
| `planModeInstructions` | `string` | `undefined` | Plan 模式的自定义工作流指令。当 `permissionMode` 为 `'plan'` 时，替换默认 Plan 模式工作流主体。CLI 仍会用只读强制头和 ExitPlanMode 协议尾包裹它 |
| `plugins` | `SdkPluginConfig[]` | `[]` | 从本地路径加载自定义插件。见 [Plugins](https://code.claude.com/docs/zh-CN/agent-sdk/plugins) |
| `promptSuggestions` | `boolean` | `false` | 启用提示建议。每轮后发出 `prompt_suggestion` 消息，包含预测的下一个用户提示 |
| `resume` | `string` | `undefined` | 要恢复的会话 ID |
| `resumeSessionAt` | `string` | `undefined` | 在特定消息 UUID 处恢复会话 |
| `sandbox` | `SandboxSettings` | `undefined` | 以编程方式配置 sandbox 行为。见 [SandboxSettings](#sandboxsettings) |
| `sessionId` | `string` | 自动生成 | 为会话使用指定 UUID，而非自动生成 |
| `sessionStore` | `SessionStore` | `undefined` | 将会话记录镜像到外部后端，以便任何主机都能恢复它们。见 [session storage](https://code.claude.com/docs/zh-CN/agent-sdk/session-storage) |
| `sessionStoreFlush` | `'batched' \| 'eager'` | `'batched'` | *Alpha。* `sessionStore` 的刷新模式。未设置 `sessionStore` 时忽略 |
| `settings` | `string \| Settings` | `undefined` | 内联设置对象或设置文件路径。填充[优先级顺序](https://code.claude.com/docs/zh-CN/settings#settings-precedence)中的 flag 设置层。运行时更改用 [`applyFlagSettings()`](#applyflagsettings) |
| `settingSources` | `SettingSource[]` | CLI 默认（所有源） | 控制要加载哪些文件系统设置源。传入 `[]` 可禁用 user、project、local 设置。受管策略设置无论如何都会加载 |
| `skills` | `string[] \| 'all'` | `undefined` | 会话可用的 Skills。传 `'all'` 启用所有发现的 skill，或传 skill 名称列表。设置后，SDK 会自动将 Skill 工具加入 `allowedTools`。如果你也传了 `tools`，需在该列表中包含 `'Skill'` |
| `spawnClaudeCodeProcess` | `(options: SpawnOptions) => SpawnedProcess` | `undefined` | 用于生成 Claude Code 进程的自定义函数。用于在 VM、容器或远程环境中运行 Claude Code |
| `stderr` | `(data: string) => void` | `undefined` | stderr 输出的回调 |
| `strictMcpConfig` | `boolean` | `false` | 仅使用 `mcpServers` 中传入的服务器，忽略项目 `.mcp.json`、用户设置、插件提供的 MCP 服务器，以及 [claude.ai connectors](https://code.claude.com/docs/zh-CN/mcp#use-mcp-servers-from-claude-ai) |
| `systemPrompt` | `string \| { type: 'preset'; preset: 'claude_code'; append?: string; excludeDynamicSections?: boolean }` | `undefined`（最小提示） | 系统提示配置。传字符串以使用自定义提示，或传 `{ type: 'preset', preset: 'claude_code' }` 使用 Claude Code 的系统提示。使用 preset 对象形式时，加 `append` 以附加额外指令，设 `excludeDynamicSections: true` 把每会话上下文移到首个用户消息以便[跨用户/机器更好地缓存提示](https://code.claude.com/docs/zh-CN/agent-sdk/modifying-system-prompts#improve-prompt-caching-across-users-and-machines) |
| `taskBudget` | `{ total: number }` | `undefined` | *Alpha。* API 侧任务令牌预算。设置后，模型会被告知剩余令牌预算，以便调整工具使用节奏并在到达上限前完成 |
| `thinking` | `ThinkingConfig` | 受支持模型为 `{ type: 'adaptive' }` | 控制 Claude 的思考/推理行为。选项见 [`ThinkingConfig`](#thinkingconfig) |
| `title` | `string` | `undefined` | 会话的显示标题。通过 `resume` 或 `continue` 恢复时，被恢复会话的持久化标题优先；用 [`renameSession()`](#会话管理函数) 重命名已有会话 |
| `toolAliases` | `Record<string, string>` | `undefined` | 把内置工具名映射到 MCP 工具名，使 Claude 调用你的 MCP 实现而非内置实现。例如 `{ Bash: 'mcp__workspace__bash' }` |
| `toolConfig` | `ToolConfig` | `undefined` | 内置工具行为的配置。见 [`ToolConfig`](#toolconfig) |
| `tools` | `string[] \| { type: 'preset'; preset: 'claude_code' }` | `undefined` | 工具配置。传工具名数组，或用 preset 获取 Claude Code 的默认工具 |

---

## 枚举类型

### PermissionMode

```typescript
type PermissionMode =
  | "default"           // 标准权限行为
  | "acceptEdits"       // 自动接受文件编辑
  | "bypassPermissions" // 绕过所有权限检查
  | "plan"              // Plan Mode —— 仅读取工具
  | "dontAsk"           // 不提示权限，如果未预先批准则拒绝
  | "auto";             // 使用模型分类器批准或拒绝每个工具调用
```

### SettingSource

```typescript
type SettingSource = "user" | "project" | "local";
```

| 值 | 描述 | 位置 |
|:---------- |:----------------- |:---------------------------- |
| `'user'` | 全局用户设置 | `~/.claude/settings.json` |
| `'project'` | 共享项目设置（版本控制） | `.claude/settings.json` |
| `'local'` | 本地项目设置（gitignored） | `.claude/settings.local.json` |

#### 默认行为

当 `settingSources` 被省略或为 `undefined` 时，`query()` 加载与 Claude Code CLI 相同的文件系统设置：user、project 和 local。在所有情况下都会加载受管策略设置。

#### 设置优先级

加载多个源时，设置按此优先级合并（从高到低）：

1. 本地设置（`.claude/settings.local.json`）
2. 项目设置（`.claude/settings.json`）
3. 用户设置（`~/.claude/settings.json`）

编程选项（如 `agents`、`allowedTools` 和 `settings`）覆盖 user、project 和 local 文件系统设置。受管策略设置优先于编程选项。

---

## 权限类型

### CanUseTool

工具使用的自定义权限函数类型。

```typescript
type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: {
    signal: AbortSignal;
    suggestions?: PermissionUpdate[];
    blockedPath?: string;
    decisionReason?: string;
    toolUseID: string;
    agentID?: string;
  }
) => Promise<PermissionResult>;
```

### PermissionResult

`CanUseTool` 的返回类型。

```typescript
type PermissionResult =
  | {
      behavior: "allow";
      updatedInput?: Record<string, unknown>;
      updatedPermissions?: PermissionUpdate[];
      toolUseID?: string;
    }
  | {
      behavior: "deny";
      message: string;
      interrupt?: boolean;
      toolUseID?: string;
    };
```

- `behavior: "allow"`：批准工具调用。`updatedInput` 可改写传给工具的输入；`updatedPermissions` 返回要持久化的 `PermissionUpdate[]`。
- `behavior: "deny"`：拒绝工具调用。`message` 是返回给模型的拒绝原因；`interrupt: true` 可中断当前轮次。

### PermissionUpdate

权限更新结构，是一个联合类型，包含若干变体。

```typescript
type PermissionUpdate =
  | {
      type: "addRules";
      destination: PermissionUpdateDestination;
      rules: PermissionRule[];
    }
  | {
      type: "replaceRules";
      destination: PermissionUpdateDestination;
      rules: PermissionRule[];
    }
  | {
      type: "removeRules";
      destination: PermissionUpdateDestination;
      rules: PermissionRule[];
    }
  | {
      type: "setMode";
      destination: PermissionUpdateDestination;
      mode: PermissionMode;
    }
  | {
      type: "addDirectories";
      destination: PermissionUpdateDestination;
      directories: string[];
    }
  | {
      type: "removeDirectories";
      destination: PermissionUpdateDestination;
      directories: string[];
    };
```

> 抓取差异说明：另一次抓取返回了一个扁平形态的 `PermissionUpdate`（`{ type: "tool" | "path" | "pattern"; tool?; pattern?; path?; action: "allow" | "deny"; scope?; destination? }`，且 `PermissionUpdateDestination` 额外含 `"flagSettings"`）。该扁平形态疑似为模型对文档的简化/误读，本文档以上面的联合类型为准。`PermissionUpdateDestination` 的 `"flagSettings"` 取值请以官方原页与 SDK 类型声明二次核对。

### PermissionUpdateDestination

```typescript
type PermissionUpdateDestination =
  | "userSettings"
  | "projectSettings"
  | "localSettings";
```

指定权限更新应写入哪个设置文件（user、project 或 local）。

### PermissionRule

```typescript
type PermissionRule = {
  behavior: PermissionBehavior;
  toolName?: string;
  toolInput?: PermissionRuleValue;
  context?: ToolPermissionContext;
};
```

### PermissionBehavior

```typescript
type PermissionBehavior = "allow" | "deny";
```

决定规则是允许还是阻止工具使用。

### PermissionRuleValue

```typescript
type PermissionRuleValue = string | number | boolean | Record<string, unknown>;
```

表示可在权限规则中匹配的工具输入参数值。

### ToolPermissionContext

```typescript
type ToolPermissionContext = {
  filePath?: string;
  agentId?: string;
};
```

权限规则的可选上下文，用于根据以下条件有条件地应用规则：

- **`filePath`**：将规则限制到特定文件或文件模式
- **`agentId`**：仅在特定子代理上下文中应用规则

### 用法示例

在 `CanUseTool` 回调中，权限建议以 `PermissionUpdate[]` 形式返回：

```typescript
const canUseTool: CanUseTool = async (
  toolName,
  input,
  options
) => {
  // options.suggestions 包含 PermissionUpdate[] 建议
  // 例如 Bash 工具提示会包含一个 destination 为 localSettings 的建议

  if (toolName === "Bash") {
    return {
      behavior: "allow",
      updatedPermissions: options.suggestions, // 返回建议的更新
    };
  }

  return { behavior: "deny", message: "Tool not allowed" };
};
```

`CanUseTool` 选项中的 `suggestions` 数组提供了预构建的 `PermissionUpdate` 对象，当它们在 `PermissionResult.updatedPermissions` 中返回时，会被持久化到合适的设置文件（通常是 `.claude/settings.local.json`，用于会话本地持久化）。

---

## Hook 类型

Agent SDK 提供全面的 hook 支持，用于在 Claude Code 会话的整个生命周期中拦截并响应事件。

### HookEvent

可用的 hook 事件类型：

```typescript
type HookEvent =
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "PostToolBatch"
  | "Notification"
  | "UserPromptSubmit"
  | "SessionStart"
  | "SessionEnd"
  | "Stop"
  | "SubagentStart"
  | "SubagentStop"
  | "PreCompact"
  | "PermissionRequest"
  | "Setup"
  | "TeammateIdle"
  | "TaskCompleted"
  | "ConfigChange"
  | "WorktreeCreate"
  | "WorktreeRemove"
  | "MessageDisplay";
```

### HookCallback

Hook 回调函数类型：

```typescript
type HookCallback = (
  input: HookInput,
  toolUseID: string | undefined,
  options: { signal: AbortSignal }
) => Promise<HookJSONOutput>;
```

### HookCallbackMatcher

带可选匹配器的 hook 配置：

```typescript
interface HookCallbackMatcher {
  matcher?: string;
  hooks: HookCallback[];
  timeout?: number; // 此 matcher 中所有 hook 的超时时间（秒）
}
```

### HookInput

所有 hook 输入类型的联合：

```typescript
type HookInput =
  | PreToolUseHookInput
  | PostToolUseHookInput
  | PostToolUseFailureHookInput
  | PostToolBatchHookInput
  | NotificationHookInput
  | UserPromptSubmitHookInput
  | SessionStartHookInput
  | SessionEndHookInput
  | StopHookInput
  | SubagentStartHookInput
  | SubagentStopHookInput
  | PreCompactHookInput
  | PermissionRequestHookInput
  | SetupHookInput
  | TeammateIdleHookInput
  | TaskCompletedHookInput
  | ConfigChangeHookInput
  | WorktreeCreateHookInput
  | WorktreeRemoveHookInput
  | MessageDisplayHookInput;
```

#### BaseHookInput

所有 hook 输入类型都扩展的基础接口：

```typescript
type BaseHookInput = {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
  effort?: { level: string };
  agent_id?: string;
  agent_type?: string;
};
```

#### PreToolUseHookInput

在工具执行前触发：

```typescript
type PreToolUseHookInput = BaseHookInput & {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
};
```

#### PostToolUseHookInput

在工具成功执行后触发：

```typescript
type PostToolUseHookInput = BaseHookInput & {
  hook_event_name: "PostToolUse";
  tool_name: string;
  tool_input: unknown;
  tool_response: unknown;
  tool_use_id: string;
  duration_ms?: number;
};
```

#### PostToolUseFailureHookInput

在工具执行失败时触发：

```typescript
type PostToolUseFailureHookInput = BaseHookInput & {
  hook_event_name: "PostToolUseFailure";
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
  error: string;
  is_interrupt?: boolean;
  duration_ms?: number;
};
```

#### PostToolBatchHookInput

在一批工具调用全部解析后、下一次模型请求前触发：

```typescript
type PostToolBatchHookInput = BaseHookInput & {
  hook_event_name: "PostToolBatch";
  tool_calls: PostToolBatchToolCall[];
};

type PostToolBatchToolCall = {
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
  tool_response?: unknown;
};
```

#### NotificationHookInput

为通知触发：

```typescript
type NotificationHookInput = BaseHookInput & {
  hook_event_name: "Notification";
  message: string;
  title?: string;
  notification_type: string;
};
```

#### UserPromptSubmitHookInput

当用户提交提示时触发：

```typescript
type UserPromptSubmitHookInput = BaseHookInput & {
  hook_event_name: "UserPromptSubmit";
  prompt: string;
};
```

#### SessionStartHookInput

在会话开始时触发：

```typescript
type SessionStartHookInput = BaseHookInput & {
  hook_event_name: "SessionStart";
  source: "startup" | "resume" | "clear" | "compact";
  agent_type?: string;
  model?: string;
};
```

#### SessionEndHookInput

当会话结束时触发：

```typescript
type SessionEndHookInput = BaseHookInput & {
  hook_event_name: "SessionEnd";
  reason: ExitReason;
};
```

#### StopHookInput

当调用 stop 时触发：

```typescript
type StopHookInput = BaseHookInput & {
  hook_event_name: "Stop";
  stop_hook_active: boolean;
  last_assistant_message?: string;
  background_tasks?: BackgroundTaskSummary[];
  session_crons?: SessionCronSummary[];
};
```

#### SubagentStartHookInput

当子代理启动时触发：

```typescript
type SubagentStartHookInput = BaseHookInput & {
  hook_event_name: "SubagentStart";
  agent_id: string;
  agent_type: string;
};
```

#### SubagentStopHookInput

当子代理停止时触发：

```typescript
type SubagentStopHookInput = BaseHookInput & {
  hook_event_name: "SubagentStop";
  stop_hook_active: boolean;
  agent_id: string;
  agent_transcript_path: string;
  agent_type: string;
  last_assistant_message?: string;
  background_tasks?: BackgroundTaskSummary[];
  session_crons?: SessionCronSummary[];
};

type BackgroundTaskSummary = {
  id: string;
  type: string;
  status: string;
  description: string;
  command?: string;
  agent_type?: string;
  server?: string;
  tool?: string;
  name?: string;
};

type SessionCronSummary = {
  id: string;
  schedule: string;
  recurring: boolean;
  prompt: string;
};
```

#### PreCompactHookInput

在对话压缩前触发：

```typescript
type PreCompactHookInput = BaseHookInput & {
  hook_event_name: "PreCompact";
  trigger: "manual" | "auto";
  custom_instructions: string | null;
};
```

#### PermissionRequestHookInput

为权限请求触发：

```typescript
type PermissionRequestHookInput = BaseHookInput & {
  hook_event_name: "PermissionRequest";
  tool_name: string;
  tool_input: unknown;
  permission_suggestions?: PermissionUpdate[];
};
```

#### SetupHookInput

在 setup 期间触发：

```typescript
type SetupHookInput = BaseHookInput & {
  hook_event_name: "Setup";
  trigger: "init" | "maintenance";
};
```

#### TeammateIdleHookInput

当 agent 团队中的某个队友变为空闲时触发：

```typescript
type TeammateIdleHookInput = BaseHookInput & {
  hook_event_name: "TeammateIdle";
  teammate_name: string;
  team_name: string;
};
```

#### TaskCompletedHookInput

当任务完成时触发：

```typescript
type TaskCompletedHookInput = BaseHookInput & {
  hook_event_name: "TaskCompleted";
  task_id: string;
  task_subject: string;
  task_description?: string;
  teammate_name?: string;
  team_name?: string;
};
```

#### ConfigChangeHookInput

当配置变更时触发：

```typescript
type ConfigChangeHookInput = BaseHookInput & {
  hook_event_name: "ConfigChange";
  source:
    | "user_settings"
    | "project_settings"
    | "local_settings"
    | "policy_settings"
    | "skills";
  file_path?: string;
};
```

#### WorktreeCreateHookInput

当创建 worktree 时触发：

```typescript
type WorktreeCreateHookInput = BaseHookInput & {
  hook_event_name: "WorktreeCreate";
  name: string;
};
```

#### WorktreeRemoveHookInput

当移除 worktree 时触发：

```typescript
type WorktreeRemoveHookInput = BaseHookInput & {
  hook_event_name: "WorktreeRemove";
  worktree_path: string;
};
```

#### MessageDisplayHookInput

当消息被显示时触发：

```typescript
type MessageDisplayHookInput = BaseHookInput & {
  hook_event_name: "MessageDisplay";
  turn_id: string;
  message_id: string;
  index: number;
  final: boolean;
  delta: string;
};
```

### HookJSONOutput

Hook 返回值：

```typescript
type HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput;
```

#### AsyncHookJSONOutput

将 hook 标记为异步：

```typescript
type AsyncHookJSONOutput = {
  async: true;
  asyncTimeout?: number;
};
```

#### SyncHookJSONOutput

同步 hook 输出，带可选的事件特定响应：

```typescript
type SyncHookJSONOutput = {
  continue?: boolean;
  suppressOutput?: boolean;
  stopReason?: string;
  decision?: "approve" | "block";
  systemMessage?: string;
  reason?: string;
  hookSpecificOutput?:
    | {
        hookEventName: "PreToolUse";
        permissionDecision?: "allow" | "deny" | "ask" | "defer";
        permissionDecisionReason?: string;
        updatedInput?: Record<string, unknown>;
        additionalContext?: string;
      }
    | {
        hookEventName: "UserPromptSubmit";
        additionalContext?: string;
      }
    | {
        hookEventName: "SessionStart";
        additionalContext?: string;
      }
    | {
        hookEventName: "Setup";
        additionalContext?: string;
      }
    | {
        hookEventName: "SubagentStart";
        additionalContext?: string;
      }
    | {
        hookEventName: "PostToolUse";
        additionalContext?: string;
        updatedToolOutput?: unknown;
        /** @deprecated Use `updatedToolOutput`, which applies to all tools */
        updatedMCPToolOutput?: unknown;
      }
    | {
        hookEventName: "PostToolUseFailure";
        additionalContext?: string;
      }
    | {
        hookEventName: "PostToolBatch";
        additionalContext?: string;
      }
    | {
        hookEventName: "Notification";
        additionalContext?: string;
      }
    | {
        hookEventName: "PermissionRequest";
        decision:
          | {
              behavior: "allow";
              updatedInput?: Record<string, unknown>;
              updatedPermissions?: PermissionUpdate[];
            }
          | {
              behavior: "deny";
              message?: string;
              interrupt?: boolean;
            };
      };
};
```

### Hook 用法示例

```typescript
const query = query({
  prompt: "Analyze this code",
  options: {
    hooks: {
      PreToolUse: [
        {
          hooks: [
            async (input, toolUseID, { signal }) => {
              if (input.tool_name === "Bash") {
                return {
                  hookSpecificOutput: {
                    hookEventName: "PreToolUse",
                    permissionDecision: "ask",
                    additionalContext: "This bash command needs review"
                  }
                };
              }
              return { continue: true };
            }
          ]
        }
      ],
      PostToolUse: [
        {
          hooks: [
            async (input, toolUseID, { signal }) => {
              console.log(`Tool ${input.tool_name} completed`);
              return { continue: true };
            }
          ]
        }
      ]
    }
  }
});
```

更全面的用法模式见 [Hooks Guide](https://code.claude.com/docs/zh-CN/agent-sdk/hooks)。

---

## 消息类型

这些是 `query()` 流返回的所有消息类型。所有消息类型都由其 `type` 和 `subtype` 字段区分（discriminated），便于在消费者代码中进行类型安全的模式匹配。

### SDKMessage 联合类型

来自查询的所有可能消息：

```typescript
type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKUserMessageReplay
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | SDKCompactBoundaryMessage
  | SDKStatusMessage
  | SDKLocalCommandOutputMessage
  | SDKHookStartedMessage
  | SDKHookProgressMessage
  | SDKHookResponseMessage
  | SDKPluginInstallMessage
  | SDKToolProgressMessage
  | SDKAuthStatusMessage
  | SDKTaskNotificationMessage
  | SDKTaskStartedMessage
  | SDKTaskProgressMessage
  | SDKTaskUpdatedMessage
  | SDKSessionStateChangedMessage
  | SDKCommandsChangedMessage
  | SDKNotificationMessage
  | SDKFilesPersistedEvent
  | SDKToolUseSummaryMessage
  | SDKMemoryRecallMessage
  | SDKRateLimitEvent
  | SDKElicitationCompleteMessage
  | SDKPermissionDeniedMessage
  | SDKPromptSuggestionMessage
  | SDKAPIRetryMessage
  | SDKMirrorErrorMessage;
```

### SDKAssistantMessage

来自 Claude 的助手响应：

```typescript
type SDKAssistantMessage = {
  type: "assistant";
  uuid: UUID;
  session_id: string;
  message: BetaMessage; // 来自 Anthropic SDK
  parent_tool_use_id: string | null;
  error?: SDKAssistantMessageError;
};
```

`message` 字段是一个 [`BetaMessage`](https://platform.claude.com/docs/en/api/messages/create)，包含 `id`、`content`、`model`、`stop_reason` 和 `usage`。

**错误类型（`SDKAssistantMessageError`）：** `'authentication_failed'` | `'oauth_org_not_allowed'` | `'billing_error'` | `'rate_limit'` | `'overloaded'` | `'invalid_request'` | `'model_not_found'` | `'server_error'` | `'max_output_tokens'` | `'unknown'`

### SDKUserMessage

用户输入消息：

```typescript
type SDKUserMessage = {
  type: "user";
  uuid?: UUID;
  session_id?: string;
  message: MessageParam; // 来自 Anthropic SDK
  parent_tool_use_id: string | null;
  isSynthetic?: boolean;
  shouldQuery?: boolean;
  tool_use_result?: unknown;
  origin?: SDKMessageOrigin;
};
```

设置 `shouldQuery: false` 可将消息追加到历史而不触发助手轮次。

### SDKUserMessageReplay

带必需 UUID 的用户消息，用于回放（replay）：

```typescript
type SDKUserMessageReplay = {
  type: "user";
  uuid: UUID;
  session_id: string;
  message: MessageParam;
  parent_tool_use_id: string | null;
  isSynthetic?: boolean;
  tool_use_result?: unknown;
  origin?: SDKMessageOrigin;
  isReplay: true;
};
```

### SDKResultMessage

最终结果消息（成功或错误）。

#### 成功结果（subtype: "success"）

```typescript
type SDKResultMessage = {
  type: "result";
  subtype: "success";
  uuid: UUID;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  api_error_status?: number | null;
  num_turns: number;
  result: string;
  stop_reason: string | null;
  ttft_ms?: number;
  total_cost_usd: number;
  usage: NonNullableUsage;
  modelUsage: { [modelName: string]: ModelUsage };
  permission_denials: SDKPermissionDenial[];
  structured_output?: unknown;
  deferred_tool_use?: {
    id: string;
    name: string;
    input: Record<string, unknown>
  };
  terminal_reason?: TerminalReason;
  fast_mode_state?: FastModeState;
  origin?: SDKMessageOrigin;
}
```

#### 错误结果（subtype: 多种 error_*）

```typescript
type SDKResultMessage = {
  type: "result";
  subtype:
    | "error_max_turns"
    | "error_during_execution"
    | "error_max_budget_usd"
    | "error_max_structured_output_retries";
  uuid: UUID;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  stop_reason: string | null;
  total_cost_usd: number;
  usage: NonNullableUsage;
  modelUsage: { [modelName: string]: ModelUsage };
  permission_denials: SDKPermissionDenial[];
  errors: string[];
  terminal_reason?: TerminalReason;
  fast_mode_state?: FastModeState;
  origin?: SDKMessageOrigin;
}
```

关键字段：

- `terminal_reason`：`"completed"` | `"max_turns"` | `"tool_deferred"` | `"aborted_streaming"` | `"aborted_tools"` | `"hook_stopped"` | `"stop_hook_prevented"` | `"blocking_limit"` | `"rapid_refill_breaker"` | `"prompt_too_long"` | `"image_error"` | `"model_error"`
- `fast_mode_state`：`"on"` | `"off"` | `"cooldown"`
- `origin`：转发触发此结果的用户消息的 `SDKMessageOrigin`

### SDKSystemMessage

系统初始化消息：

```typescript
type SDKSystemMessage = {
  type: "system";
  subtype: "init";
  uuid: UUID;
  session_id: string;
  agents?: string[];
  apiKeySource: ApiKeySource;
  betas?: string[];
  claude_code_version: string;
  cwd: string;
  tools: string[];
  mcp_servers: {
    name: string;
    status: string;
  }[];
  model: string;
  permissionMode: PermissionMode;
  slash_commands: string[];
  output_style: string;
  skills: string[];
  plugins: { name: string; path: string }[];
};
```

### SDKPartialAssistantMessage

流式部分消息（仅当 `includePartialMessages: true` 时）：

```typescript
type SDKPartialAssistantMessage = {
  type: "stream_event";
  event: BetaRawMessageStreamEvent; // 来自 Anthropic SDK
  parent_tool_use_id: string | null;
  uuid: UUID;
  session_id: string;
};
```

### SDKCompactBoundaryMessage

对话压缩边界：

```typescript
type SDKCompactBoundaryMessage = {
  type: "system";
  subtype: "compact_boundary";
  uuid: UUID;
  session_id: string;
  compact_metadata: {
    trigger: "manual" | "auto";
    pre_tokens: number;
  };
};
```

### SDKPermissionDeniedMessage

权限拒绝事件（当权限系统在没有交互式提示的情况下自动拒绝时流式发出）：

```typescript
type SDKPermissionDeniedMessage = {
  type: "system";
  subtype: "permission_denied";
  tool_name: string;
  tool_use_id: string;
  agent_id?: string;
  decision_reason_type?: string;
  decision_reason?: string;
  message: string;
  uuid: UUID;
  session_id: string;
};
```

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `tool_name` | `string` | 被拒绝工具的名称 |
| `tool_use_id` | `string` | 此次拒绝所针对的 `tool_use` 块的 ID |
| `agent_id` | `string` | 如果拒绝源自子代理，则为该子代理 ID |
| `decision_reason_type` | `string` | 组件分类器：`"rule"` \| `"mode"` \| `"classifier"` \| `"asyncAgent"` |
| `decision_reason` | `string` | 决策组件给出的人类可读原因 |
| `message` | `string` | 在 `tool_result` 中返回给模型的拒绝消息 |

### SDKPluginInstallMessage

插件安装进度（当设置了 `CLAUDE_CODE_SYNC_PLUGIN_INSTALL` 时）：

```typescript
type SDKPluginInstallMessage = {
  type: "system";
  subtype: "plugin_install";
  status: "started" | "installed" | "failed" | "completed";
  name?: string;
  error?: string;
  uuid: UUID;
  session_id: string;
};
```

### 消息相关辅助类型

#### SDKPermissionDenial

结果中关于被拒绝工具使用的信息：

```typescript
type SDKPermissionDenial = {
  tool_name: string;
  tool_use_id: string;
  tool_input: Record<string, unknown>;
};
```

#### SDKMessageOrigin

用户消息的来源：

```typescript
type SDKMessageOrigin =
  | { kind: "human" }
  | { kind: "channel"; server: string }
  | { kind: "peer"; from: string; name?: string }
  | { kind: "task-notification" }
  | { kind: "coordinator" };
```

| `kind` | 含义 |
|--------|---------|
| `human` | 直接用户输入（缺少 `origin` 也表示这种情况） |
| `channel` | 消息经由 [Channel](https://code.claude.com/docs/zh-CN/channels) 到达。`server` 是来源 MCP 服务器名称 |
| `peer` | 来自另一个 agent 经 `SendMessage` 的消息。`from` 是发送方地址；`name` 是显示名称 |
| `task-notification` | 后台任务完成后注入的合成轮次 |
| `coordinator` | [Agent Teams](https://code.claude.com/docs/zh-CN/agent-teams) 中来自团队协调者的消息 |

> 注：`SDKMessage` 联合中还包含若干消息类型（如 `SDKStatusMessage`、`SDKLocalCommandOutputMessage`、`SDKHookStartedMessage` / `SDKHookProgressMessage` / `SDKHookResponseMessage`、`SDKToolProgressMessage`、`SDKAuthStatusMessage`、`SDKTaskNotificationMessage` / `SDKTaskStartedMessage` / `SDKTaskProgressMessage` / `SDKTaskUpdatedMessage`、`SDKSessionStateChangedMessage`、`SDKCommandsChangedMessage`、`SDKNotificationMessage`、`SDKFilesPersistedEvent`、`SDKToolUseSummaryMessage`、`SDKMemoryRecallMessage`、`SDKRateLimitEvent`、`SDKElicitationCompleteMessage`、`SDKPromptSuggestionMessage`、`SDKAPIRetryMessage`、`SDKMirrorErrorMessage`），官方页未对其逐一展开完整字段定义，详细字段请以官方原页与 SDK 类型声明为准。

---

## 辅助配置与信息类型

### AgentDefinition

以编程方式定义的子代理的配置。

```typescript
type AgentDefinition = {
  description: string;
  tools?: string[];
  disallowedTools?: string[];
  prompt: string;
  model?: string;
  mcpServers?: AgentMcpServerSpec[];
  skills?: string[];
  initialPrompt?: string;
  maxTurns?: number;
  background?: boolean;
  memory?: "user" | "project" | "local";
  effort?: "low" | "medium" | "high" | "xhigh" | "max" | number;
  permissionMode?: PermissionMode;
  criticalSystemReminder_EXPERIMENTAL?: string;
};
```

| 字段 | 必需 | 说明 |
|:---|:---|:---|
| `description` | 是 | 何时使用此代理的自然语言描述 |
| `prompt` | 是 | 代理的系统提示 |
| `tools` | 否 | 允许的工具名称数组。如果省略，继承父级的所有工具。要将 Skills 预加载到代理的上下文中，请使用 `skills` 字段而不是在此处列出 `'Skill'` |
| `disallowedTools` | 否 | 要为此代理明确禁止的工具名称数组 |
| `model` | 否 | 此代理的模型覆盖。接受别名如 `'sonnet'`、`'opus'`、`'haiku'`、`'inherit'`，或完整模型 ID。如果省略或为 `'inherit'`，使用主模型 |
| `mcpServers` | 否 | 此代理的 MCP 服务器规范 |
| `skills` | 否 | 要预加载到代理上下文中的 skill 名称数组 |
| `initialPrompt` | 否 | 当此代理作为主线程代理运行时，自动提交为第一个用户轮次 |
| `maxTurns` | 否 | 停止前的最大代理轮次数（API 往返） |
| `background` | 否 | 调用时将此代理作为非阻塞后台任务运行 |
| `memory` | 否 | 此代理的内存源：`'user'`、`'project'` 或 `'local'` |
| `effort` | 否 | 此代理的推理努力级别。接受命名级别或整数 |
| `permissionMode` | 否 | 此代理内工具执行的权限模式。见 [`PermissionMode`](#permissionmode) |
| `criticalSystemReminder_EXPERIMENTAL` | 否 | 实验性：添加到系统提示的关键提醒 |

### ThinkingConfig

控制 Claude 的思考/推理行为。

```typescript
type ThinkingConfig =
  | { type: "disabled" }
  | { type: "adaptive" }
  | { type: "enabled"; budget_tokens: number }
  | { type: "enabled"; max_tokens: number };
```

| 取值 | 说明 |
|:---|:---|
| `{ type: "disabled" }` | 禁用思考过程。模型直接生成响应，无需内部推理 |
| `{ type: "adaptive" }` | 自适应思考（默认）。模型根据任务复杂性自动决定是否以及如何深入思考 |
| `{ type: "enabled"; budget_tokens: number }` | 启用思考，带令牌预算（以前称为 `max_thinking_tokens`）。模型在此预算内进行推理 |
| `{ type: "enabled"; max_tokens: number }` | 启用思考，带最大令牌限制 |

### SandboxSettings

以编程方式配置 sandbox 行为。

```typescript
type SandboxSettings = {
  enabled?: boolean;
  allowedCommands?: string[];
  blockedCommands?: string[];
  maxCpuPercent?: number;
  maxMemoryMb?: number;
  timeout?: number;
};
```

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `enabled` | `boolean` | 启用或禁用 sandbox 执行 |
| `allowedCommands` | `string[]` | 允许在 sandbox 中执行的命令列表 |
| `blockedCommands` | `string[]` | 在 sandbox 中禁止执行的命令列表 |
| `maxCpuPercent` | `number` | CPU 使用的最大百分比限制 |
| `maxMemoryMb` | `number` | 内存使用的最大 MB 数 |
| `timeout` | `number` | sandbox 操作的超时时间（毫秒） |

### ToolConfig

内置工具行为的配置。

```typescript
type ToolConfig = {
  askUserQuestion?: {
    previewFormat?: "markdown" | "html";
  };
};
```

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `askUserQuestion.previewFormat` | `'markdown' \| 'html'` | 选择启用 `AskUserQuestion` 选项上的 `preview` 字段并设置其内容格式。未设置时，Claude 不发出预览 |

### ModelUsage

单个模型的使用统计。

```typescript
type ModelUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: {
    web_search_requests?: number;
    web_fetch_requests?: number;
  } | null;
  service_tier?: "standard" | "priority" | "batch" | null;
  cache_creation?: {
    ephemeral_1h_input_tokens?: number;
    ephemeral_5m_input_tokens?: number;
  } | null;
};
```

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `input_tokens` | `number` | 输入令牌数 |
| `output_tokens` | `number` | 输出令牌数 |
| `cache_creation_input_tokens` | `number \| null` | 创建缓存的输入令牌数 |
| `cache_read_input_tokens` | `number \| null` | 从缓存读取的输入令牌数 |
| `server_tool_use` | `object \| null` | 服务器端工具使用统计（Web Search、Web Fetch 请求） |
| `service_tier` | `"standard" \| "priority" \| "batch" \| null` | 服务层级 |
| `cache_creation` | `object \| null` | 缓存创建统计 |

### NonNullableUsage / Usage

完整的令牌使用统计。

```typescript
type NonNullableUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};
```

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `input_tokens` | `number` | 输入令牌总数 |
| `output_tokens` | `number` | 输出令牌总数 |
| `cache_creation_input_tokens` | `number` | 创建缓存的输入令牌总数 |
| `cache_read_input_tokens` | `number` | 从缓存读取的输入令牌总数 |

### ApiKeySource

API 密钥来源的枚举。

```typescript
type ApiKeySource =
  | "env_var"           // 环境变量 (ANTHROPIC_API_KEY)
  | "credentials_file"  // 凭证文件 (~/.anthropic/credentials)
  | "oauth"             // OAuth 身份验证
  | "unknown";          // 未知来源
```

### SdkBeta

启用的测试功能标识符。

```typescript
type SdkBeta =
  | "line_tool_use"
  | "structured_output_mode"
  | "tool_choice_override"
  | "custom_system_prompt"
  | string; // 其他测试功能标识符
```

在 `options.betas` 数组中传递以启用特定测试功能。

### SlashCommand

可用的 slash 命令。

```typescript
type SlashCommand = {
  name: string;
  description: string;
  args?: Array<{
    name: string;
    description: string;
    required?: boolean;
    options?: string[];
  }>;
};
```

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `name` | `string` | 命令名称（不含斜杠） |
| `description` | `string` | 命令用途的描述 |
| `args` | `object[]` | 可选的命令参数列表 |
| `args[].name` | `string` | 参数名 |
| `args[].description` | `string` | 参数用途的描述 |
| `args[].required` | `boolean` | 参数是否必需 |
| `args[].options` | `string[]` | 参数的可用值（如果是枚举） |

### ModelInfo

可用模型的信息。

```typescript
type ModelInfo = {
  name: string;
  displayName: string;
  description?: string;
  aliases?: string[];
  contextWindow?: number;
  maxOutputTokens?: number;
  available: boolean;
  reason?: string;
};
```

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `name` | `string` | 模型的完整 ID（如 `"claude-3-5-sonnet-20241022"`） |
| `displayName` | `string` | 用户友好的模型名称（如 `"Claude 3.5 Sonnet"`） |
| `description` | `string` | 模型的描述 |
| `aliases` | `string[]` | 模型的别名（如 `["sonnet"]`） |
| `contextWindow` | `number` | 上下文窗口大小（令牌） |
| `maxOutputTokens` | `number` | 最大输出令牌数 |
| `available` | `boolean` | 模型对当前账户是否可用 |
| `reason` | `string` | 如果不可用，说明原因 |

### AgentInfo

可用的子代理信息。

```typescript
type AgentInfo = {
  name: string;
  description: string;
  source: "builtin" | "project" | "user" | "team";
  model?: string;
  tools?: string[];
  memory?: "user" | "project" | "local";
};
```

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `name` | `string` | 代理名称 |
| `description` | `string` | 代理用途的描述 |
| `source` | `string` | 代理的定义来源（内置、项目、用户或团队） |
| `model` | `string` | 代理的默认模型（如果覆盖了主模型） |
| `tools` | `string[]` | 代理可用的工具 |
| `memory` | `string` | 代理使用的内存层级 |

### McpServerStatus

已连接 MCP 服务器的状态。

```typescript
type McpServerStatus = {
  name: string;
  status: "connected" | "disconnected" | "error" | "connecting";
  resources?: number;
  tools?: number;
  prompts?: number;
  error?: string;
  lastConnected?: number;
};
```

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `name` | `string` | 服务器名称 |
| `status` | `string` | 连接状态 |
| `resources` | `number` | 可用的资源数 |
| `tools` | `number` | 可用的工具数 |
| `prompts` | `number` | 可用的提示数 |
| `error` | `string` | 如果状态为 `"error"`，错误信息 |
| `lastConnected` | `number` | 上次成功连接的时间戳（毫秒） |

### AccountInfo

当前账户的信息。

```typescript
type AccountInfo = {
  email?: string;
  name?: string;
  plan?: "free" | "pro" | "team";
  isOAuth?: boolean;
  organizationName?: string;
  monthlyQuota?: number;
  usageThisMonth?: number;
};
```

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `email` | `string` | 账户电子邮件地址 |
| `name` | `string` | 账户所有者名称 |
| `plan` | `string` | 订阅计划级别 |
| `isOAuth` | `boolean` | 账户是否使用 OAuth 身份验证 |
| `organizationName` | `string` | 相关组织名称（如果适用） |
| `monthlyQuota` | `number` | 每月 API 配额（令牌或调用） |
| `usageThisMonth` | `number` | 本月已使用的额度 |

---

## 内置工具（参考）

Claude Code 中主要可用的工具：

- **`Agent`** —— 为复杂任务启动子代理
- **`Bash`** —— 执行 bash 命令
- **`Read`** —— 读取文件（文本、图像、PDF、notebook）
- **`Write`** —— 写入文件
- **`Edit`** —— 文件中精确的字符串替换
- **`Glob`** / **`Grep`** —— 模式匹配
- **`WebSearch`** / **`WebFetch`** —— Web 工具
- **`TaskCreate`** / **`TaskGet`** / **`TaskUpdate`** / **`TaskList`** —— 任务管理
- **`Workflow`** —— 运行协调子代理的动态工作流
- **`AskUserQuestion`** —— 向用户获取澄清
- **`Monitor`** —— 运行带事件流的后台脚本

---

## 完整使用示例

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Analyze this codebase",
  options: {
    cwd: "/path/to/project",
    tools: ["Read", "Glob", "Grep"],
    permissionMode: "plan", // 只读
    maxTurns: 5,
  }
})) {
  if (message.type === "assistant") {
    console.log(message.message.content);
  } else if (message.type === "result") {
    console.log(`Done: ${message.subtype}`);
  }
}
```

更多完整细节见[文档索引](https://code.claude.com/docs/llms.txt)。
