# S0：对齐基线与范围冻结 · 前端架构设计原则与验收确认

**任务目标**：确认 `frontend-design` 原则来源、产出页面信息架构图与组件清单、书面冻结本次开发范围。

**完成日期**：2026-06-16  
**执行人**：Claude Code  
**验收方式**：架构图+组件清单+原则文档+范围冻结声明

---

## 一、Frontend-Design 原则来源与规范

### 1.1 设计原则总览

LoopForge 前端采用**现代化、渐进增强的 UI 设计**，基于以下源头：

| 原则 | 来源 | 应用 |
|---|---|---|
| **Tailwind 化学系** | Tailwind CSS + 自然设计色彩 | 无预构建组件库依赖，原子类直接组装 |
| **信息等级制** | 数据驱动/流程反演 | 模态区分（Task > Form > Output），深度反映功能优先级 |
| **渐进增强** | 工业设计·可用性 | 加载态→交互态→完成态，每层独立自洽 |
| **认知负荷最小** | 信息建筑师原则 | 单屏不超 3 个区块，区块间清晰分离（border + bg + shadow） |
| **局部一致性** | 现有 App.vue/Workflow.vue/SkConfig.vue 约定俗成 | 延续 slate 色系、圆角（rounded-lg / rounded-xl）、间距（px-6 py-4）、卡片模式（border + white bg） |

### 1.2 色彩系统（来自 Tailwind 默认调色板）

**关键色带**（优先级从高到低）：

```
主体         : slate (灰)          [bg-slate-50 / border-slate-200 / text-slate-800]
成功         : emerald (绿)        [bg-emerald-50 / border-emerald-200 / text-emerald-600/700]
错误         : rose (粉红)         [bg-rose-50 / border-rose-200 / text-rose-600/700]
信息         : sky (蓝)            [bg-sky-50 / border-sky-200 / text-sky-700]
突出/次选    : indigo (靛蓝)       [border-indigo-200 / bg-indigo-50 / text-indigo-*]
警告/中性    : amber (琥珀)        [bg-amber-500 / text-amber-*]（仅 Hint 场景）
```

**组件级色彩用法**（现状）：

- **卡片** = `bg-white` + `border-slate-200` + `shadow-sm`
- **表单元素** = `border-slate-300` + `focus:ring-slate-500`
- **成功反馈** = `text-emerald-600` 或 `bg-emerald-50 + border-emerald-200`
- **错误反馈** = `text-rose-600` 或 `bg-rose-50 + border-rose-200`
- **文本层级** = `text-slate-800`(H1) > `text-slate-700`(body) > `text-slate-500`(hint) > `text-slate-400`(faint)

### 1.3 排版与间距基准（Tailwind 8px 网格）

```
字体栈         : 系统字体（无显式声明，浏览器默认）
行高           : 紧凑 leading-tight / 标准 leading-normal / 松散 (无特殊)

标题层级       : h1 (text-base font-semibold) / h2 (text-lg font-semibold) / 副标题 (text-sm text-slate-500)
正文           : text-sm (14px) 或 text-xs (12px)

外边距基准     : px-6 py-4 (24px h-gutter, 16px v-gutter) —— 页面外框、section 标准
内边距         : px-3 py-2 (表单) / px-4 py-3 (提示框) / px-2 py-1 (tag)
间距           : gap-2 ~ gap-6 (视容器密度)
```

### 1.4 圆角与阴影约定

```
rounded-lg   = 标准圆角 8px  ← 表单、button、小卡片
rounded-xl   = 大圆角 12px   ← section 大卡片
shadow-sm    = 轻微阴影      ← 卡片浮起感（可选，通常配合 border）
```

### 1.5 交互设计规范

**按钮族**：

| 类型 | CSS | 用途 |
|---|---|---|
| Primary | `bg-slate-900 text-white hover:bg-slate-700` | 主要行动（保存、运行、验证） |
| Secondary | `border border-slate-300 text-slate-700 hover:bg-slate-50` | 次要操作（显示/隐藏） |
| Danger | `border border-rose-200 text-rose-600 hover:bg-rose-50` | 破坏性操作（清除） |
| Loading | `disabled:opacity-50` | 禁用态（运行中） |

**表单元素**：

- Input / Textarea: `border-slate-300` + `focus:border-slate-500 focus:ring-1 focus:ring-slate-500`
- Select: 同 input
- Checkbox: `h-4 w-4 rounded border-slate-300`

**反馈信息框**（用 3 色系）：

- Success: `border-emerald-200 bg-emerald-50 text-emerald-700`
- Error: `border-rose-200 bg-rose-50 text-rose-700`
- Info: `border-sky-200 bg-sky-50 text-sky-700`

### 1.6 布局模式

**全局布局**（App.vue）：

```
┌─────────────────────────────────────┐
│  Header (border-b, bg-white)        │  固定高度 ~py-4, 带 Logo + Nav
├─────────────────────────────────────┤
│                                     │
│  Main (mx-auto max-w-3xl px-6 py-10)  响应式内容区，max 宽度约 48em
│                                     │
└─────────────────────────────────────┘
```

**Section 内部布局**（重复模式）：

```
┌──────────────────────────────┐
│ 标题 (h2 + 副标题)            │
├──────────────────────────────┤
│ 内容区（label > input > 提示） │
│ （或卡片列表）                │
├──────────────────────────────┤
│ 底部操作（按钮 + 反馈）       │
└──────────────────────────────┘
```

---

## 二、页面信息架构图

### 2.1 全局导航结构

```
LoopForge (L0 - 应用主体)
├── Header
│   ├── Logo + 应用名
│   └── Tab Navigation (工作流 / SK 配置) ← 一级路由替代
├── Main Container (max-w-3xl)
│   ├── [Tab: 工作流]  Workflow.vue
│   │   ├── ① 路由池管理 Section
│   │   │   ├── Provider 选择器
│   │   │   ├── 模型可用性
│   │   │   └── 池路由展示
│   │   ├── ② 运行表单 Section
│   │   │   ├── 需求输入 (textarea)
│   │   │   ├── 目标输入 (input)
│   │   │   ├── cwd 输入 (input)
│   │   │   ├── dryRun 开关
│   │   │   ├── [运行] 按钮
│   │   │   └── 错误提示
│   │   └── ③ 实时观察 Section
│   │       ├── 难度评估展示
│   │       ├── 路由方案展示
│   │       └── 运行日志区
│   │           ├── 阶段头 (phase)
│   │           ├── TODO 列表 (todos)
│   │           ├── 节点卡片 (node)
│   │           │   ├── 元信息行 (id/kind/status)
│   │           │   └── 打字机效果的内容
│   │           └── 完成统计
│   │
│   └── [Tab: SK 配置]  SkConfig.vue
│       ├── ① Provider 选择 Section
│       │   ├── Select 下拉框
│       │   └── 支持/不支持提示
│       ├── ② 当前状态展示
│       │   ├── 配置状态标识
│       │   └── 掩码密钥 + 元数据
│       ├── ③ SK 输入区
│       │   ├── Input (password/text toggle)
│       │   └── Placeholder 动态提示
│       ├── ④ 操作按钮组
│       │   ├── [保存]、[验证连接]、[清除]
│       │   └── Loading 态管理
│       └── ⑤ 消息反馈
│           └── Success / Error / Info 模态
```

### 2.2 内容流与优先级

**Workflow.vue 阅读顺序**（由上至下，反映认知负荷）：

1. **路由池** (信息性) — 当前引擎状态，辅助决策
2. **运行表单** (任务性) — 3 个输入 + 1 个开关 + 1 个主操作
3. **实时观察** (输出性) — 仅在运行时展示，流式追加

**SkConfig.vue 阅读顺序**：

1. **标题 + 说明** — 快速定位功能
2. **Provider 选择** — 先选择对象
3. **当前状态** — 反馈现状
4. **输入 & 操作** — 完成任务
5. **消息提示** — 反馈结果

---

## 三、组件清单（现状盘点）

### 3.1 组件树与职责

```
App.vue (root, 应用壳)
 ├─ role: 全局布局、导航、tab 切换
 ├─ state: tab (ref<"workflow" | "sk">)
 ├─ 子组件 (conditional render):
 │   ├─ Workflow.vue     (if tab === "workflow")
 │   └─ SkConfig.vue     (if tab === "sk")
 └─ CSS: min-h-screen (全屏), color/border (全局样式)

Workflow.vue (业务组件)
 ├─ role: 自驱管道UI呈现、表单操作、实时流处理
 ├─ state:
 │   ├─ models, modelSource, modelNote, poolRouting
 │   ├─ provider, requirement, goal, cwd, dryRun
 │   ├─ running, error
 │   ├─ live (LiveItem[])
 │   ├─ difficulty, routing, finalDone
 │   └─ EventSource 相关 (es, queue, typing, seq, pending)
 ├─ 主要逻辑:
 │   ├─ loadModels() — 获取模型列表
 │   ├─ startRun() — 触发后端流水线，监听 EventSource
 │   ├─ pump() — 排队打字机效果
 │   └─ cleanup() — EventSource 清理
 ├─ template 分 3 个 section:
 │   ├─ 路由池信息
 │   ├─ 运行表单
 │   └─ 实时观察日志
 └─ 子组件: 无

SkConfig.vue (业务组件)
 ├─ role: SK 密钥管理UI
 ├─ state:
 │   ├─ providers, selectedProvider
 │   ├─ apiKey, showKey
 │   ├─ status
 │   ├─ busy, message, tone
 │   └─ computed: supportedProviders, isClaude, keyPlaceholder, etc.
 ├─ 主要逻辑:
 │   ├─ loadProviders(), loadStatus()
 │   ├─ save(), validate(), clear()
 │   └─ notify()
 ├─ template:
 │   ├─ Provider 选择
 │   ├─ 当前状态展示
 │   ├─ SK 输入
 │   ├─ 操作按钮
 │   └─ 消息反馈
 └─ 子组件: 无
```

### 3.2 可复用工具模块

**`src/lib/format.ts`** — 样式与渲染辅助函数

```typescript
export function renderNodeOutput(node: NodeData): string
  // 将节点数据序列化为可读字符串

export function tierClass(tier: string): string
  // 模型 tier 映射到 CSS 类名（如 basic → bg-slate-100）

export function kindClass(kind: string): string
  // 节点 kind 映射到颜色类（plan/execute/review → 不同色彩）

export function diffClass(difficulty: string): string
  // 难度映射到颜色（easy/medium/hard → emerald/amber/rose）
```

**`src/api/client.ts`** — HTTP 客户端

```typescript
export const api = {
  getModels(provider: string): Promise<{models, source, note, routing}>
  listProviders(): Promise<{providers}>
  getSkStatus(provider: string): Promise<SkStatus>
  saveSk(provider: string, apiKey: string): Promise<SkStatus>
  validateSk(provider: string, apiKey?: string): Promise<ValidateResult>
  clearSk(provider: string): Promise<void>
}
```

### 3.3 状态管理特点（现状）

- **无全局状态库**（无 Pinia / Vuex），完全本地组件 state
- **组件间通信**：仅靠 HTTP 后端（强制串行）
- **副作用管理**：`onMounted` / `onUnmounted` + EventSource 流处理

---

## 四、范围冻结：本次开发不含与明确确认

### 4.1 ✅ 本次开发范围（S0 之后的后续任务）

| 维度 | 确认 | 说明 |
|---|---|---|
| **页面结构** | ✅ | App.vue (header + tab nav + main) + Workflow.vue + SkConfig.vue —— 三个现存组件维持 |
| **色彩系统** | ✅ | Tailwind 默认色盘（slate / emerald / rose / sky / indigo / amber）—— 不扩展自定义色 |
| **交互范式** | ✅ | 表单 + 流式日志 + 消息反馈（无 modal / popover / drawer）—— 文件视图场景视需要判断 |
| **响应式** | ✅ | `max-w-3xl` 约束宽度，移动端显示由 Tailwind 默认堆叠 |
| **字体** | ✅ | 系统字体（不引入 @font-face）|
| **动画** | ✅ | 打字机效果（Workflow 中现有）+ 脉冲/淡出（Tailwind animate-pulse）|

### 4.2 ❌ 本次开发明确不含（超出范围）

| 项 | 理由 | 替代方案 |
|---|---|---|
| **暗色模式** | 业务尚无需求，现有色彩系统仅为亮色设计；加黑色适配成本高 | 后续单独立 feat 分支，引入 `dark:` prefixed Tailwind + 全局 theme toggle |
| **结果区增强**（表格/图表/富文本预览） | 当前 Workflow 实时日志以纯文本流呈现，足以反映节点进度；扩展成表格/图表需结构化数据、后端接口重设 | 后续根据运行结果类型（metrics/file-diff/coverage）单独设计，或改后端 event schema |
| **组件库升级**（Headless UI / Radix / @vuetify） | Tailwind + 原子类已满足当前 UI 复杂度；引入库易造成风格统一破裂 | 若将来需要 accessible modal / combobox 等复杂交互，考虑 Headless UI for Vue |
| **全局状态库**（Pinia 等） | 现状无跨页面状态共享需求，HTTP 后端作单一数据源；加 store 成本大 | 当页面/组件数 > 5 或出现跨层级频繁通信时，引入 Pinia |
| **单元测试覆盖** | 本次聚焦架构冻结 + 确认范围；测试框架(Vitest)装配延后 | 下一阶段单独立 feat，补充组件测试 (`.spec.ts`) 与集成测试 |
| **i18n 国际化** | 当前全部中文硬编；无多语言规划 | 若后续需要，走标准 i18n 流程（`vue-i18n` + 资源文件分离） |

### 4.3 范围冻结确认声明

**以下各项已确认，不作变更**：

1. ✅ **页面信息架构**：App.vue 作全局容器 + Tab 一级路由 + Workflow/SkConfig 两个业务页面
2. ✅ **色彩体系**：Tailwind 标准色板，无自定义色值扩展
3. ✅ **交互设计**：表单 + 流式输出 + Toast 提示，无 Modal/Drawer/Popover
4. ✅ **排版/间距**：px-6 py-4 (section) / px-3 py-2 (form) / rounded-lg/xl (组件)
5. ✅ **状态管理**：本地组件 state + HTTP 后端，无全局 store
6. ✅ **暗色模式**：**不含**本次开发范围，确认后续单独迭代
7. ✅ **结果区增强**：**不含**本次开发范围，现状纯文本流式日志维持不变
8. ✅ **单元测试**：**不含**本次开发范围，下阶段补充

---

## 五、现状代码行为快速检查清单

### 5.1 App.vue

- [x] Header 布局正确（logo + nav + tab）
- [x] Tab 切换逻辑正确（ref 切换）
- [x] 全局色彩（bg-slate-50 / border-slate-200）符合原则
- [x] 内容区约束宽度（max-w-3xl）

### 5.2 Workflow.vue

- [x] 3 个 section 分离明确（路由池/表单/日志）
- [x] 表单元素样式统一（border-slate-300 + focus ring）
- [x] 模型卡片色彩层级（available 色/disabled 色）
- [x] 日志区实现了打字机效果（animate-pulse + 逐字输出）
- [x] 反馈信息框用了色彩系统（emerald-50 / rose-50 / sky-50）
- [x] button 有 disabled 态（opacity-50）

### 5.3 SkConfig.vue

- [x] Provider 选择器样式一致
- [x] 状态显示用了颜色区分（emerald-600 已配 / slate-400 未配）
- [x] 输入框密钥隐藏/显示 toggle
- [x] 操作按钮色彩分级（primary/secondary/danger）
- [x] 消息框用了 tone + messageClass 映射

---

## 附录 A：frontend-design 原则快速参考卡

```plaintext
┌─ 色彩 ──────────────────────────────────────────┐
│ 主体/中性  slate-* (bg-slate-50, border-slate-200)
│ ✅ 成功    emerald-* (emerald-600, emerald-50)
│ ❌ 错误    rose-* (rose-600, rose-50)
│ ℹ 信息     sky-* (sky-700, sky-50)
│ ◈ 突出     indigo-* / amber-*
└────────────────────────────────────────────────┘

┌─ 排版 ──────────────────────────────────────────┐
│ 标题       text-lg/base + font-semibold
│ 正文       text-sm + text-slate-700
│ 辅助       text-xs + text-slate-500
│ 代码       font-mono + text-sm/xs
└────────────────────────────────────────────────┘

┌─ 间距 ──────────────────────────────────────────┐
│ section 外框 px-6 py-4 / px-6 py-10
│ 表单行   mb-4 / mb-5
│ 卡片内   px-4 py-3 / px-3 py-2
│ 行间距   gap-2 / gap-3 / gap-6
└────────────────────────────────────────────────┘

┌─ 组件 ──────────────────────────────────────────┐
│ 圆角     rounded-lg (8px) / rounded-xl (12px)
│ 边框     border-slate-200 (卡片) / border-slate-300 (表单)
│ 阴影     shadow-sm (卡片可选)
│ 按钮     bg-slate-900 (主) / border border-slate-300 (次)
└────────────────────────────────────────────────┘
```

---

## 附录 B：后续任务预判（非本次范围）

根据当前基线，后续可能的设计任务：

1. **UI 组件库化**（如需复用度 > 30% 时）
   - 按钮簇、表单元素、卡片、反馈框 → 可抽成 `components/base/*.vue`
   
2. **文件视图增强**（若需显示 diff / 目录树）
   - 新增 `components/FileTree.vue` / `components/DiffViewer.vue`
   - 色彩：用 slate 系深色背景 (slate-800/900) 显示代码，保持高对比
   
3. **仪表板化**（若需业务指标）
   - 状态分布、成功率、性能指标 → 图表库（Chart.js / ECharts）
   - 新色系：统计用 sky / indigo / amber，保持 Tailwind 原则
   
4. **暗色模式**（若用户需求）
   - Tailwind `dark:` prefix + 全局 theme toggle
   - 色板反演：bg-slate-50 → dark:bg-slate-950 等
   - 工作量：~2 小时（搜替 + 测试）

---

**签字确认**

本文档代表前端架构基线与本次（S0）范围的最终确认。

- **基线设计原则**：已对齐 Tailwind 现代化规范 + 现有代码约定
- **信息架构**：已完整列举三页结构与内容流
- **组件清单**：已盘点 App.vue / Workflow.vue / SkConfig.vue + 工具模块
- **范围冻结**：明确不含暗色模式与结果区增强
- **验收节点**：本文档 + 代码 lint 通过 + 视觉回归测试（人肉 check）

**下一步行动**：
1. 本文档由开发方和产品方共同审核
2. 若有反馈修改，记录于本文附注
3. 合并至 main 分支作为 baseline reference
4. 后续功能 MR 必须声明是否涉及本范围外的设计变更
