# LoopForge 架构设计：CC 工作流的壳 + think/act 节点切分

> 本文是当前工程基准（取代早期"驾驭多 SDK 的自驱编排层 / meta-harness / 自主升级"的叙述）。
> 早期设计文档（`AI开发流水线设计_CursorSDK版.md`、`通用节点与Loop编排层设计.md`）为思路参考，非基准。

## 0. 一句话命题

**LoopForge 是套在 Claude Code（CC）这个"打不过的黑盒"外面的一层壳。** CC 的 harness 与通用能力上限自建无法超越，所以**不碰它的内部**；壳只在外面补 CC 给不了的两样东西——**连续性**和**信任**——把短命、需盯、困在单 session 的 vibe 工作，转成有界、可持久、可续跑、可审计、可移交的单元，即"**放心托管**"。

`放心托管 = 放心(Trust) + 托管(Continuity)`，命题即产品名。

## 1. 三轴模型（架构的灵魂）

CC 是一个**无状态的天才**：单 session 内能力上限极高，但有三个先天残疾——会失忆（context 一死就断）、没法移交（困在一条会话里）、不能托管（不盯着就可能跑飞）。壳供的正是这三块的解药，且**一点"智能"都不加**。

| 轴 | 谁提供 | 是什么 | 对应痛点 |
|---|---|---|---|
| **能力 Capability** | **CC（别碰）** | 节点内部完全交给 `query()`，放开手 vibe | —— |
| **连续性 Continuity** | **壳** | 持久 → 蒸馏 → 再水合，跨时间/机器/人 | 续不上、移交不了 |
| **信任 Trust** | **壳** | 边界 + 验证 + 审计，让你敢放手 | 不敢放手、不可信 |

三者**零重叠**。

### 设计准则（可证伪的砍刀）

> **任何特性先问一句：它加的是「能力」，还是「连续性 / 信任」？**
> **加能力 = 在和 CC 竞争 = 必输 = 砍或无限期推迟。加连续性 / 信任 = 核心。**

由此推论（贯穿全设计）：
- 简单 loop > 复杂 loop（复杂 = 加智能 = 和黑盒竞争）。
- **只固定接缝，不固定内部**（约束内部 = 往黑盒塞能力限制 = 掐 CC 上限）。
- "自主升级"是纯"加能力"轴的东西，**砍 / 无限期后置**（还自带 Goodhart 反噬）。
- 接地气的 evaluator 不是优化项，是**信任轴的最小单元**，MVP 阻断项（见 §4）。

## 2. 节点切分：think vs act

### 2.1 根因：旧结构把"act"压成了"think"

旧编排层只有一个执行原语：`runNode → Sender(req) → string → parseJSON`。`devStep` / `testWriter` 虽声明 `mode:"agent"` + `tools`，但全程没生效——`req.tools` 在 sender 边界被丢、工具名是 Cursor 词汇、provider 只取 `.result` 字符串。结果 `filesTouched` / `testsRun` 全是 agent **自报**，评审也只读自报 JSON：**agent 报、agent 判，没有地面真值**。

### 2.2 两类节点 + 两个原语

| 节点 | 类别 | 原语 | 说明 |
|---|---|---|---|
| difficultyAssessor / plan / decompose / 各 reviewer | **think** | `think()` | 纯 prompt→结构化 JSON，只读（不可改文件） |
| devStep / testWriter | **act** | `act()` | 真工具(Read/Edit/Write/Bash) + 审批 + 证据捕获 |
| goalGate / checkHardNever | （确定性代码，非节点） | —— | 阈值与硬红线钉死，不套 agent |

- **`think()`**：Claude `query`，**只读**（permissionMode `plan`，禁 Edit/Write/Bash），无审批。输出靠契约 + repair 校验（provider 中立；原生 `outputFormat` 见 §6 后续可选）。便宜模型铺量。
- **`act()`**：Claude `query`，开真工具；`canUseTool` → 审批（飞书卡片）；**观测 `tool_use`/`tool_result` 消息流聚合 `evidence`**（真改了哪些文件、Bash 命令 + 真输出）。返回 `{ 自报, evidence }`。

### 2.3 审批归位

审批只在 **act 节点**有意义，且只在 **Claude** 成立（CC 的 `canUseTool` 是可编程审批回调；Cursor headless 无此能力，故冻结）。旧实现把 `approve` 挂在 run 级、对所有节点无差别；切分后**只挂到 act 路径**，think 节点永不弹审批。

链路（已验证可端到端打通）：`act-runner` 绑定 `approve` → `provider.act` → `canUseTool(tool,input,{signal})` → 飞书互动卡片（长连接 `card.action.trigger` 回调，无需公网 webhook）→ 人点 → resolve → SDK 放行/拒绝；超时/取消/发卡失败都兜底为拒绝。

## 3. 数据流（主流程）

```
难度评估(think) → 出方案(think) → 拆解 loop(think×2) → 逐 TODO dev-loop
                                                          │
                          ┌───────────────────────────────┘
                          ▼
   devStep(act：真改代码+跑测试，采 evidence)
                          │
            verify(cwd)：独立跑 git diff + test/typecheck  ← 地面真值（不经 agent）
                          │
   devReviewer(think) + devRedTeam(think)：判 verification/evidence，不判自报
                          │
                 goalGate(确定性)：达标→收敛 / 否则带 requiredFixes 重开 / 硬红线→block
```

## 4. 信任轴的最小单元：接地气 evaluator（不可后置）

一个读 producer 自报 `testsRun` 的评审，在"信任"轴上得分是 **0 不是 0.5**——它没碰壳的任何一根支柱，只是把 CC 输出原样转述。所以它是 **MVP 阻断项**，不是"以后加强"。

**做法**：在评审判定前，编排层在 `workspace.cwd` 独立跑：
- `git diff --name-only` / `--stat` → 真实改动文件清单（不信 agent 的 `filesTouched`）。
- 配置的校验命令（typecheck / test / lint）→ 真 exit code。

把结果作为**地面真值**喂给 evaluator；规则：
- `testsPass === false` 或 `=== null`（没配校验 → 无独立证明）时，`completion.done` **不得**为 true。
- 自报与独立校验冲突 → 以独立校验为准，并在 `deviation` 里点出谎报。

## 5. 路由（按 purpose，Claude 池）

两套路由表只保留 `CLAUDE_ROUTING`（Cursor 表休眠）。act 节点（execute/test）**不能用 haiku 跑自主多轮开发**，至少 sonnet；think 节点用便宜档。

| purpose | 节点 | 模型档 |
|---|---|---|
| plan / control | 难度/方案/拆解 | opus |
| review | 各 evaluator | sonnet（评审质量定流水线可靠性，不省这钱） |
| execute / test | devStep / testWriter（**act**） | sonnet（自主开发，别用 haiku） |
| validate | 难度评估自身 | haiku |

## 6. 蒸馏两层（连续性 + 信任的深水区，**本轮后置**）

蒸馏不是一件事，是两层正交的东西，**保真要求相反**，绝不能用一个 `distill()` 干两件事：

| | 对话总结蒸馏（认知 / 前向） | 任务评估蒸馏（回归 / 回溯） |
|---|---|---|
| 服务的轴 | 连续性 | 信任 / eval |
| 目的 | 辅助其他节点认知 | 对某次任务回归、评估 |
| 方向 / 尺度 | 前向、在线、随状态滚动 | 回溯、离线、跑完后定格 |
| 消费者 | 系统自己（下游节点） | 人（要亲手建的元循环） |
| **保真** | **必须有损**（全保真=请回 context rot） | **必须保真**（有损=量尺被污染） |
| 数据语义 | 可变"当前认知"（覆盖更新） | 只追加不可变案例（累积成 eval 集） |
| 代码现状 | 已有胚胎：`formatPlan`/`planSummary`/`outputSummary`/`ctx.facts` | 纯空地：`NodeRunRecord` 存原料但未投影 |

两者共享同一份 `NodeRunRecord` 原料但投影不同。**本轮 MVP 把 evidence + 持久化做实，正好是两层蒸馏将来共享的底料。** 评估蒸馏是"人锚定 held-out eval 集"（Goodhart 防火墙）的来源——自主升级只能在这把不被它优化的尺子上证明自己变好。

### 同属后续可选项
- **think 节点改用 CC 原生 `outputFormat`（json_schema）** 顶替手搓 `extractJson`+repair。当前保留契约+repair（provider 中立、已测）；待全面押注 CC 后切换。

## 7. 边界纪律（守住的红线）

1. **别把约束伸进节点内部**：壳只固定目标 / 输入契约 / gate / 审批 / 移交状态；节点内 `query()` 完全是 CC。
2. **Cursor 冻结**：代码休眠保留（`cursorProvider` / `MODEL_POOL` / `CURSOR_ROUTING`），不删不引用。
3. **hermetic / 计费分离**：`*.test.ts` 永不触发计费（用 mock sender / 合成消息 / 临时 git 仓）；真调 SDK 走 `*.itest.ts`（`test:live`）。
4. **act 的工具自报不可信**：`evidence` 里 agent 的 Bash 自报是参考，`verify()` 的独立 exit code 才是地面真值。
