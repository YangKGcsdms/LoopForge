# LoopForge 前端信息架构图（S0 基线）

## 页面导航树

```
LoopForge App
│
├─ Header (固定导航栏)
│  ├─ Logo + 应用名 (slate-900 圆形背景)
│  ├─ 副标题 "Cursor / Claude · 节点/Loop 自驱编排"
│  └─ Tab Navigation (bg-slate-100)
│     ├─ 工作流 (tab === "workflow" 时 bg-white)
│     └─ SK 配置 (tab === "sk" 时 bg-white)
│
├─ Main Container (mx-auto max-w-3xl)
│  │
│  ├─ 🔄 [Tab: 工作流] ─────────────────── Workflow.vue
│  │  │
│  │  ├─ Section ① 路由池
│  │  │  ├─ Title: 路由池 · {{ provider }}
│  │  │  ├─ Subtitle: 显示当前引擎状态
│  │  │  │
│  │  │  ├─ Provider Selector (select)
│  │  │  │  ├─ Option: Cursor SDK
│  │  │  │  └─ Option: Claude Agent SDK
│  │  │  │
│  │  │  ├─ Model Source Badge
│  │  │  │  └─ "实时可用性" / "可用性未知"
│  │  │  │
│  │  │  ├─ Pool Routing Info (若有)
│  │  │  │  ├─ 出方案
│  │  │  │  ├─ 执行
│  │  │  │  ├─ 评审
│  │  │  │  └─ 测试
│  │  │  │
│  │  │  └─ Model Cards (循环展示)
│  │  │     ├─ Model Name
│  │  │     ├─ Tier Badge (bg-slate-100 / bg-sky-100 / etc)
│  │  │     └─ Disabled Badge (若不可用)
│  │  │
│  │  ├─ Section ② 自驱开发流水线（运行表单）
│  │  │  ├─ Title: 自驱开发流水线
│  │  │  ├─ Subtitle: 难度评估 → 出方案 → 拆解成 N 个 TODO → 每个自循环...
│  │  │  │
│  │  │  ├─ Form Field: 需求
│  │  │  │  └─ textarea (rows=2)
│  │  │  │
│  │  │  ├─ Form Field: 最终目标
│  │  │  │  └─ input
│  │  │  │
│  │  │  ├─ Form Field: 工作目录 cwd（可选）
│  │  │  │  └─ input (placeholder)
│  │  │  │
│  │  │  ├─ Control: dryRun 开关
│  │  │  │  └─ checkbox + label
│  │  │  │
│  │  │  ├─ Button: [评估并自驱运行]
│  │  │  │  └─ disabled while running
│  │  │  │
│  │  │  └─ Error Alert (若有错)
│  │  │     └─ border-rose-200 bg-rose-50 text-rose-700
│  │  │
│  │  └─ Section ③ 实时自驱运行（仅在 running 或有 live 时显示）
│  │     ├─ Title: 实时自驱运行
│  │     │
│  │     ├─ Difficulty Badge (若有)
│  │     │  ├─ Value (easy/medium/hard → 绿/黄/红)
│  │     │  └─ Reason
│  │     │
│  │     ├─ Routing Info (若有)
│  │     │  ├─ 出方案
│  │     │  ├─ 执行
│  │     │  ├─ 评审
│  │     │  └─ 测试
│  │     │
│  │     ├─ Live Items Container (space-y-2)
│  │     │  │
│  │     │  ├─ [Item Type: phase]
│  │     │  │  └─ Divider + phase name
│  │     │  │
│  │     │  ├─ [Item Type: todos]
│  │     │  │  ├─ Header: TODO 列表（N 项）
│  │     │  │  └─ List Items
│  │     │  │     └─ [id] Title [time] {acceptance}
│  │     │  │
│  │     │  └─ [Item Type: node]
│  │     │     ├─ Meta Row: [id] [kind badge] [status] [iteration]
│  │     │     └─ Content: <pre> typed text + pulse cursor
│  │     │
│  │     └─ Final Done Badge (若 finalDone)
│  │        └─ 完成 · 拆出 N 个 TODO · 自循环开发完成 M 个
│  │
│  │
│  └─ 🔑 [Tab: SK 配置] ────────────────── SkConfig.vue
│     │
│     ├─ Section ① Provider Selection
│     │  ├─ Title: SK 配置
│     │  ├─ Subtitle: 配置访问密钥以驱动 SDK 集成层
│     │  │
│     │  ├─ Label: Provider
│     │  ├─ Select (onChange → loadStatus)
│     │  │  ├─ Supported Providers
│     │  │  │  ├─ Cursor SDK
│     │  │  │  └─ Claude Agent SDK
│     │  │  └─ Unsupported Providers (disabled)
│     │  │
│     │  └─ Hint (amber-600)
│     │     └─ 动态文本（isClaude 决定）
│     │
│     ├─ Section ② Current Status Display
│     │  ├─ Status: configured (emerald-600) / not configured (slate-400)
│     │  ├─ Masked Key
│     │  ├─ Source Badge (若来自环境变量)
│     │  └─ Updated Timestamp
│     │
│     ├─ Section ③ Secret Key Input
│     │  ├─ Label: Secret Key
│     │  ├─ Input (type: password/text toggle)
│     │  │  └─ Placeholder (动态)
│     │  ├─ Toggle Button: 显示/隐藏
│     │  └─ Hint: SK 仅本地后端处理
│     │
│     ├─ Section ④ Action Buttons
│     │  ├─ [保存]        (bg-slate-900, disabled while busy)
│     │  ├─ [验证连接]    (border-slate-300)
│     │  └─ [清除]        (border-rose-200 text-rose-600)
│     │
│     └─ Section ⑤ Message Feedback
│        └─ Conditional Alert
│           ├─ bg-emerald-50 (ok)
│           ├─ bg-rose-50 (error)
│           └─ bg-sky-50 (info)
│

```

## 内容流与深度分析

### Workflow.vue 用户旅程

```
┌─────────────────────────────────────────┐
│ 1. 进入工作流页                          │
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 2. 察看路由池信息                        │
│    (Provider 选择 → 加载模型列表)        │
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 3. 填写表单 (需求 / 目标 / cwd / dryRun)│
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 4. 点击 [评估并自驱运行]                │
│    → startRun() 触发 EventSource       │
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 5. 实时观察日志流                        │
│    - difficulty 出现 (红/黄/绿)        │
│    - routing 方案显示                  │
│    - live items 逐个追加:              │
│      · phase 头                        │
│      · todos 列表                      │
│      · node 卡片 (打字机效果)          │
│    - finalDone 显示完成状态            │
└─────────────────────────────────────────┘
```

### SkConfig.vue 用户旅程

```
┌─────────────────────────────────────────┐
│ 1. 进入 SK 配置页                        │
│    → 加载 providers 列表                │
│    → 加载当前 provider 的 status       │
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 2. 选择 Provider (Cursor / Claude)      │
│    → 动态加载该 provider 的 status     │
│    → 动态更新 placeholder 文本          │
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 3. 察看当前状态                          │
│    - 已配置/未配置                     │
│    - 掩码密钥 / 来源 / 更新时间         │
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 4. 输入 SK (可选)                        │
│    - 粘贴或离开输入框时                │
│    - 可以 toggle password 可见性        │
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 5. 选择操作                              │
│    ├─ [保存] → validate + save         │
│    ├─ [验证连接] → call validate API  │
│    └─ [清除] → delete + reload status │
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 6. 察看操作结果 (Toast 消息)             │
│    - success (emerald)                 │
│    - error (rose)                      │
│    - info (sky)                        │
└─────────────────────────────────────────┘
```

## 色彩分布地图

```
App 全局背景
├─ min-h-screen bg-slate-50 (亮灰)
│
├─ Header
│  ├─ bg-white
│  ├─ border-b border-slate-200
│  ├─ Logo: bg-slate-900 text-white
│  └─ Tab Nav: bg-slate-100 (活跃 bg-white + shadow-sm)
│
└─ Main Container
   │
   ├─ Section (shared style)
   │  ├─ rounded-xl border border-slate-200 bg-white shadow-sm
   │  ├─ p-6
   │  │
   │  ├─ h2: text-lg font-semibold (slate-800)
   │  ├─ p: text-sm text-slate-500
   │  │
   │  ├─ Label: text-sm font-medium text-slate-700
   │  ├─ Input: border-slate-300 + focus:ring-slate-500
   │  │
   │  └─ Alert Boxes
   │     ├─ Success: border-emerald-200 bg-emerald-50 text-emerald-700
   │     ├─ Error: border-rose-200 bg-rose-50 text-rose-700
   │     └─ Info: border-sky-200 bg-sky-50 text-sky-700
   │
   ├─ Workflow Section 特定
   │  ├─ Model Badge (available)
   │  │  └─ border-slate-200
   │  ├─ Model Badge (disabled)
   │  │  └─ border-rose-200 bg-rose-50 opacity-60
   │  │
   │  ├─ Live Items
   │  │  ├─ Phase Divider: border-slate-200
   │  │  ├─ Todo Box: border-indigo-200 bg-indigo-50
   │  │  │  ├─ Title: text-indigo-700
   │  │  │  └─ Content: text-indigo-500 (id)
   │  │  │
   │  │  └─ Node Card: border-slate-200 bg-slate-50
   │  │     ├─ Pre text: text-slate-700
   │  │     ├─ Success status: text-emerald-600
   │  │     └─ Error status: text-rose-600
   │  │
   │  └─ Difficulty Badge
   │     ├─ easy: 绿 (emerald)
   │     ├─ medium: 黄 (amber/orange)
   │     └─ hard: 红 (rose)
   │
   └─ SkConfig Section 特定
      ├─ Status: emerald-600 (configured) / slate-400 (not configured)
      └─ Button: primary (bg-slate-900) / secondary (border-slate-300) / danger (border-rose-200)
```

## 响应式布局断点

```
全宽 < 小屏(640px)    中屏(768px)         大屏(1024px)
─────────────────────────────────────────────────────
单列堆叠              max-w-3xl (48em)   max-w-3xl
左右 px-4             px-6               px-6
button flex wrap      flex wrap          flex

Example:
App.vue
  Header:  mx-auto max-w-3xl px-6 py-4
  Main:    mx-auto max-w-3xl px-6 py-10
           ↓
           在移动设备上自动调整 px（Tailwind 默认）
```

---

## 快速索引

| 文件 | 职责 | 重要元素 |
|---|---|---|
| **App.vue** | 全局壳 | Header (nav) + Main (tab router) |
| **Workflow.vue** | 工作流UI | 3 sections (pool/form/log) |
| **SkConfig.vue** | 配置UI | Provider select + SK 管理 |
| **format.ts** | 样式函数 | tierClass / kindClass / diffClass / renderNodeOutput |
| **client.ts** | API 客户端 | getModels / listProviders / saveSk / etc |

---

**Frozen at**: 2026-06-16  
**Approval**: ✅ Design + Development confirmed
