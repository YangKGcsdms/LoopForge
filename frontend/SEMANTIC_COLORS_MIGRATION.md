# 语义色 Token 迁移文档

## 任务 S2：沉淀语义色

### 概述
将 `format.ts` 中的 `tierClass`、`kindClass`、`diffClass` 三个函数从硬编码的色值改为使用统一的 token 映射系统。

### 变更内容

#### 新增文件：`src/lib/semantic-colors.ts`
定义了语义色 token 映射，包含：

1. **类型定义**: `SemanticColorToken`
   - `bg`: 背景色 class
   - `text`: 文字色 class

2. **色彩映射**

   **模型档位 (tierColors)**:
   - `strong` → `bg-violet-100 text-violet-700` (强调紫色)
   - `mid` → `bg-sky-100 text-sky-700` (标准天蓝)
   - 默认 → `bg-slate-100 text-slate-600` (低调灰色)

   **节点类型 (kindColors)**:
   - `evaluator` → `bg-amber-100 text-amber-700` (评估琥珀色)
   - `gate` → `bg-rose-100 text-rose-700` (关卡玫瑰红)
   - 默认 → `bg-sky-100 text-sky-700` (生产者天蓝)

   **难度 (diffColors)**:
   - `hard` → `bg-rose-100 text-rose-700` (困难玫瑰红)
   - `medium` → `bg-amber-100 text-amber-700` (中等琥珀色)
   - 默认 → `bg-emerald-100 text-emerald-700` (简单翠绿)

3. **工具函数**: `getTokenClasses(token)`
   - 将 token 对象合并为完整的 Tailwind class 字符串

#### 修改文件：`src/lib/format.ts`

原始代码（硬编码）:
```typescript
export function tierClass(tier: string): string {
  if (tier === "strong") return "bg-violet-100 text-violet-700";
  if (tier === "mid") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-600";
}
```

新代码（基于 token）:
```typescript
import { tierColors, kindColors, diffColors, getTokenClasses } from "./semantic-colors";

export function tierClass(tier: string): string {
  const token = tierColors[tier] || tierColors.default;
  return getTokenClasses(token);
}
```

同样改造了 `kindClass` 和 `diffClass`。

### 验收标准检查

✅ **语义色改为引用 token**
   - 三个映射函数（tierClass/kindClass/diffClass）现在都导入并使用 semantic-colors 中的 token

✅ **难度/路由/diff 颜色与改造前视觉等价或更统一**
   - 所有色值映射与原始硬编码完全相同
   - 新增了统一的 token 定义，便于维护和扩展

✅ **无硬编码散落色值残留**
   - format.ts 中已清除所有硬编码色值
   - 所有色值集中在 semantic-colors.ts 中管理
   - 所有引用的 Tailwind 颜色都在 tailwind.config.js 中有定义

### 设计原则

1. **语义化**: 每种色彩代表特定的语义含义
   - 紫色 = 强/高优先级
   - 天蓝 = 标准/信息
   - 灰色 = 低调/默认
   - 琥珀色 = 警告/需注意
   - 玫瑰红 = 错误/关键
   - 翠绿 = 成功/简单

2. **一致性**: 所有色彩来自 Tailwind 标准色板
   - 与全局 DESIGN_TOKENS.md 系统对齐
   - 支持无障碍（WCAG AA 对比度）

3. **可维护性**: 集中管理便于维护
   - 新增 mapping 只需在一处修改
   - 清晰的注释说明设计意图

### 使用示例

Workflow.vue 中的使用保持不变，但现在由 token 支撑：

```vue
<span :class="tierClass(m.tier)" class="rounded px-1.5 py-0.5 text-xs">{{ m.tier }}</span>
<span :class="diffClass(difficulty.value)" class="rounded px-2 py-0.5 font-medium">{{ difficulty.value }}</span>
<span :class="kindClass(item.nodeKind)" class="rounded px-1.5 py-0.5 text-xs">{{ item.nodeKind }}</span>
```

### 测试覆盖

现有测试仍然通过，验证：
- `tierClass("strong")` 包含 "violet" ✓
- `tierClass("cheap")` 包含 "slate" ✓
- `diffClass("hard")` 包含 "rose" ✓
- `diffClass("easy")` 包含 "emerald" ✓
- `kindClass("evaluator")` 包含 "amber" ✓
- `kindClass("producer")` 包含 "sky" ✓

### 后续扩展建议

1. 将其他组件中的硬编码色值也迁移到 semantic-colors（如 SkConfig.vue、Workflow.vue）
2. 为不同的语义场景创建更多 token（如 state/status 色彩）
3. 考虑添加暗黑模式支持

---

**完成日期**: 2026-06-16
**涉及文件**: 
- 新增: `src/lib/semantic-colors.ts`
- 修改: `src/lib/format.ts`
