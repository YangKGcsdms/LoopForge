# Task S9: 结果区状态完备化

## 📋 任务描述
完善结果区（WorkflowResults.vue）的五类状态呈现、自动滚动功能和错误处理机制

## ✅ 验收标准
- ✓ 五类状态均有明确呈现（空态/加载/运行中/完成/错误态）
- ✓ 长输出/多节点下自动滚动定位正确、性能可接受
- ✓ 错误态可读且不阻塞后续运行

## 📁 文件变更

### 修改的文件

#### 1. **WorkflowResults.vue** (300 行)
核心改进：

**状态管理**
- 新增 `currentStatus` 计算属性，实时根据状态值判定当前状态
  - `empty`: 初始空态，无任何运行记录
  - `error`: 有错误信息，显示错误详情区
  - `running`: 正在运行，显示运行中状态
  - `completed`: 已完成，显示完成统计

**五类状态呈现**
1. 空态（empty）
   - 显示空状态卡片，中间有图标和提示
   - 提示用户"在左侧表单中填写需求并点击运行按钮"
   
2. 加载态（隐含在 running 中）
   - 与运行中状态一致，显示"实时自驱运行"容器
   - 流式显示阶段、TODO、节点等动态内容
   
3. 运行中（running）
   - 左上显示"实时自驱运行"标题
   - 右上显示 StatusBadge，状态为 "running"，label 为 "运行中..."
   - 显示难度、路由、动态内容流
   
4. 完成（completed）
   - 左上显示"实时自驱运行"标题  
   - 右上显示 StatusBadge，状态为 "completed"，label 为 "已完成"
   - 显示最终统计卡片（拆出的 TODO 数和完成数）
   
5. 错误态（error）
   - 独立的错误显示卡片
   - 包含错误图标、错误标题、错误详情（whitespace-pre-wrap 保留格式）
   - 提示"错误已捕获，不会阻塞后续运行。请修改参数后重试。"

**自动滚动功能**
- 新增 `resultsContainer` ref，指向动态内容流容器
- 新增 `shouldAutoScroll` 状态，记录是否应该自动滚动
- `handleScroll` 方法：监听滚动事件，当用户滚动到底部附近（100px内）时启用自动滚动
- `onUpdated` 生命周期：当新内容添加时，自动滚动到底部
  - 使用 `nextTick()` 和 `requestAnimationFrame()` 确保 DOM 已更新
  - 设置 `scrollTop = scrollHeight` 实现滚动到底部
- 滚动容器: `max-height: 500px`，`overflow-y-auto`

**节点错误呈现**
- 错误节点卡片背景色改为 `bg-rose-50`，文本色改为 `text-rose-700`
- 错误节点的 tone 属性设为 `default`（不显示底色的卡片色调）
- 成功节点保持 `bg-slate-50` 和 `text-slate-700`

**性能优化**
- 使用 computed 属性缓存状态判断，避免重复计算
- 使用 ref 和 onUpdated 生命周期，只在必要时触发滚动
- 滚动容器使用最大高度限制，避免无限延伸

#### 2. **useRun.ts** (195+ 行)
错误处理增强：

**事件解析容错**
- 为每个 EventSource 事件监听器添加 try-catch
- 事件类型：difficulty, routing, phase, todos, node-end, done, error
- 解析失败时记录控制台错误，防止应用崩溃

**错误信息收集**
- done 事件解析失败时，设置 error.value = "无法解析完成状态"
- error 事件处理时，优先尝试 JSON 解析，失败则直接使用原始数据
- 确保错误信息始终可读

**不阻塞后续运行**
- 错误时仅设置 error.value 和 running.value = false
- 不清空 live.value，保留已显示的内容
- 用户可以修改参数后重新 startRun，错误自动清除

### 新创建的文件

#### **WorkflowResults.test.ts** (400+ 行)
全面的单元测试，覆盖：

**状态呈现测试**
- 空态：检查空状态提示
- 加载态：检查运行中内容显示
- 运行中：检查 running 状态徽章
- 完成态：检查已完成状态和统计数据
- 错误态：检查错误信息呈现和可读性
- 错误不阻塞：验证错误清除后可重新运行

**自动滚动测试**
- 滚动容器存在性检查
- 长输出自动滚动到最新
- 多节点（50个）性能测试（< 1000ms）
- 用户手动滚动后停止自动滚动

**错误处理测试**
- 错误信息可读性
- 错误样式（bg-rose-50）检查
- 错误恢复流程

**节点错误呈现**
- 错误节点样式区分
- 成功节点样式对比

**完整流程测试**
- 从空态 -> 运行中 -> 完成的完整状态流转

## 🔄 状态流转图

```
[初始化] 
  ↓
[empty 空态] ← (live.length === 0 && !running && !error && !finalDone)
  ↓ (点击运行)
[running 运行中] ← (running === true)
  ├─ 显示实时自驱运行容器
  ├─ 流式显示阶段、TODO、节点
  └─ 自动滚动到最新内容
  ↓ (运行完成)
[completed 完成] ← (finalDone !== null && !running)
  ├─ 显示"已完成"状态徽章
  └─ 显示最终统计卡片
  
[error 错误态] ← (error.value !== "")
  ├─ 显示错误详情卡片
  ├─ 提示不阻塞后续运行
  └─ 用户修改参数后可重新运行 → [empty] → [running]
```

## 🎨 自动滚动实现细节

### 滚动触发条件
1. **初始化**：`shouldAutoScroll.value = true`
2. **新内容添加**：`onUpdated` 生命周期触发滚动
3. **用户滚动停止**：检查距底部距离
   - 距底部 < 100px → `shouldAutoScroll = true`
   - 距底部 ≥ 100px → `shouldAutoScroll = false`

### 滚动实现
```javascript
onUpdated(async () => {
  if (!shouldAutoScroll.value || !resultsContainer.value) return;
  await nextTick();
  const el = resultsContainer.value;
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;  // 滚动到底部
  });
});
```

### 性能考虑
- 使用 `requestAnimationFrame` 避免阻塞主线程
- `max-height: 500px` 限制 DOM 高度
- 只在 `shouldAutoScroll = true` 时执行滚动

## 🧪 测试覆盖

### WorkflowResults.test.ts
- 6 个状态呈现测试
- 4 个自动滚动测试（含 50 节点性能测试）
- 3 个错误处理测试
- 1 个节点错误呈现测试
- 1 个完整流程测试
- **总计：15 个测试用例**

### 现有测试保持兼容
- useRun.test.ts：3 个测试（初始化、cleanup、startRun 重置）
- Workflow.test.ts：6 个测试（组件结构、props 消费、完整流程）

## 📊 代码统计

| 文件 | 行数 | 说明 |
|------|------|------|
| WorkflowResults.vue | 300 | 五类状态、自动滚动、错误呈现 |
| useRun.ts | 195+ | 错误处理增强 |
| WorkflowResults.test.ts | 400+ | 全面的单元测试 |

## ✨ 核心特性

### 1. 完整的状态呈现
- 每种状态都有明确的视觉和交互反馈
- 状态转换清晰可追踪
- 用户始终知道系统在做什么

### 2. 智能自动滚动
- 自动定位最新内容
- 尊重用户的手动滚动
- 性能优化，支持大量节点

### 3. 可靠的错误处理
- 错误不阻塞后续运行
- 错误信息完整可读
- 支持快速重试

### 4. 用户友好的设计
- 清晰的视觉反馈
- 直观的交互流程
- 易于理解的错误提示

## 🔍 验证清单

### 代码实现
- [x] WorkflowResults.vue 支持五类状态
- [x] 自动滚动功能完整实现
- [x] 错误处理增强
- [x] 节点错误样式区分
- [x] useRun.ts 容错处理
- [x] 完整的测试覆盖

### 验收标准
- [x] 五类状态均有明确呈现
- [x] 长输出自动滚动正确（tested with 50 nodes）
- [x] 多节点性能可接受（< 1000ms）
- [x] 错误态可读且不阻塞

## 📝 使用示例

### 状态转换
```vue
<!-- 初始化 -->
<WorkflowResults :useRunState="runState" />
<!-- 显示：等待运行 -->

<!-- 点击运行后 -->
runState.running.value = true
<!-- 显示：实时自驱运行 + running 状态徽章 -->

<!-- 运行完成 -->
runState.finalDone.value = { todos: 5, developed: 3, ... }
<!-- 显示：已完成 + 统计卡片 -->

<!-- 出错时 -->
runState.error.value = "API 错误"
<!-- 显示：错误详情卡片 -->

<!-- 修改参数并重新运行 -->
runState.error.value = ""
runState.running.value = true
<!-- 显示：实时自驱运行（新一轮） -->
```

### 自动滚动行为
```
[用户查看顶部内容]
  ↓
[新节点被添加到底部]
  ↓
[距底部 > 100px] 
  → shouldAutoScroll = false
  → 不自动滚动（尊重用户意图）
  
[用户滚动到底部]
  ↓
[距底部 < 100px]
  → shouldAutoScroll = true
  → 再有新内容时自动滚动
```

## 🚀 后续优化方向

1. **虚拟滚动**：超大数据量时使用虚拟滚动
2. **内容搜索**：添加结果区搜索功能
3. **导出/保存**：支持导出运行日志
4. **网络恢复**：增强网络中断恢复机制
5. **性能指标**：显示运行耗时和资源使用情况
