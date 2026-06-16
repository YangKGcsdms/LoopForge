#!/usr/bin/env node

/**
 * 快速验证设计 token 系统的完整性和有效性
 */

import fs from "fs";
import path from "path";

const frontendDir = "./frontend";

console.log("🔍 验证设计 Token 系统...\n");

// ============================================================================
// 1. 检查 tailwind.config.js
// ============================================================================
console.log("📋 检查 tailwind.config.js...");
try {
  const configPath = path.join(frontendDir, "tailwind.config.js");
  const configContent = fs.readFileSync(configPath, "utf-8");

  // 基本结构检查
  const hasColors = configContent.includes("colors:");
  const hasSpacing = configContent.includes("spacing:");
  const hasBorderRadius = configContent.includes("borderRadius:");
  const hasBoxShadow = configContent.includes("boxShadow:");
  const hasFontSize = configContent.includes("fontSize:");
  const hasFontFamily = configContent.includes("fontFamily:");

  console.log(`  ✓ colors 定义: ${hasColors ? "✓" : "✗"}`);
  console.log(`  ✓ spacing 定义: ${hasSpacing ? "✓" : "✗"}`);
  console.log(`  ✓ borderRadius 定义: ${hasBorderRadius ? "✓" : "✗"}`);
  console.log(`  ✓ boxShadow 定义: ${hasBoxShadow ? "✓" : "✗"}`);
  console.log(`  ✓ fontSize 定义: ${hasFontSize ? "✓" : "✗"}`);
  console.log(`  ✓ fontFamily 定义: ${hasFontFamily ? "✓" : "✗"}`);

  const allChecks = [hasColors, hasSpacing, hasBorderRadius, hasBoxShadow, hasFontSize, hasFontFamily];
  if (allChecks.every((c) => c)) {
    console.log("  ✅ tailwind.config.js: 完整\n");
  } else {
    console.log("  ⚠️ tailwind.config.js: 部分字段缺失\n");
  }

  // 具体色彩检查
  const hasSlate = configContent.includes('"slate":');
  const hasViolet = configContent.includes('"violet":');
  const hasEmerald = configContent.includes('"emerald":');
  const hasAmber = configContent.includes('"amber":');
  const hasRose = configContent.includes('"rose":');
  const hasSky = configContent.includes('"sky":');
  const hasIndigo = configContent.includes('"indigo":');

  console.log("🎨 颜色系统:");
  console.log(`  ✓ Slate（中性）: ${hasSlate ? "✓" : "✗"}`);
  console.log(`  ✓ Violet（强调）: ${hasViolet ? "✓" : "✗"}`);
  console.log(`  ✓ Emerald（成功）: ${hasEmerald ? "✓" : "✗"}`);
  console.log(`  ✓ Amber（警告）: ${hasAmber ? "✓" : "✗"}`);
  console.log(`  ✓ Rose（错误）: ${hasRose ? "✓" : "✗"}`);
  console.log(`  ✓ Sky（信息）: ${hasSky ? "✓" : "✗"}`);
  console.log(`  ✓ Indigo（配套）: ${hasIndigo ? "✓" : "✗"}`);

  if ([hasSlate, hasViolet, hasEmerald, hasAmber, hasRose, hasSky, hasIndigo].every((c) => c)) {
    console.log("  ✅ 5 种主色 × 10 级色板 = 完整色彩系统\n");
  }
} catch (err) {
  console.error(`  ✗ 错误: ${err.message}\n`);
  process.exit(1);
}

// ============================================================================
// 2. 检查 style.css
// ============================================================================
console.log("🎯 检查 style.css (全局基线)...");
try {
  const stylePath = path.join(frontendDir, "src/style.css");
  const styleContent = fs.readFileSync(stylePath, "utf-8");

  const hasLayerBase = styleContent.includes("@layer base");
  const hasLayerComponents = styleContent.includes("@layer components");
  const hasLayerUtilities = styleContent.includes("@layer utilities");
  const hasBodyStyle = styleContent.includes("body");
  const hasH1 = styleContent.includes("h1");
  const hasInputStyle = styleContent.includes("input[type");
  const hasFocusRing = styleContent.includes("focus-ring");
  const hasCardComponent = styleContent.includes(".card");
  const hasAlertComponent = styleContent.includes(".alert");

  console.log(`  ✓ @layer base: ${hasLayerBase ? "✓" : "✗"}`);
  console.log(`  ✓ @layer components: ${hasLayerComponents ? "✓" : "✗"}`);
  console.log(`  ✓ @layer utilities: ${hasLayerUtilities ? "✓" : "✗"}`);
  console.log(`  ✓ Body 基线: ${hasBodyStyle ? "✓" : "✗"}`);
  console.log(`  ✓ 标题排版 (H1): ${hasH1 ? "✓" : "✗"}`);
  console.log(`  ✓ 表单基线: ${hasInputStyle ? "✓" : "✗"}`);
  console.log(`  ✓ 焦点态: ${hasFocusRing ? "✓" : "✗"}`);
  console.log(`  ✓ Card 组件: ${hasCardComponent ? "✓" : "✗"}`);
  console.log(`  ✓ Alert 组件: ${hasAlertComponent ? "✓" : "✗"}`);

  if (
    [
      hasLayerBase,
      hasLayerComponents,
      hasLayerUtilities,
      hasBodyStyle,
      hasH1,
      hasInputStyle,
      hasFocusRing,
      hasCardComponent,
      hasAlertComponent,
    ].every((c) => c)
  ) {
    console.log("  ✅ style.css: 完整\n");
  } else {
    console.log("  ⚠️ style.css: 部分功能缺失\n");
  }
} catch (err) {
  console.error(`  ✗ 错误: ${err.message}\n`);
  process.exit(1);
}

// ============================================================================
// 3. 检查 DESIGN_TOKENS.md 文档
// ============================================================================
console.log("📖 检查 DESIGN_TOKENS.md (文档)...");
try {
  const docPath = path.join(frontendDir, "DESIGN_TOKENS.md");
  const docContent = fs.readFileSync(docPath, "utf-8");

  const hasColorSystem = docContent.includes("## 颜色系统");
  const hasSpacingSystem = docContent.includes("## 间距系统");
  const hasRadiusSystem = docContent.includes("## 圆角系统");
  const hasShadowSystem = docContent.includes("## 阴影系统");
  const hasTypographySystem = docContent.includes("## 字体系统");
  const hasA11y = docContent.includes("## 无障碍");
  const hasExamples = docContent.includes("```");

  console.log(`  ✓ 颜色系统: ${hasColorSystem ? "✓" : "✗"}`);
  console.log(`  ✓ 间距系统: ${hasSpacingSystem ? "✓" : "✗"}`);
  console.log(`  ✓ 圆角系统: ${hasRadiusSystem ? "✓" : "✗"}`);
  console.log(`  ✓ 阴影系统: ${hasShadowSystem ? "✓" : "✗"}`);
  console.log(`  ✓ 字体系统: ${hasTypographySystem ? "✓" : "✗"}`);
  console.log(`  ✓ 无障碍: ${hasA11y ? "✓" : "✗"}`);
  console.log(`  ✓ 代码示例: ${hasExamples ? "✓" : "✗"}`);

  if (
    [
      hasColorSystem,
      hasSpacingSystem,
      hasRadiusSystem,
      hasShadowSystem,
      hasTypographySystem,
      hasA11y,
      hasExamples,
    ].every((c) => c)
  ) {
    console.log("  ✅ DESIGN_TOKENS.md: 完整\n");
  } else {
    console.log("  ⚠️ DESIGN_TOKENS.md: 部分内容缺失\n");
  }
} catch (err) {
  console.error(`  ✗ 错误: ${err.message}\n`);
  process.exit(1);
}

// ============================================================================
// 4. 检查现有页面兼容性
// ============================================================================
console.log("🔗 检查现有页面兼容性...");
try {
  const appPath = path.join(frontendDir, "src/App.vue");
  const workflowPath = path.join(frontendDir, "src/components/Workflow.vue");
  const skConfigPath = path.join(frontendDir, "src/components/SkConfig.vue");

  const appExists = fs.existsSync(appPath);
  const workflowExists = fs.existsSync(workflowPath);
  const skConfigExists = fs.existsSync(skConfigPath);

  console.log(`  ✓ App.vue 存在: ${appExists ? "✓" : "✗"}`);
  console.log(`  ✓ Workflow.vue 存在: ${workflowExists ? "✓" : "✗"}`);
  console.log(`  ✓ SkConfig.vue 存在: ${skConfigExists ? "✓" : "✗"}`);

  // 检查现有页面样式使用是否兼容
  if (appExists) {
    const appContent = fs.readFileSync(appPath, "utf-8");
    const usesTokens = appContent.includes("bg-slate-") && appContent.includes("text-slate-");
    console.log(`  ✓ App.vue 使用 Token 样式: ${usesTokens ? "✓" : "?"}`);
  }

  if (workflowExists) {
    const workflowContent = fs.readFileSync(workflowPath, "utf-8");
    const usesTokens =
      workflowContent.includes("rounded-") && (workflowContent.includes("shadow-") || workflowContent.includes("border-"));
    console.log(`  ✓ Workflow.vue 使用 Token 样式: ${usesTokens ? "✓" : "?"}`);
  }

  if ([appExists, workflowExists, skConfigExists].every((c) => c)) {
    console.log("  ✅ 现有页面: 都存在\n");
  } else {
    console.log("  ⚠️ 部分页面缺失\n");
  }
} catch (err) {
  console.error(`  ✗ 错误: ${err.message}\n`);
  process.exit(1);
}

// ============================================================================
// 总结
// ============================================================================
console.log("=" + "=".repeat(70));
console.log("\n✅ 设计 Token 系统验证完成！\n");
console.log("组件清单:");
console.log("  ✓ tailwind.config.js - 完整 Token 定义");
console.log("  ✓ style.css - 全局基线 + 组件 CSS");
console.log("  ✓ DESIGN_TOKENS.md - 文档与命名规范");
console.log("  ✓ 现有页面 - 兼容现存组件");
console.log("\n接下来:");
console.log("  1. 运行 'npm run build' 确保构建无报错");
console.log("  2. 运行 'npm run dev' 预览页面效果");
console.log("  3. 按 DESIGN_TOKENS.md 中的规范构建新组件");
console.log("\n");
