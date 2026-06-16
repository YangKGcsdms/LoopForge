# Claude Agent SDK 官方文档（沉淀版）

沉淀自 [code.claude.com/docs](https://code.claude.com/docs/zh-CN/agent-sdk/overview) 的 Agent SDK 文档分区，抓取于 2026-06-16，TS 项目视角整理。和 `../Cursor_SDK_TypeScript_官方文档.md` 一样作为**参考基准**：散文译为中文，所有 `type`/字段名/enum 取值/函数签名/代码块原样保留，Python 代码已省略。官方分区共 31 页，这里沉淀了其中 28 页（取舍见末尾）。

## 分册

| 文件 | 内容 | 覆盖的官方页 |
|---|---|---|
| [01-入门与代理循环](01-入门与代理循环.md) | Agent SDK 是什么、安装认证、quickstart、**代理循环如何运转**、与 CLI/Client SDK/Managed Agents 的取舍 | overview / quickstart / agent-loop / claude-code-features |
| [02-TypeScript-API参考](02-TypeScript-API参考.md) | `query()`、`Options` 全字段、`PermissionMode`、`tool()`/`createSdkMcpServer()`、Hook 类型、**全部消息类型**（含 result 成功/错误两态字段） | typescript |
| [03-权限与安全](03-权限与安全.md) | permissionMode 各模式行为、`canUseTool`、`PermissionResult`/`PermissionUpdate`、`AskUserQuestion`、安全部署清单 | permissions / user-input / secure-deployment |
| [04-会话与状态](04-会话与状态.md) | 拿 `session_id`、`resume` vs `forkSession`、会话 JSONL 存储位置、外部存储 `SessionStore` 接口、文件检查点 `rewindFiles()` | sessions / session-storage / file-checkpointing |
| [05-编排能力](05-编排能力.md) | `AgentDefinition` 子代理、全部 Hook 事件、MCP 三类传输、`tool()` 自定义工具、工具搜索 | subagents / hooks / mcp / custom-tools / tool-search |
| [06-输出与流式](06-输出与流式.md) | `includePartialMessages`、流式输入 vs 单次、**结构化输出**（`structured_output`）、待办跟踪 | streaming-output / streaming-vs-single-mode / structured-outputs / todo-tracking |
| [07-提示与扩展](07-提示与扩展.md) | `systemPrompt` 三种形态、Skills、Plugins、Slash 命令 | modifying-system-prompts / skills / plugins / slash-commands |
| [08-运维](08-运维-成本观测托管迁移.md) | `total_cost_usd`/`usage`/`modelUsage` 成本跟踪、OpenTelemetry、托管、迁移（`ClaudeCodeOptions→ClaudeAgentOptions`） | cost-tracking / observability / hosting / migration-guide |

## 与 LoopForge 的对应

沉淀这套文档不只是存档，几页直接对得上本项目的设计，标出来便于回头印证：

- **agent-loop（01）** ↔ 我们说的"内层 agent loop"——SDK 提供它，LoopForge 在它之上做编排。这是两层 loop 之分的官方依据。
- **structured-outputs（06）** ↔ 我们的 `Contract<T>`。官方有原生 `structured_output` + `error_max_structured_output_retries`，可对照我们手写的"注入 schema→解析→校验→repair"，评估是否改用原生。
- **cost-tracking（08）** ↔ 审计/沉淀层。result 消息带 `total_cost_usd`/`modelUsage`，正是 `NodeRunRecord` 该落的成本字段（Cursor 没有，这是 Claude 引擎的优势）。
- **session-storage / file-checkpointing（04）** ↔ 状态纪律。外部 `SessionStore` 与 `rewindFiles()` 对应"写状态、可回滚"，是把沉淀做实时的现成原语。
- **hooks（05）** ↔ 节点输入输出钩子。官方 Hook（PreToolUse/PostToolUse/…）与我们的 `NodeHook` 是同一思路，可借鉴事件粒度。
- **permissions / secure-deployment（03）** ↔ 工作目录治理与"hard-never"约束的落点。

## 未沉淀（及原因）

- **Python API 参考**（`agent-sdk/python`）：本项目是 TypeScript，全文沉淀属噪声。需要时见官方页 <https://code.claude.com/docs/zh-CN/agent-sdk/python>。
- **TypeScript SDK V2 session API**（`typescript-v2-preview`）：官方已标记 removed，不沉淀。
- **advisor**（`/advisor`）：不在 agent-sdk 分区下，与本项目关系弱，略过。
