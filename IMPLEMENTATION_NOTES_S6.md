# Task S6: Workflow.vue 拆分实现总结

## 📋 任务描述
拆分 Workflow.vue：抽出左栏运行表单(provider/requirement/goal/dryRun)与右栏结果容器

## ✅ 验收标准
- ✓ 运行表单成为独立左栏配置组件
- ✓ 结果展示成为独立右栏容器
- ✓ 均消费 useRun
- ✓ 拆分后流式渲染与 difficulty/routing/todos/节点卡片渲染正常

## 📁 文件变更

### 新创建的文件
1. **WorkflowForm.vue** (142 行)
   - 独立的左栏表单组件
   - 包含：provider 选择器、requirement textarea、goal 输入框、cwd 输入框、dryRun checkbox、运行按钮
   - 路由池显示（跟随所选引擎）
   - Props: useRunState (UseRunState & UseRunActions)
   - 消费 useRun 状态：running, error, startRun
   - onMounted 时加载模型列表

2. **WorkflowResults.vue** (76 行)
   - 独立的右栏结果容器组件
   - 包含：难度显示、路由方案、TODO 列表、节点卡片（打字机效果）、最终完成状态
   - Props: useRunState (UseRunState)
   - 消费 useRun 状态：difficulty, routing, live, finalDone
   - 流式渲染支持：
     - 阶段头分隔符
     - TODO 列表卡片
     - 节点卡片（含迭代轮数、状态、打字机效果）

3. **Workflow.test.ts** (200 行)
   - 测试 Workflow 主组件
   - 测试 WorkflowForm 组件
   - 测试 WorkflowResults 组件
   - 测试 useRun 状态消费
   - 测试生命周期清理

### 修改的文件
1. **Workflow.vue** (25 行 → 原先 203 行)
   - 删除：所有表单逻辑、所有结果渲染逻辑
   - 保留：useRun 调用、cleanup 生命周期
   - 添加：导入 WorkflowForm 和 WorkflowResults
   - 添加：左右二列网格布局 (`lg:grid-cols-2`)
   - 添加：传递 runState 给子组件

## 🔄 数据流动

```
Workflow (根组件)
├─ useRun() → runState
│  ├─ running: Ref<boolean>
│  ├─ error: Ref<string>
│  ├─ live: Ref<LiveItem[]>
│  ├─ difficulty: Ref<{value, reason} | null>
│  ├─ routing: Ref<{plan, execute, review, test} | null>
│  ├─ finalDone: Ref<{todos, developed} | null>
│  ├─ startRun(params): void
│  └─ cleanup(): void
│
├─ WorkflowForm (左栏)
│  ├─ Props: useRunState
│  ├─ 本地状态：provider, requirement, goal, cwd, dryRun, models
│  └─ 调用：useRunState.startRun()
│
└─ WorkflowResults (右栏)
   ├─ Props: useRunState
   └─ 读取状态：difficulty, routing, live, finalDone
```

## 🎨 布局结构

### Workflow 主组件
```html
<div class="grid gap-6 lg:grid-cols-2">
  <!-- 左栏 -->
  <div class="min-h-screen">
    <WorkflowForm :use-run-state="runState" />
  </div>
  
  <!-- 右栏 -->
  <div class="min-h-screen">
    <WorkflowResults :use-run-state="runState" />
  </div>
</div>
```

### 响应式
- 移动端：单列堆叠
- 桌面端 (lg)：两列并列

## 🔧 技术细节

### WorkflowForm
- 异步加载模型列表 (loadModels)
- 组件挂载时自动加载初始模型
- 调用 handleStartRun 时，传递所有参数给 useRunState.startRun
- 错误处理：显示加载失败提示

### WorkflowResults
- 通过 `v-if="item.kind === 'xxx'"` 做条件渲染
- 流式渲染支持：
  - PhaseItem: 阶段分隔符
  - TodosItem: TODO 列表
  - NodeItem: 节点卡片（含打字机效果）
- 最终状态：显示 TODO 总数和完成数
- 类型安全：使用 `(item as any)` 处理 TypeScript 联合类型歧义

### Workflow 主组件
- 调用 useRun() 获取完整状态和方法
- 在 onUnmounted 时调用 cleanup() 关闭 EventSource
- Props 传递：useRunState 同时包含状态和操作方法

## 🧪 测试覆盖

### Workflow.test.ts
1. Workflow 组件渲染测试
   - 检查网格布局 (lg:grid-cols-2)
   - 检查 WorkflowForm 和 WorkflowResults 存在

2. WorkflowForm 测试
   - 检查需求、目标、dryRun 输入元素
   - 检查"评估并自驱运行"按钮存在
   - 检查 useRunState 正确消费

3. WorkflowResults 测试
   - 检查难度显示
   - 检查路由显示
   - 检查 TODO 列表渲染
   - 检查节点卡片渲染
   - 检查最终完成状态

4. 生命周期测试
   - 卸载时清理资源

## 📊 代码统计

| 组件 | 行数 | 职责 |
|------|------|------|
| Workflow.vue | 25 | 组织主布局，使用 useRun |
| WorkflowForm.vue | 142 | 左栏表单配置 |
| WorkflowResults.vue | 76 | 右栏结果展示 |
| Workflow.test.ts | 200 | 单元测试 |

## ✨ 关键特性

1. **完整的状态管理**
   - 两个子组件共享 useRun 返回的状态
   - WorkflowForm 触发 startRun
   - WorkflowResults 实时展示结果

2. **流式渲染支持**
   - EventSource 推送的事件被 useRun 处理
   - useRun 维护 live 数组（包含 phase、todos、node）
   - WorkflowResults 遍历 live 数组，流式展示

3. **类型安全**
   - Props 使用 TypeScript 接口定义
   - useRunState 类型完整
   - 合理使用类型转换 (as any) 处理联合类型

4. **响应式布局**
   - 使用 Tailwind Grid
   - 移动端友好
   - 自适应列宽

5. **生命周期管理**
   - Workflow 负责 cleanup
   - EventSource 在卸载时关闭
   - 避免内存泄漏

## 🔍 验证清单

- [x] 所有三个文件都创建成功
- [x] Workflow.vue 导入并使用 WorkflowForm 和 WorkflowResults
- [x] WorkflowForm 包含所有输入控件和表单逻辑
- [x] WorkflowResults 包含所有展示逻辑
- [x] 两个组件都正确消费 useRunState
- [x] 使用了二列网格布局
- [x] 创建了对应的测试文件
- [x] 没有破坏现有的 App.vue 使用方式
- [x] 类型定义正确
- [x] Props 接口完整

## 📝 使用方式

```vue
<!-- 在 App.vue 中使用，无需改动 -->
<Workflow v-if="tab === 'workflow'" />
```

Workflow 内部自动：
1. 创建 useRun 实例
2. 将表单逻辑分离到 WorkflowForm
3. 将结果展示分离到 WorkflowResults
4. 在卸载时清理资源
