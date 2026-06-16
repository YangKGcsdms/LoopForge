# S0 组件清单（LoopForge 前端现状盘点）

**冻结日期**：2026-06-16  
**盘点范围**：`frontend/src/**/*.{vue,ts}`  
**总结状态**：3 个 Vue 页面组件 + 2 个 TypeScript 工具模块 + 0 个复用组件库

---

## 一、页面组件

### 1.1 App.vue (根组件 / 应用壳)

| 属性 | 值 |
|---|---|
| **文件** | `frontend/src/App.vue` |
| **职责** | 全局布局 + 导航路由 + 主题应用 |
| **模式** | 单文件组件 (SFC) + `<script setup>` |
| **行数** | ~47 行 |

**内部结构**：

```vue
<script setup>
  import SkConfig from "./components/SkConfig.vue"
  import Workflow from "./components/Workflow.vue"
  const tab = ref<"workflow" | "sk">("workflow")
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800">
    <!-- Header: Logo + Tab Nav -->
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
        <!-- Logo Box (rounded-md bg-slate-900) -->
        <!-- Heading + Subtitle -->
        <!-- Tab Buttons (bg-slate-100, active 变 bg-white shadow-sm) -->
      </div>
    </header>

    <!-- Main: Conditional Component Render -->
    <main class="mx-auto max-w-3xl px-6 py-10">
      <Workflow v-if="tab === 'workflow'" />
      <SkConfig v-else />
    </main>
  </div>
</template>
```

**关键特性**：

- ✅ `ref<"workflow" | "sk">` 本地状态管理（无全局 store）
- ✅ `v-if` 条件渲染，两个组件互斥显示
- ✅ Header 固定导航，max-w-3xl 宽度约束
- ✅ Tailwind 全局色彩：bg-slate-50 (背景) + border-slate-200 (边框) + text-slate-800 (文本)

**样式统计**：

| 类型 | 数量 | 示例 |
|---|---|---|
| 布局类 | 6 | min-h-screen, mx-auto, max-w-3xl, flex, gap-*, px-6, py-* |
| 色彩类 | 5 | bg-slate-50/white/100/900, text-slate-*, border-slate-200 |
| 圆角类 | 2 | rounded-md (logo), rounded-lg (按钮) |
| 阴影类 | 1 | shadow-sm (活跃 tab) |
| 字体类 | 3 | font-bold, font-semibold, text-base/sm/xs |

---

### 1.2 Workflow.vue (工作流页面组件)

| 属性 | 值 |
|---|---|
| **文件** | `frontend/src/components/Workflow.vue` |
| **职责** | 自驱管道 UI：表单输入 + 实时流处理 + 日志展示 |
| **模式** | SFC + `<script setup>` + EventSource 流处理 |
| **行数** | ~350 行 |

**内部结构**：

```vue
<script setup>
  // 状态分组
  const models = ref<CatalogModel[]>([])           // 模型列表
  const provider = ref("cursor")                    // 引擎选择
  const requirement = ref("...")                    // 需求输入
  const goal = ref("...")                           // 目标输入
  const cwd = ref("")                               // 工作目录
  const dryRun = ref(true)                          // 开关
  
  const running = ref(false)                        // 运行状态
  const error = ref("")                             // 错误提示
  
  const live = ref<LiveItem[]>([])                  // 运行日志
  const difficulty = ref<{value, reason}>()        // 难度评估
  const routing = ref<Record<string, string>>()    // 路由方案
  const finalDone = ref<{todos, developed}>()     // 完成统计
  
  // EventSource 相关
  let es: EventSource | null = null
  const queue: LiveItem[] = []
  let typing = false, seq = 0, pending = null

  // 函数: pump() / startRun() / loadModels() / cleanup()
</script>

<template>
  <!-- Section 1: 路由池信息 -->
  <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2>路由池 · {{ provider }}</h2>
    <select v-model="provider" @change="loadModels">
      <option value="cursor">Cursor SDK</option>
      <option value="claude-agent">Claude Agent SDK</option>
    </select>
    <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
      {{ modelSource === "live" ? "实时可用性" : "可用性未知" }}
    </span>
    <div class="flex flex-wrap gap-2">
      <span v-for="m in models" :key="m.id"
            class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm"
            :class="m.available === false ? 'border-rose-200 bg-rose-50 opacity-60' : 'border-slate-200'">
        {{ m.displayName }}
        <span :class="tierClass(m.tier)" class="rounded px-1.5 py-0.5 text-xs">{{ m.tier }}</span>
      </span>
    </div>
  </section>

  <!-- Section 2: 运行表单 -->
  <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2>自驱开发流水线</h2>
    <label>需求</label>
    <textarea v-model="requirement" rows="2" class="mb-4 w-full rounded-lg border..."></textarea>
    
    <label>最终目标</label>
    <input v-model="goal" class="mb-4 w-full rounded-lg border...">
    
    <label>工作目录 cwd（可选）</label>
    <input v-model="cwd" placeholder="..." class="mb-4 w-full rounded-lg border...">
    
    <div class="flex items-center justify-between">
      <label class="flex items-center gap-2 text-sm text-slate-600">
        <input v-model="dryRun" type="checkbox" class="h-4 w-4 rounded border-slate-300">
        dryRun（内置 mock，无需 SDK/SK）
      </label>
      <button @click="startRun" :disabled="running"
              class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
        {{ running ? "运行中…" : "评估并自驱运行" }}
      </button>
    </div>

    <div v-if="error" class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </div>
  </section>

  <!-- Section 3: 实时观察日志 -->
  <section v-if="difficulty || live.length" class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2>实时自驱运行</h2>
    
    <!-- Difficulty Badge -->
    <div v-if="difficulty" class="mb-2 flex flex-wrap items-center gap-2 text-sm">
      <span class="text-slate-500">难度</span>
      <span :class="diffClass(difficulty.value)" class="rounded px-2 py-0.5 font-medium">{{ difficulty.value }}</span>
      <span class="text-slate-400">{{ difficulty.reason }}</span>
    </div>
    
    <!-- Routing Info -->
    <div v-if="routing" class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
      <span class="font-medium text-slate-600">路由方案（按用途）：</span>
      <span>出方案 <span class="font-mono text-slate-700">{{ routing.plan }}</span></span>
      <!-- ... -->
    </div>
    
    <!-- Live Items Stream -->
    <div class="space-y-2">
      <template v-for="item in live" :key="item.key">
        <!-- Phase -->
        <div v-if="item.kind === 'phase'" class="flex items-center gap-2 pt-2">
          <span class="h-px flex-1 bg-slate-200"></span>
          <span class="text-xs font-semibold tracking-wide text-slate-500">{{ item.name }}</span>
          <span class="h-px flex-1 bg-slate-200"></span>
        </div>
        
        <!-- Todos -->
        <div v-else-if="item.kind === 'todos'" class="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <div class="mb-2 text-sm font-semibold text-indigo-700">TODO 列表（{{ item.subtasks.length }} 项）</div>
          <ul class="space-y-1 text-sm">
            <li v-for="s in item.subtasks" :key="s.id" class="flex items-baseline gap-2">
              <span class="font-mono text-indigo-500">{{ s.id }}</span>
              <span class="font-medium">{{ s.title }}</span>
              <span class="rounded bg-white px-1.5 text-xs text-slate-500">{{ s.estimateHours }}h</span>
            </li>
          </ul>
        </div>
        
        <!-- Node -->
        <div v-else class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div class="mb-1.5 flex items-center gap-2 text-sm">
            <span class="font-mono font-medium">{{ item.id }}</span>
            <span :class="kindClass(item.nodeKind)" class="rounded px-1.5 py-0.5 text-xs">{{ item.nodeKind }}</span>
            <span v-if="item.iteration" class="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
              第 {{ item.iteration }} 轮
            </span>
            <span :class="item.status === 'ok' ? 'text-emerald-600' : 'text-rose-600'" class="text-xs">
              {{ item.status }}
            </span>
          </div>
          <pre class="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700">{{ item.typed }}<span
            v-if="item.typed.length < item.full.length" class="animate-pulse">▋</span></pre>
        </div>
      </template>
    </div>
    
    <!-- Final Done Banner -->
    <div v-if="finalDone"
         class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      完成 · 拆出 {{ finalDone.todos }} 个 TODO · 自循环开发完成 {{ finalDone.developed }} 个
    </div>
  </section>
</template>
```

**核心逻辑**：

| 函数 | 作用 |
|---|---|
| `loadModels()` | 加载当前 provider 的模型列表 |
| `startRun()` | 触发后端流水线，打开 EventSource 监听 |
| `pump()` | 队列出队 + 打字机效果 (sleep 4ms per char) |
| `cleanup()` | 关闭 EventSource |

**事件监听** (EventSource):

```javascript
es.addEventListener("difficulty", (e) => { difficulty.value = JSON.parse(e.data) })
es.addEventListener("routing", (e) => { routing.value = JSON.parse(e.data) })
es.addEventListener("phase", (e) => { queue.push({kind: "phase", ...}) })
es.addEventListener("todos", (e) => { queue.push({kind: "todos", ...}) })
es.addEventListener("node-end", (e) => { queue.push({kind: "node", ...}) })
es.addEventListener("done", (e) => { pending = JSON.parse(e.data); cleanup() })
es.addEventListener("error", (e) => { error.value = "..."; cleanup() })
```

**样式统计**：

| 类型 | 数量 | 关键用法 |
|---|---|---|
| 布局 | 20+ | flex, grid, gap-*, space-y-2, mb-*, px-*, py-* |
| 色彩 | 15+ | slate-*/emerald-*/rose-*/indigo-*/sky-* |
| 圆角 | 5 | rounded-lg / rounded-xl |
| 阴影 | 2 | shadow-sm |
| 字体 | 8+ | font-mono, font-semibold, text-xs/sm/lg |
| 动画 | 1 | animate-pulse (光标) |

---

### 1.3 SkConfig.vue (SK 密钥管理页面组件)

| 属性 | 值 |
|---|---|
| **文件** | `frontend/src/components/SkConfig.vue` |
| **职责** | SK 密钥配置：输入、保存、验证、清除 |
| **模式** | SFC + `<script setup>` + computed |
| **行数** | ~223 行 |

**内部结构**：

```vue
<script setup>
  const providers = ref<ProviderInfo[]>([])
  const selectedProvider = ref("cursor")
  const apiKey = ref("")
  const showKey = ref(false)
  const status = ref<SkStatus | null>(null)
  
  const busy = ref<null | "load" | "save" | "validate" | "clear">(null)
  const message = ref("")
  const tone = ref<Tone>("idle" | "ok" | "error" | "info")
  
  const supportedProviders = computed(...)   // 过滤
  const unsupportedProviders = computed(...) // 过滤
  const isClaude = computed(...)             // boolean
  const keyPlaceholder = computed(...)       // 动态文本
  const messageClass = computed(...)         // 动态样式映射

  async function loadProviders() {...}
  async function loadStatus() {...}
  async function save() {...}
  async function validate() {...}
  async function clear() {...}
  function notify(text: string, t: Tone) {...}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-lg font-semibold">SK 配置</h2>
      <p class="mt-1 text-sm text-slate-500">配置访问密钥以驱动 SDK 集成层。</p>
    </div>

    <!-- Provider 选择 -->
    <div class="mb-5">
      <label class="mb-1.5 block text-sm font-medium text-slate-700">Provider</label>
      <select v-model="selectedProvider" @change="loadStatus"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500">
        <option v-for="p in supportedProviders" :key="p.id" :value="p.id">
          {{ p.displayName }}
        </option>
        <option v-for="p in unsupportedProviders" :key="p.id" :value="p.id" disabled>
          {{ p.displayName }} —— {{ p.note ?? "暂不支持" }}
        </option>
      </select>
      <p class="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
        <span class="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"></span>
        {{ providerHint }}
      </p>
    </div>

    <!-- 当前状态 -->
    <div class="mb-5 rounded-lg bg-slate-50 px-4 py-3 text-sm">
      <span class="text-slate-500">当前状态：</span>
      <template v-if="status?.configured">
        <span class="font-medium text-emerald-600">已配置</span>
        <span class="ml-2 font-mono text-slate-600">{{ status.maskedKey }}</span>
        <span v-if="status.source === 'env'" class="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
          来自环境变量
        </span>
        <span v-if="status.updatedAt" class="ml-2 text-xs text-slate-400">
          更新于 {{ new Date(status.updatedAt).toLocaleString() }}
        </span>
      </template>
      <span v-else class="font-medium text-slate-400">未配置</span>
    </div>

    <!-- SK 输入 -->
    <div class="mb-5">
      <label class="mb-1.5 block text-sm font-medium text-slate-700">Secret Key</label>
      <div class="flex gap-2">
        <input v-model="apiKey" :type="showKey ? 'text' : 'password'" :placeholder="keyPlaceholder"
               autocomplete="off"
               class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500">
        <button type="button" @click="showKey = !showKey"
                class="shrink-0 rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50">
          {{ showKey ? "隐藏" : "显示" }}
        </button>
      </div>
      <p class="mt-1.5 text-xs text-slate-400">SK 仅发送到本地后端并落盘于 backend/.data，不经第三方。</p>
    </div>

    <!-- 操作按钮 -->
    <div class="flex flex-wrap gap-3">
      <button type="button" @click="save" :disabled="busy !== null"
              class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
        {{ busy === "save" ? "保存中…" : "保存" }}
      </button>
      <button type="button" @click="validate" :disabled="busy !== null"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        {{ busy === "validate" ? "校验中…" : "验证连接" }}
      </button>
      <button type="button" @click="clear" :disabled="busy !== null"
              class="ml-auto rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
        {{ busy === "clear" ? "清除中…" : "清除" }}
      </button>
    </div>

    <!-- 消息提示 -->
    <div v-if="tone !== 'idle'" :class="messageClass" class="mt-5 rounded-lg border px-4 py-3 text-sm">
      {{ message }}
    </div>
  </section>
</template>
```

**关键特性**：

- ✅ `computed` 动态计算属性（supportedProviders / isClaude / keyPlaceholder / messageClass）
- ✅ `notify()` 中心化消息管理
- ✅ `showKey` toggle 密钥可见性
- ✅ `busy` 状态机管理按钮加载态
- ✅ 异步函数 (save / validate / clear)

**样式统计**：

| 类型 | 数量 | 关键用法 |
|---|---|---|
| 布局 | 12+ | flex, gap-*, mb-*, w-full |
| 色彩 | 10+ | emerald-600 (configured) / slate-400 (not) / rose-600 (danger) |
| 圆角 | 3 | rounded-lg / rounded-full |
| 阴影 | 2 | shadow-sm |
| 字体 | 5 | font-medium, font-mono, text-xs/sm |

---

## 二、工具模块

### 2.1 format.ts (样式与渲染函数库)

| 属性 | 值 |
|---|---|
| **文件** | `frontend/src/lib/format.ts` |
| **职责** | 数据序列化 + CSS 类动态映射 |
| **模式** | 纯函数导出 (no state) |
| **行数** | ~50 行 |

**导出函数**：

```typescript
export function renderNodeOutput(node: {
  status: string
  nodeKind: string
  iteration?: number | null
  id: string
  output?: any
  error?: string
}): string {
  // 将节点数据序列化为可读的文本行
  // 示例: "✅ [plan] #1 实施方案 (2.5h) → ..."
}

export function tierClass(tier: string): string {
  // 模型 tier 映射到颜色样式
  // 示例: "basic" → "bg-slate-100 text-slate-600"
  //      "pro" → "bg-blue-100 text-blue-600"
}

export function kindClass(kind: string): string {
  // 节点 kind 映射到颜色
  // 示例: "plan" → "bg-purple-100 text-purple-600"
  //      "execute" → "bg-green-100 text-green-600"
}

export function diffClass(difficulty: string): string {
  // 难度映射到颜色
  // 示例: "easy" → "bg-emerald-100 text-emerald-600"
  //      "medium" → "bg-amber-100 text-amber-600"
  //      "hard" → "bg-rose-100 text-rose-600"
}
```

**使用位置**：

- Workflow.vue: `tierClass(m.tier)` / `kindClass(item.nodeKind)` / `diffClass(difficulty.value)` / `renderNodeOutput(d)`

---

### 2.2 client.ts (HTTP 客户端 / API 层)

| 属性 | 值 |
|---|---|
| **文件** | `frontend/src/api/client.ts` |
| **职责** | 后端 API 通信 + 类型定义 |
| **模式** | 对象导出 (singleton API 实例) + TypeScript interface |
| **行数** | ~100+ 行 |

**导出类型**：

```typescript
export interface CatalogModel {
  id: string
  displayName: string
  tier: string
  available?: boolean
}

export interface ProviderInfo {
  id: string
  displayName: string
  supported: boolean
  note?: string
}

export interface SkStatus {
  configured: boolean
  maskedKey?: string
  source?: "file" | "env"
  updatedAt?: string
}

export interface ValidateResult {
  valid: boolean
  detail: string
  identity?: {
    userEmail?: string
    apiKeyName?: string
  }
}
```

**导出 API 对象**：

```typescript
export const api = {
  async getModels(provider: string): Promise<{
    models: CatalogModel[]
    source: string
    note?: string
    routing?: Record<string, string>
  }> {
    // GET /api/config/models?provider={provider}
  }

  async listProviders(): Promise<{
    providers: ProviderInfo[]
  }> {
    // GET /api/config/providers
  }

  async getSkStatus(provider: string): Promise<SkStatus> {
    // GET /api/config/sk?provider={provider}
  }

  async saveSk(provider: string, apiKey: string): Promise<SkStatus> {
    // PUT /api/config/sk { provider, apiKey }
  }

  async validateSk(provider: string, apiKey?: string): Promise<ValidateResult> {
    // POST /api/config/sk/validate { provider, apiKey? }
  }

  async clearSk(provider: string): Promise<void> {
    // DELETE /api/config/sk?provider={provider}
  }
}
```

**使用位置**：

- Workflow.vue: `api.getModels(provider.value)`
- SkConfig.vue: `api.listProviders()` / `api.getSkStatus()` / `api.saveSk()` / `api.validateSk()` / `api.clearSk()`

---

## 三、复用组件库状态

| 组件库 | 状态 | 说明 |
|---|---|---|
| **内置基础组件** | ❌ 无 | 无预构建的 `components/base/*.vue` |
| **Headless UI** | ❌ 未装 | 无 Modal / Combobox / Popover |
| **Tailwind UI** | ❌ 未装 | 仅用原子类直接组装 |
| **Pinia (状态库)** | ❌ 未装 | 纯本地组件 state |
| **VueUse** | ❌ 未装 | 未使用工具函数库 |

---

## 四、全局配置与构建

### 4.1 tailwind.config.js

```javascript
export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {},  // ← 无自定义色值扩展
  },
  plugins: [],   // ← 无插件
}
```

**特点**：完全依赖 Tailwind 默认调色板和主题

### 4.2 vite.config.ts / tsconfig.json

- ✅ Vue 3 + TypeScript 支持
- ✅ Path alias (可选)
- ✅ CSS / PostCSS 处理

---

## 五、依赖项清单

**package.json (前端部分)**：

```json
{
  "dependencies": {
    "vue": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^5.x",
    "@vitejs/plugin-vue": "^5.x",
    "tailwindcss": "^3.x",
    "postcss": "^8.x",
    "autoprefixer": "^10.x"
  }
}
```

**无以下包**：

- ❌ `@headlessui/vue`
- ❌ `@vueuse/core`
- ❌ `pinia`
- ❌ `vue-router` (tab-based 路由代替)
- ❌ `@tailwindui/*`
- ❌ `vitest` / `@vue/test-utils` (暂无单元测试)

---

## 六、代码指标总结

| 指标 | 值 |
|---|---|
| **总行数（.vue）** | ~620 行 |
| **总行数（.ts）** | ~150+ 行 |
| **组件数** | 3 个 (都是页面级) |
| **复用子组件** | 0 个 |
| **工具函数** | 4 个 (format.ts) |
| **API 方法** | 6 个 (client.ts) |
| **TypeScript 类型** | 6+ 个接口 |

---

## 七、关键约定与现状确认

### 7.1 命名约定

| 类型 | 约定 | 示例 |
|---|---|---|
| 组件文件 | PascalCase | `App.vue`, `Workflow.vue`, `SkConfig.vue` |
| 工具文件 | camelCase | `format.ts`, `client.ts` |
| 状态变量 | camelCase | `provider`, `requirement`, `showKey` |
| 函数 | camelCase | `loadModels()`, `startRun()` |
| CSS 类 | Tailwind 原子 | `bg-slate-50`, `border-slate-200` |

### 7.2 TypeScript 遵循

- ✅ `<script setup lang="ts">` 标准格式
- ✅ 显式类型标注 (refs / interfaces)
- ✅ Union type / Conditional type 合理使用
- ❌ 无严格模式特殊处理 (allowJs / skipLibCheck 默认)

### 7.3 Tailwind 使用现状

- ✅ 原子类直接组装（无自定义 @apply）
- ✅ 响应式前缀 (默认 md: / lg: 断点)
- ✅ Hover / Focus / Disabled 伪类
- ✅ Dark 前缀（暂不使用）

---

## 附录：快速查询表

| 需要找什么 | 查阅文件 |
|---|---|
| 全局布局 / 导航 | App.vue |
| 工作流 UI / 表单 / 流处理 | Workflow.vue |
| SK 管理 UI | SkConfig.vue |
| 样式函数 (tier / kind / difficulty) | format.ts |
| API 端点 / 类型 | client.ts |
| Tailwind 配置 | tailwind.config.js |
| TypeScript 配置 | tsconfig.json |
| Vue 构建配置 | vite.config.ts |

---

**冻结时间**：2026-06-16  
**下一步**：代码 lint 检查 + 视觉回归测试  
**Approval**: ✅ Development 确认
