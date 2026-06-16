#!/bin/bash

# 验证响应式和可访问性改进

echo "=== 验证 S10：响应式降级与可访问性 ==="
echo ""

# 1. 检查 App.vue 的响应式布局
echo "✓ 检查 App.vue 响应式布局..."
if grep -q "lg:grid-cols-\[420px_1fr\]" src/App.vue && \
   grep -q "px-4 py-6 md:px-6 md:py-8" src/App.vue && \
   grep -q "auto-rows-max" src/App.vue; then
  echo "  ✓ 响应式布局配置正确"
else
  echo "  ✗ 响应式布局配置不完整"
fi

# 2. 检查焦点态
echo ""
echo "✓ 检查焦点态 (keyboard focus)..."
if grep -q "focus:ring-2 focus:ring-offset-2" src/style.css && \
   grep -q "focus:ring-violet-500" src/style.css && \
   grep -q "focus:border-violet-600" src/components/BaseInput.vue; then
  echo "  ✓ 焦点态样式正确"
else
  echo "  ✗ 焦点态样式不完整"
fi

# 3. 检查对比度（WCAG AA）
echo ""
echo "✓ 检查对比度合规 (WCAG AA)..."
if grep -q "text-slate-8" src/style.css && \
   grep -q "text-slate-9" src/style.css; then
  echo "  ✓ 文字对比度已升级"
else
  echo "  ✗ 对比度改进不足"
fi

# 4. 检查按钮焦点
if grep -q "focus:ring-violet-500" src/components/BaseButton.vue; then
  echo "  ✓ 按钮焦点态配置正确"
else
  echo "  ✗ 按钮焦点态配置不完整"
fi

# 5. 检查 Select 焦点
if grep -q "focus:ring-violet-500" src/components/BaseSelect.vue; then
  echo "  ✓ Select 焦点态配置正确"
else
  echo "  ✗ Select 焦点态配置不完整"
fi

# 6. 检查无溢出
echo ""
echo "✓ 检查无水平溢出..."
if grep -q "overflow-y-auto" src/App.vue && \
   ! grep -q "w-screen" src/App.vue; then
  echo "  ✓ 溢出管理正确"
else
  echo "  ✗ 溢出管理不完整"
fi

# 7. 检查语义化
echo ""
echo "✓ 检查语义化 HTML..."
if grep -q "<header" src/App.vue && \
   grep -q "<main" src/App.vue; then
  echo "  ✓ 语义化 HTML 结构正确"
else
  echo "  ✗ 语义化 HTML 不完整"
fi

echo ""
echo "=== 验证完成 ==="
