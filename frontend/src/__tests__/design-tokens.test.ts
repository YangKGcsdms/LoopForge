import { describe, it, expect } from "node:test";
import fs from "fs";
import path from "path";

describe("Design Token System", () => {
  it("should have tailwind config with complete colors, spacing, radius, shadows, and typography", () => {
    const configPath = path.join(__dirname, "../tailwind.config.js");
    const configContent = fs.readFileSync(configPath, "utf-8");

    // 检查关键 token 类别
    expect(configContent).toContain("colors:");
    expect(configContent).toContain("spacing:");
    expect(configContent).toContain("borderRadius:");
    expect(configContent).toContain("boxShadow:");
    expect(configContent).toContain("fontSize:");
    expect(configContent).toContain("fontFamily:");

    // 检查主色调存在
    expect(configContent).toContain("slate:");
    expect(configContent).toContain("violet:");
    expect(configContent).toContain("emerald:");
    expect(configContent).toContain("amber:");
    expect(configContent).toContain("rose:");
    expect(configContent).toContain("sky:");
    expect(configContent).toContain("indigo:");
  });

  it("should have global baseline in style.css", () => {
    const stylePath = path.join(__dirname, "../style.css");
    const styleContent = fs.readFileSync(stylePath, "utf-8");

    // Tailwind 层级
    expect(styleContent).toContain("@tailwind base");
    expect(styleContent).toContain("@tailwind components");
    expect(styleContent).toContain("@tailwind utilities");

    // 全局基线层
    expect(styleContent).toContain("@layer base");
    expect(styleContent).toContain("@layer components");

    // 关键元素样式
    expect(styleContent).toContain("body");
    expect(styleContent).toContain("h1");
    expect(styleContent).toContain("h2");
    expect(styleContent).toContain("p");
    expect(styleContent).toContain("input");
    expect(styleContent).toContain("textarea");
    expect(styleContent).toContain("select");

    // 焦点态
    expect(styleContent).toContain("focus");
    expect(styleContent).toContain("focus-ring");

    // 组件 CSS
    expect(styleContent).toContain(".card");
    expect(styleContent).toContain(".alert");
    expect(styleContent).toContain(".badge");
    expect(styleContent).toContain(".btn");
  });

  it("should have complete design token documentation", () => {
    const docPath = path.join(__dirname, "../DESIGN_TOKENS.md");
    expect(fs.existsSync(docPath)).toBe(true);

    const docContent = fs.readFileSync(docPath, "utf-8");

    // 主要章节
    expect(docContent).toContain("## 颜色系统");
    expect(docContent).toContain("## 间距系统");
    expect(docContent).toContain("## 圆角系统");
    expect(docContent).toContain("## 阴影系统");
    expect(docContent).toContain("## 字体系统");
    expect(docContent).toContain("## 无障碍");

    // 示例代码
    expect(docContent).toContain("```");
    expect(docContent).toContain("```vue");
  });

  it("should not break existing pages with new tokens", () => {
    const appPath = path.join(__dirname, "../App.vue");
    const appContent = fs.readFileSync(appPath, "utf-8");

    // 验证现有页面仍然使用 Tailwind token 样式
    expect(appContent).toContain("class");
    expect(appContent).toMatch(/bg-slate-|text-slate-|border-slate-|rounded-/);
  });

  it("should have valid CSS in style.css", () => {
    const stylePath = path.join(__dirname, "../style.css");
    const styleContent = fs.readFileSync(stylePath, "utf-8");

    // 检查没有明显的语法错误（无匹配的括号）
    const openBraces = (styleContent.match(/{/g) || []).length;
    const closeBraces = (styleContent.match(/}/g) || []).length;

    expect(openBraces).toBe(closeBraces);
  });
});
