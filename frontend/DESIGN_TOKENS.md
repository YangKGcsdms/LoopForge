# 设计 Token 文档

LoopForge 前端的统一设计系统，所有 UI 元素遵循此 token 规范，确保整体一致性。

## 概览

设计 token 包括：
- **颜色**：主色调（中性）、强调色、状态色
- **间距**：4px 基线倍数，用于 padding/margin/width/height/gap
- **圆角**：5 级递进式，从小容器到大模态框
- **阴影**：8 级深度分级，表达视觉层次
- **字体**：标题/正文/代码，含行高与字重
- **其他**：动画时长、不透明度、堆叠顺序

## 颜色系统

### 色板定义

所有颜色遵循 Tailwind CSS 标准 10 级色板（50~900）。

#### 1. 中性色（Slate）
主要用于文字、边框、背景。

```
slate-50   #f8fafc   最亮（背景）
slate-100  #f1f5f9   很浅（悬停）
slate-200  #e2e8f0   浅（边框、分割线）
slate-300  #cbd5e1   较浅（disable、提示）
slate-400  #94a3b8   中浅（文字辅助）
slate-500  #64748b   中（文字次要）
slate-600  #475569   中深（文字主要）
slate-700  #334155   深（文字强调）
slate-800  #1e293b   很深（标题）
slate-900  #0f172a   最深（背景深色模式）
```

**使用场景**：
- `slate-50/100` → 浅色背景、disabled 状态
- `slate-200/300` → 边框、分割线
- `slate-600/700` → 正文文字
- `slate-900` → 按钮背景、强调文字

#### 2. 强调色（Violet）
品牌主色，用于核心交互。

```
violet-50   #faf5ff   背景
violet-100  #f3e8ff   背景（hover）
violet-500  #a855f7   中调
violet-600  #9333ea   主色
violet-700  #7e22ce   深色版本
```

**使用场景**：
- `violet-600` → 按钮（主）、链接
- `violet-100/50` → 背景色、徽章背景
- `violet-500/700` → 状态变化

#### 3. 状态色

##### 成功（Emerald）
```
emerald-50   #f0fdf4   背景
emerald-100  #dcfce7   浅背景
emerald-500  #22c55e   强调
emerald-600  #16a34a   主状态
emerald-700  #15803d   深色
```

##### 警告（Amber）
```
amber-50   #fffbeb   背景
amber-100  #fef3c7   浅背景
amber-500  #f59e0b   强调
amber-600  #d97706   主状态
```

##### 错误（Rose）
```
rose-50   #fff1f2   背景
rose-100  #ffe4e6   浅背景
rose-500  #f43f5e   强调
rose-600  #e11d48   主状态
```

##### 信息（Sky）
```
sky-50   #f0f9ff   背景
sky-100  #e0f2fe   浅背景
sky-500  #0ea5e9   强调
sky-600  #0284c7   主状态
```

**模式**：状态色都遵循 `{color}-50` 背景 + `{color}-600` 前景的模式。

### 色彩使用规则

| 场景 | 颜色 | 例子 |
|-----|------|------|
| 按钮（主） | `slate-900` | 绿色启动按钮 |
| 按钮（次） | `slate-300` border + 白背景 | 取消、次要操作 |
| 文字（主） | `slate-700` | 正文段落 |
| 文字（次） | `slate-500` | 提示、描述 |
| 文字（辅） | `slate-400` | 占位符、disabled |
| 背景（强调） | `slate-50` | 卡片、区块背景 |
| 边框 | `slate-200` | 输入框、卡片边框 |
| 链接 | `violet-600` | 超链接、操作链接 |
| 成功提示 | `emerald-600` bg + `emerald-50` | 绿色警告框 |
| 警告提示 | `amber-600` bg + `amber-50` | 黄色警告框 |
| 错误提示 | `rose-600` bg + `rose-50` | 红色警告框 |
| 信息提示 | `sky-600` bg + `sky-50` | 蓝色警告框 |
| 徽章（强） | `violet-100` bg + `violet-700` | 优先级标签 |
| 徽章（中） | `slate-100` bg + `slate-700` | 状态标签 |

## 间距系统

遵循 4px 基线，确保所有尺寸对齐。

```
单位对照表（rem → px）：
0.25rem = 4px   (space-1)
0.5rem  = 8px   (space-2)
0.75rem = 12px  (space-3)
1rem    = 16px  (space-4)
1.25rem = 20px  (space-5)
1.5rem  = 24px  (space-6)
1.75rem = 28px  (space-7)
2rem    = 32px  (space-8)
2.25rem = 36px  (space-9)
2.5rem  = 40px  (space-10)
3rem    = 48px  (space-12)
4rem    = 64px  (space-16)
5rem    = 80px  (space-20)
6rem    = 96px  (space-24)
```

### 常见组件间距

| 组件 | Padding | 含义 |
|-----|---------|------|
| 卡片 | `p-6` | 24px（内边距） |
| 卡片（小） | `p-3` | 12px |
| 卡片（大） | `p-8` | 32px |
| 按钮（M） | `px-4 py-2` | 16px 宽，8px 高 |
| 按钮（S） | `px-3 py-1.5` | 12px 宽，6px 高 |
| 输入框 | `px-3 py-2` | 12px 宽，8px 高 |
| 列表项 | `px-4 py-2` | 16px 宽，8px 高 |
| 页面边距 | `px-6` | 24px 两侧（在 max-w 容器内） |

### Gap（间隔）

| 情景 | Gap | 例子 |
|-----|-----|------|
| 紧密排列 | `gap-1`/`gap-2` | 标签组、行内元素 |
| 标准排列 | `gap-3`/`gap-4` | 表单字段、卡片列表 |
| 宽松排列 | `gap-6` | 区块间距、主要区域 |
| 超宽松排列 | `gap-8`/`gap-12` | 页面顶层区块 |

## 圆角系统

5 级递进式，从精细到粗糙。

```
rounded-sm  → 0.25rem (4px)   [小组件：badge、小tag]
rounded-base → 0.375rem (6px)   [按钮、input]
rounded-md  → 0.5rem (8px)    [卡片、chip]
rounded-lg  → 0.75rem (12px)  [大卡片、容器]
rounded-xl  → 1rem (16px)     [模态框、高级容器]
rounded-2xl → 1.25rem (20px)  [页面顶层容器（可选）]
rounded-full → 9999px         [完全圆形（头像、圆形按钮）]
```

### 使用指南

| 元素 | 圆角 | 例子 |
|-----|------|------|
| Badge / Tag | `rounded-sm` | `<span class="rounded-sm px-2 py-1">标签</span>` |
| Input / Button | `rounded-base` | `<input class="rounded-base px-3 py-2" />` |
| Card / Panel | `rounded-lg` | `<div class="rounded-lg p-6">卡片</div>` |
| Modal / Dialog | `rounded-xl` | `<dialog class="rounded-xl">对话框</dialog>` |
| Avatar / Circle | `rounded-full` | `<img class="rounded-full h-10 w-10" />` |

## 阴影系统

8 级深度分级，模拟视觉堆叠。

```
shadow-none  → 无阴影
shadow-xs    → 极浅（hint、disabled）
shadow-sm    → 浅（input focus、default 按钮）
shadow-base  → 中（card、panel）
shadow-md    → 中深（浮动面板）
shadow-lg    → 深（popover、dropdown）
shadow-xl    → 很深（模态框）
shadow-2xl   → 最深（高悬浮、画中画）
shadow-3xl   → 超深（特殊强调）
shadow-inner → 内阴影（pressed、inset）
```

### 使用指南

| 场景 | 阴影 | 例子 |
|-----|------|------|
| 卡片（REST） | `shadow-base` | `<div class="shadow-base">...` |
| 卡片（HOVER） | `shadow-md` | `:hover:shadow-md` |
| 浮动按钮 | `shadow-lg` | 悬浮操作按钮 |
| 模态框 | `shadow-xl` | `<dialog class="shadow-xl">` |
| 禁用态 | `shadow-none` | disabled 元素 |
| Input 焦点 | `shadow-sm` | input:focus 边框 + 阴影 |

## 字体系统

### 字号与行高

```
字号表：
text-xs   → 12px / 16px (line-height)   [标签、辅助文字]
text-sm   → 14px / 20px                 [说明、小标题]
text-base → 16px / 24px                 [正文（默认）]
text-lg   → 18px / 28px                 [副标题、强调]
text-xl   → 20px / 28px                 [标题]
text-2xl  → 24px / 32px                 [大标题]
text-3xl  → 30px / 36px                 [特大标题]
text-4xl  → 36px / 40px                 [页面标题]
```

### 字重（Font Weight）

```
font-light     → 300  [细字（很少用）]
font-normal    → 400  [正常（正文默认）]
font-medium    → 500  [中（小标题、强调）]
font-semibold  → 600  [半粗（标题、按钮）]
font-bold      → 700  [粗（强调标题）]
```

### 字体栈

#### 正文（Sans-serif）
```css
font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, ...
```
用于所有文本、UI。

#### 代码（Monospace）
```css
font-mono: "SF Mono", Monaco, Inconsolata, "Fira Code", "Droid Sans Mono", "Source Code Pro", ...
```
用于代码块、终端输出、型号。

### 字间距（Letter Spacing）

```
tracking-tighter → -0.05em   [极紧（全大写标题）]
tracking-tight   → -0.025em  [紧（标题）]
tracking-normal  → 0em       [标准]
tracking-wide    → 0.025em   [宽]
tracking-wider   → 0.05em    [很宽]
tracking-widest  → 0.1em     [极宽（标签、ALL CAPS）]
```

### 标题梯度示例

```vue
<!-- H1 -->
<h1 class="text-4xl font-bold leading-tight">主标题</h1>

<!-- H2 -->
<h2 class="text-3xl font-semibold">副标题</h2>

<!-- H3 -->
<h3 class="text-2xl font-semibold">小标题</h3>

<!-- 正文 -->
<p class="text-base leading-relaxed text-slate-700">Lorem ipsum...</p>

<!-- 辅助文字 -->
<p class="text-sm text-slate-500">辅助说明</p>

<!-- 代码 -->
<code class="font-mono text-sm bg-slate-100 rounded px-1.5 py-0.5">code_example</code>
```

## 动画与过渡

### 过渡时长

```
duration-75   → 75ms    [快速反馈（按钮按下）]
duration-100  → 100ms   [瞬间感受的变化]
duration-150  → 150ms   [快速平滑（hover）]
duration-200  → 200ms   [标准过渡（默认）]
duration-300  → 300ms   [缓和过渡（淡入淡出）]
duration-500  → 500ms   [缓慢变化（开启动画）]
```

### 使用示例

```vue
<!-- Hover 颜色变化 -->
<a class="text-violet-600 hover:text-violet-700 transition-colors duration-150">链接</a>

<!-- Button 悬停阴影 -->
<button class="shadow-sm hover:shadow-md transition-shadow duration-200">按钮</button>

<!-- 淡入淡出 -->
<div class="opacity-0 hover:opacity-100 transition-opacity duration-300">内容</div>
```

## 无障碍（A11y）

### 焦点态

所有可交互元素都有明显焦点态：

```css
.focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500;
}
```

使用此 class 或内联应用，确保键盘用户能清晰看到焦点。

### 对比度

遵循 WCAG AA 标准（4.5:1 文字对比度）：

- ✅ `slate-700` 文字 + `white` 背景 → 通过
- ✅ `slate-600` 文字 + `white` 背景 → 通过
- ❌ `slate-400` 文字 + `white` 背景 → 失败（不宜用于正文）

## 全局基线（Global Baseline）

见 `style.css`，定义了：
- HTML/Body 默认样式
- 标题排版（H1~H6）
- 正文段落基线
- 列表样式
- 链接样式
- 代码样式
- 表单元素（input/textarea/select）
- 表格样式
- 按钮焦点态
- 警告框组件
- 深色模式适配（可选）

## 共用 CSS Classes

### 卡片

```vue
<!-- 标准卡片 -->
<div class="card">内容</div>

<!-- 小卡片 -->
<div class="card-sm">内容</div>

<!-- 大卡片 -->
<div class="card-lg">内容</div>
```

### 警告框

```vue
<!-- 成功 -->
<div class="alert alert-success">✓ 操作成功</div>

<!-- 警告 -->
<div class="alert alert-warning">⚠ 请注意</div>

<!-- 错误 -->
<div class="alert alert-error">✗ 出错了</div>

<!-- 信息 -->
<div class="alert alert-info">ℹ 提示信息</div>
```

### 徽章

```vue
<!-- 不同颜色 -->
<span class="badge badge-violet">强</span>
<span class="badge badge-slate">中</span>
<span class="badge badge-emerald">成功</span>
<span class="badge badge-amber">警告</span>
<span class="badge badge-rose">错误</span>
```

### 按钮

```vue
<!-- 主按钮 -->
<button class="btn btn-primary px-4 py-2">确定</button>

<!-- 次按钮 -->
<button class="btn btn-secondary px-4 py-2">取消</button>

<!-- 危险按钮 -->
<button class="btn btn-danger px-4 py-2">删除</button>
```

### 文字强调

```vue
<p class="text-muted">禁用或次要文字</p>
<p class="text-subtle">极次要提示</p>
```

## 实践建议

### ✅ Do

1. **使用 Token，不用硬编码颜色**
   ```vue
   <!-- Good -->
   <div class="text-slate-700 bg-slate-50">内容</div>
   ```

2. **保持间距倍数**
   ```vue
   <!-- Good: p-6 = 24px -->
   <div class="p-6">...
   
   <!-- Bad: 随意值 -->
   <div style="padding: 18px">...
   ```

3. **使用 component class**
   ```vue
   <!-- Good -->
   <div class="card">...
   
   <!-- Less good -->
   <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-base">...
   ```

4. **明确焦点态**
   ```vue
   <!-- Good -->
   <input class="focus:ring-2 focus:ring-violet-500 focus:outline-none" />
   ```

### ❌ Don't

1. **避免硬编码颜色**
   ```vue
   <!-- Bad -->
   <div style="color: #334155">...
   ```

2. **避免非 Token 间距**
   ```vue
   <!-- Bad -->
   <div style="padding: 13px">...
   ```

3. **避免交互元素无焦点态**
   ```vue
   <!-- Bad -->
   <button class="bg-slate-900 text-white">...
   ```

4. **避免颜色对比度不足**
   ```vue
   <!-- Bad: 文字太浅 -->
   <p class="text-slate-300">正文内容</p>
   ```

## 检查清单

实施此设计 token 系统时：

- [ ] 所有颜色来自色板（无随意 hex 值）
- [ ] 所有间距是 4px 倍数（0, 4, 8, 12, 16, 20, 24, 28, 32...）
- [ ] 所有可交互元素有焦点态（`:focus-visible` 或 `focus:ring-*`）
- [ ] 文字颜色对比度满足 WCAG AA（4.5:1）
- [ ] 圆角选用恰当等级（input用 base，卡片用 lg，modal 用 xl）
- [ ] 阴影等级合理（静态 base，hover md，modal xl）
- [ ] 按钮有 hover / active / disabled 状态样式
- [ ] 表单有 error/success/warning 状态显示

## 工具与引用

- **Tailwind CSS 官方文档**：https://tailwindcss.com/
- **色彩无障碍检查**：https://contrast-ratio.com/
- **Figma 设计稿**：[待补充项目链接]
- **组件库**：[待补充使用的 Vue 组件库名称]

---

**最后更新**：2026-06-16  
**维护者**：Frontend Team
