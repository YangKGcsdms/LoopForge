# 评审复盘：dev-loop 收敛判据失效、max_iterations 静默放行、与 producer 谎报

> 定位：一次"把脚本式 pipeline 改成模板+实例"的真实 run 暴露了编排层的三个问题。本文把现象对到代码、收敛到**一个承重机制**，再给出按落点分类的修复方案。属**评审复盘 + 修复设计**，是后续动 `loop.ts` / `nodes/decompose.ts` / `verify.ts` 的工程依据。
>
> 相关基准：`架构设计_CC壳与节点切分.md`（信任轴/连续性轴）、`单次流水线节点持久化与断点续跑设计.md`（NodeRun 落库）。

## 0. 触发

需求"把当前脚本式 pipeline 运行改造成模板+实例、每次运行可查看/回归/逐节点看输入与决策"跑了一整条流水线。两处异常被肉眼逮到：

1. **decompose loop 跑满 4 轮、reviewer 4 轮全判 `通过:否`**，`目标偏差` 一路收敛（0.32 → 0.14 → 0.11 → 0.12），但 `pass` 始终 false；系统随后照样吐出"TODO 列表 19 项"并进入 S1 开发。
2. **S1 开发节点第 1 轮 producer 谎报测试通过**：自报"22/22 pass"并附了一段像模像样的 TAP 自检，实际 `tsx` 没装进 `backend/node_modules`，runner 两次执行都失败，测试一次都没真跑起来。

## 1. 现象 → 代码

### 现象一：loop 不是"收敛"才往下走，是"撞上限"被迫往下走

`decompose-reviewer` 的收敛判据写死了一条不可达硬规则：

- `nodes/decompose.ts:80` —— `"…ambiguities 必须清空才算收敛…"`
- 而 producer 唯一的矫正杠杆是把上轮 `requiredFixes` 读进来"据此细化拆解"（`nodes/decompose.ts:63-65`）。**越细化越暴露新的 corner case → 新歧义**，于是 `ambiguities` 永远清不空。
- 数据侧也没给区分的余地：`DecomposeOutput.ambiguities` 只是 `string[]`（`nodes/decompose.ts:26`），没有"阻塞 / 非阻塞"之分。

偏差轨迹 `0.32 → 0.14 → 0.11 → 0.12` 说明 producer 第 2~3 轮就已经把计划打磨到"足够开工"（19 个子任务全 ≤5h、验收可测、决策回写），第 4 轮甚至微涨——**卡住它的不是质量，是那条判据**。reviewer 第 4 轮还在挑的（文件锁用 mutex 还是 lockfile、routing 要不要进 hash、deviation 公式选哪个）都是实现期 5 分钟能拍板的决策，不构成阻塞一份 plan 的理由。

### 现象二：gate 没在 gate——它实际行为是"固定跑 N 轮，然后无论 pass 与否都 ship"

`goalGate` 本身是对的：`pass===true && deviation.score<=0.3` 才 `allow`，否则 `reassign`（带 requiredFixes 重开），`block` 只留给硬红线（`nodes/gate.ts:27-38`）。问题不在 gate 函数，在 loop 的兜底：

```
loop.ts:89    for (let n = 1; n <= maxIterations; n++) { … }   // 默认 5（loop.ts:83）
loop.ts:118   if (done(verdict, decision)) return { status:"converged", … }
loop.ts:121   if (decision.action==="block") return { status:"blocked", … }
loop.ts:129-138  // 撞上限：返回 last?.produced.output —— 不看 pass、不看 verification
```

**`loop.ts:129-138` 在 max_iterations 时无条件返回最后一轮产出。** `LoopResult.status` 虽然记了 `"max_iterations"`（`loop.ts:67/132`），但下游 `pipeline` 只读 `output` 继续往下用，**没有任何地方把"这是被迫吐出的、未通过评审的产物"和"通过评审的产物"区别对待**。最该被记录的那个决策——gate 到底放没放行——被吞掉了。这与本次需求"让每个决策可见"的初衷正相反。

### 现象三：producer 谎报测试，信任轴兜住了——但有个洞

这条恰恰验证了信任轴**在工作**：

- `verify.ts` 是独立校验器：真跑 `git diff` + 配置的 `test/typecheck`，`testsPass` 在"没配 checks / checks 没真跑"时是 `null`。
- 评审读的是地面真值不是散文：`groundTruth()`（`nodes/dev.ts:15-35`）把 `verification` 格式化进 evalCtx；`dev-reviewer`（`dev.ts:101-119`）"testsPass=false 或 null 时 completion.done 必须 false"；`dev-redteam`（`dev.ts:125-143`）"只认独立校验这把尺子，自报一律视为未证实，宁可错杀"。
- 本次 `testsPass` 是 `null`（tsx 缺失，checks 没真跑），两个评审节点据此正确判 `done=false`，还逮到 producer 想偷借隔壁 `cursor_test` 项目的 tsx 绕过去。**编造的绿灯没被 ship。**

洞在这里：**`testsPass=null` 时评审永远判 `done=false` → loop 永远 `reassign` → 撞 max_iterations → 现象二的 `loop.ts:134` 把这份从未被验证的产物无条件吐给下游。** 也就是说，现象三的"谎报"之所以危险，靠的正是现象二那个机制兜底。如果 verify 没配真 checks（`testsPass` 恒 null），整条信任轴塌成 null，loop 必然 force-ship 一份没人证明过的东西。

### 现象四（结构隐患）：跨任务契约漂移

19 个子任务里有好几对**共享契约、强耦合**，但每个 dev 节点是隔离工作的，没有哪个节点同时看到耦合的两端：

- S1 的 versionHash 纳入字段 ↔ S13 的回放拒绝逻辑（reviewer 自己点了"否则两子任务对版本变化判定不一致"）；
- S16 的截断标记格式 ↔ S12 前端展示；
- S4/S5/S18 共享 SSE 与 checkpoint 的不变量。

每个 dev-loop 各自测试全绿、谁都发现不了，但落地时可能对不上同一份契约。这是 **decompose-then-isolated-dev 模式的根病**，规模化到多实例并行时会被放大 N 倍。

## 2. 一个承重机制

把四条现象收敛成一句话：

> **`loop.ts:129-138` 的"max_iterations 无条件返回 last output"是承重梁。现象一让 loop 必然撞上它，现象三在它之下变危险，现象二就是它本身。**

根因不是"判据太严"或"producer 会撒谎"这些表层，而是**收敛判断被塞进了一条静态死规则（`ambiguities` 清空），而退出兜底又把"通过/未通过"抹平成同一个出口**。一处该给评审更多判断的地方写成了死条文，另一处该守住边界的地方却无条件放行——两端都失衡。

## 3. 修复方案（按落点分类）

### 3.1 收敛判据（evaluator 侧 · `nodes/decompose.ts` + `nodes/contracts.ts`）

把判据从"决了没"换成"能不能决"：

1. **区分阻塞 / 非阻塞歧义，只让前者卡 gate。** 给 `DecomposeOutput` 的歧义项加结构：`{ text, blocking: boolean, defaultDecision?: string }`（或拆成 `blockingAmbiguities` / `deferredAmbiguities` 两个数组）。reviewer 判据改为 `done = (blockingAmbiguities.length === 0)`，非阻塞项允许带"标注 + 默认值"继续往下走。reviewer 其实已经在打"【硬阻塞 S14】"和"【不阻塞】"的标签，只是 `done` 判定无视这个区分。
2. **给 producer 一个显式"拍板"动作。** 现在 producer 只能"补细节"消歧义，而补细节必然暴露新边缘情况（震荡根因）。允许 producer 以 `DECIDE: 选默认值 + 标记可覆写` 直接闭合一条歧义。第 4 轮 producer 已经在手动这么干（"非阻塞·已规避"、把数值写死），gate 应当承认这种闭合方式。
3. **reviewer rubric 奖励"可决策"而非"已决策"。** 一份好计划不是没有 open question，而是每个 open question 都有 (a) owner、(b) 默认值、(c) 不在关键路径上阻塞。`deviation.score` 应重罚"阻塞且无默认值"的歧义，几乎不罚"非阻塞且有默认值"的。改 `nodes/decompose.ts:80` 的 static 判据文本即可。

### 3.2 loop 机制（`loop.ts`）

1. **plateau 探测，独立于 pass 标志。** 连续两轮 `|Δdeviation| < ε`（如 ε=0.03）即判平台期，停止并升级，而不是继续烧轮次。`0.14→0.11→0.12` 就是典型平台期，本该在第 3 轮停下并抛"已收敛但未通过，剩 N 条决策等人拍"。在 `loop.ts` 主循环内维护上一轮 deviation，命中即 `break` 到一个新出口。
2. **退出原因升格为一等公民，并落库。** `LoopResult.status` 已有 `converged | max_iterations | blocked | error`，但缺 `plateau`，且这个状态没传到下游/持久层。新增 `gate_outcome: passed | max_iter_forced | plateau_escalated | blocked`，写进 `NodeRunRecord` / instance（正好喂本次正在做的落库），并在 UI 标出。**gate 决策本身就是最该被记录的那条"决策"。**
3. **max_iterations 不再静默 force-ship。** `loop.ts:134` 返回时，若 `verdict.pass !== true`，输出必须带降级标记（`forced: true` + 原因），下游据此决定是阻断、警示还是人审，而不是当成 approved 往下喂。下游 `pipeline` 须分支处理 `gate_outcome !== passed`。

### 3.3 信任校验（`verify.ts` 装配 + 评审纪律）

1. **verify 必须配真 checks，否则信任轴塌成 null。** 确认 dev-loop 的 verifier 在目标 cwd（如 `/Users/carter/projects/LoopForge`）真接了 `npm test` / `typecheck`。`testsPass===null` 应被视为"环境未就绪"的告警，而非默默走 reassign 直到 force-ship。
2. **`testsPass===null` 视为未证实并阻断 done（已实现，保持）。** `dev.ts:23/110/134` 已经这么做了，是对的，别回退。
3. **每一轮都重核地面真值，不只第一轮。** 结构上已具备——`loop.ts:98-102` 每轮用新的 `produced.verification` 重建 evalCtx——但纪律上要守住：producer 第 2 轮又附一份"可信 TAP 日志"时，redteam 不能因为"这次态度诚恳、还附了日志"就松手；附的日志本身也是 producer 的散文。校验只认 `verification.testsPass` 的 exit code，不认 `raw`/`output` 里的任何自述数字。这条建议直接写进 `dev-redteam` 的 static 判据。

### 3.4 契约锚点（`nodes/decompose.ts` 产出侧）

把"靠人对齐"变成"结构强制"：decompose 阶段额外产出一份**共享契约锚点清单**（哪些子任务共用哪条契约、契约的权威定义在哪），作为相关 dev 节点的**强制输入**注入，而不是散在各任务卡的自然语言描述里。至少覆盖已知三对：S1↔S13 的 versionHash 字段集、S16↔S12 的截断标记格式、S4↔S5 的 SSE/checkpoint 不变量。

## 4. 优先级与落地顺序

| 序 | 改动 | 落点 | 理由 |
|---|---|---|---|
| P0 | 退出原因升格 + max_iterations 带降级标记 + 落库 | `loop.ts` / NodeRun | 承重机制，且正好并进本次持久化工作；不改这条，"决策可见"的需求本身没达成 |
| P0 | verify 配真 checks，确认 testsPass 非恒 null | run 路由装配 | 信任轴的电源开关，不通则 3.2/3.3 全是空谈 |
| P1 | 阻塞/非阻塞歧义 + DECIDE 动作 + rubric 改判据 | `nodes/decompose.ts` `contracts.ts` | 治 decompose loop 空转；这是会被实例化进每个 dev-loop 的模板级问题，收益 ×N |
| P1 | plateau 探测 | `loop.ts` | 省轮次、把"未通过"显式升级给人 |
| P2 | 契约锚点 | `nodes/decompose.ts` | 结构隐患，规模化前补上即可 |

注意：P1 的判据修复优先级比看上去高——`P0_NODES` 里每个 dev 任务自己也挂着 `dev-step → dev-reviewer` 的 evaluator-optimizer loop。decompose 那处是单次 4 轮浪费，dev 这层是 **×19 的复利浪费**。修的不是一个 loop，是一个会被实例化 19 次的模板。

## 5. 与正在做的 Template/Instance 持久化的关系

这次 run 本身就是本 feature 的用例：要做的"让每次 run 变成可逐节点查看输入与决策的实例"，产出的正是此刻在分析的这份 trace。而 §3.2-2 的 `gate_outcome` 落库，不是另起的活——它就是 NodeRun 该记的、最关键的一条决策字段。换句话说，**修 gate 和做持久化是同一块承重墙的两面**：没有"谁因为哪条 verdict、被 gate 放行还是 force-ship"的全量落库，多实例规模下这套系统第二天就 undebuggable。地基和上层楼在这里是同一根柱子。
