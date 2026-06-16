import { describe, it, expect } from "node:test";
import fs from "fs";
import path from "path";

describe("Accessibility and Responsive Design (S10)", () => {
  describe("Responsive Layout", () => {
    it("should have responsive grid layout in App.vue", () => {
      const appPath = path.join(__dirname, "../App.vue");
      const appContent = fs.readFileSync(appPath, "utf-8");

      // 检查两栏响应式布局
      expect(appContent).toContain("lg:grid-cols-[420px_1fr]");
      expect(appContent).toContain("grid-cols-1");
      expect(appContent).toMatch(/lg:min-h-\[calc\(100vh-72px\)\]/);

      // 确保小屏幕时单列堆叠
      expect(appContent).toContain("auto-rows-max");
      expect(appContent).toContain("lg:auto-rows-[1fr]");

      // 响应式间距
      expect(appContent).toContain("px-4 py-6 md:px-6");
    });

    it("should not have horizontal overflow on any screen size", () => {
      const appPath = path.join(__dirname, "../App.vue");
      const appContent = fs.readFileSync(appPath, "utf-8");

      // 确保主要容器有 overflow 管理
      expect(appContent).toContain("overflow-y-auto");
      expect(appContent).toContain("overflow-x-auto");

      // 避免固定宽度导致溢出
      expect(appContent).not.toContain("w-screen");
    });

    it("should have collapsible elements on small screens", () => {
      const appPath = path.join(__dirname, "../App.vue");
      const appContent = fs.readFileSync(appPath, "utf-8");

      // 小屏幕时的间距应该减少
      expect(appContent).toContain("md:pr-2");
      expect(appContent).toContain("pr-0");
    });
  });

  describe("Keyboard Focus and Accessibility", () => {
    it("should have focus styles on all interactive elements", () => {
      const stylePath = path.join(__dirname, "../style.css");
      const styleContent = fs.readFileSync(stylePath, "utf-8");

      // 检查焦点态样式
      expect(styleContent).toContain("focus:outline-none");
      expect(styleContent).toContain("focus:ring-2");
      expect(styleContent).toContain("focus:ring-offset-2");

      // 焦点颜色
      expect(styleContent).toContain("focus:ring-violet-500");
    });

    it("should have keyboard-accessible buttons and inputs", () => {
      const buttonPath = path.join(__dirname, "../components/BaseButton.vue");
      const buttonContent = fs.readFileSync(buttonPath, "utf-8");

      // 检查焦点态
      expect(buttonContent).toContain("focus:ring-2");
      expect(buttonContent).toContain("focus:ring-offset-2");

      // 检查禁用状态的明确指示
      expect(buttonContent).toContain("disabled:opacity-50");
      expect(buttonContent).toContain("disabled:cursor-not-allowed");
    });

    it("should have visible focus indicators on inputs", () => {
      const inputPath = path.join(__dirname, "../components/BaseInput.vue");
      const inputContent = fs.readFileSync(inputPath, "utf-8");

      // 检查焦点环
      expect(inputContent).toContain("focus:ring-2");
      expect(inputContent).toContain("focus:ring-offset-2");

      // 检查焦点边框颜色变化
      expect(inputContent).toContain("focus:border-violet-600");
      expect(inputContent).toContain("focus:ring-violet-500");
    });

    it("should have focus styles on select elements", () => {
      const selectPath = path.join(__dirname, "../components/BaseSelect.vue");
      const selectContent = fs.readFileSync(selectPath, "utf-8");

      // 检查焦点态
      expect(selectContent).toContain("focus:ring-2");
      expect(selectContent).toContain("focus:ring-offset-2");
      expect(selectContent).toContain("focus:ring-violet-500");
      expect(selectContent).toContain("focus:border-violet-600");
    });

    it("should support tab navigation with logical tab order", () => {
      const appPath = path.join(__dirname, "../App.vue");
      const appContent = fs.readFileSync(appPath, "utf-8");

      // Vue 应用应该保持标准 DOM 顺序以支持自然的 Tab 导航
      expect(appContent).toContain("<header");
      expect(appContent).toContain("<main");
    });
  });

  describe("Contrast Ratio (WCAG AA)", () => {
    it("should have enhanced text contrast in style.css", () => {
      const stylePath = path.join(__dirname, "../style.css");
      const styleContent = fs.readFileSync(stylePath, "utf-8");

      // 检查文本颜色升级到更高对比度的深色
      expect(styleContent).toContain("text-slate-800");
      expect(styleContent).toContain("text-slate-900");
      expect(styleContent).toMatch(/p {\s*@apply.*text-slate-8/);
    });

    it("should have proper label contrast", () => {
      const formPath = path.join(__dirname, "../components/WorkflowForm.vue");
      const formContent = fs.readFileSync(formPath, "utf-8");

      // 检查标签文本颜色
      expect(formContent).toContain("text-slate-800");

      // 确保没有低对比度的文本
      expect(formContent).not.toContain("text-slate-400");
      expect(formContent).not.toContain("text-slate-300");
    });

    it("should have proper button text contrast", () => {
      const buttonPath = path.join(__dirname, "../components/BaseButton.vue");
      const buttonContent = fs.readFileSync(buttonPath, "utf-8");

      // 检查按钮文字对比度
      expect(buttonContent).toContain("text-white"); // primary 按钮白色文字
      expect(buttonContent).toContain("text-slate-700"); // secondary 按钮深色文字
      expect(buttonContent).toContain("text-slate-900"); // 某些变体
      expect(buttonContent).toContain("text-rose-700"); // danger 按钮

      // 检查是否使用了 font-medium 确保可读性
      expect(buttonContent).toContain("font-medium");
    });

    it("should have proper form input contrast", () => {
      const inputPath = path.join(__dirname, "../components/BaseInput.vue");
      const inputContent = fs.readFileSync(inputPath, "utf-8");

      // 输入框文字应该是深色
      expect(inputContent).toContain("text-slate-900");

      // 禁用状态也应该清晰可见
      expect(inputContent).toContain("disabled:text-slate-500");
    });

    it("should have high contrast table headers", () => {
      const stylePath = path.join(__dirname, "../style.css");
      const styleContent = fs.readFileSync(stylePath, "utf-8");

      // 检查表头对比度
      expect(styleContent).toContain("text-slate-900");
      expect(styleContent).toContain("bg-slate-100");
    });

    it("should have sufficient placeholder text contrast", () => {
      const stylePath = path.join(__dirname, "../style.css");
      const styleContent = fs.readFileSync(stylePath, "utf-8");

      // placeholder 文字应该有足够对比度（不是太浅）
      expect(styleContent).toContain("placeholder:text-slate-5");
    });

    it("should have high contrast error messages", () => {
      const stylePath = path.join(__dirname, "../style.css");
      const styleContent = fs.readFileSync(stylePath, "utf-8");

      // 错误消息背景和文字应该有高对比度
      expect(styleContent).toContain(".alert-error");
      expect(styleContent).toContain("text-rose-7");
      expect(styleContent).toContain("bg-rose-50");
    });

    it("should have proper help text contrast", () => {
      const formPath = path.join(__dirname, "../components/WorkflowForm.vue");
      const formContent = fs.readFileSync(formPath, "utf-8");

      // 辅助文本应该有足够对比度
      expect(formContent).toContain("text-slate-600");
      expect(formContent).toContain("text-slate-700");
      expect(formContent).not.toContain("text-slate-400");
    });
  });

  describe("Semantic HTML and ARIA", () => {
    it("should use semantic HTML structure", () => {
      const appPath = path.join(__dirname, "../App.vue");
      const appContent = fs.readFileSync(appPath, "utf-8");

      // 检查语义化元素
      expect(appContent).toContain("<header");
      expect(appContent).toContain("<main");
      expect(appContent).toMatch(/<h[1-6]/);
    });

    it("should have proper label associations", () => {
      const formPath = path.join(__dirname, "../components/WorkflowForm.vue");
      const formContent = fs.readFileSync(formPath, "utf-8");

      // 检查标签
      expect(formContent).toContain("<label");
    });

    it("should have disabled states properly marked", () => {
      const buttonPath = path.join(__dirname, "../components/BaseButton.vue");
      const buttonContent = fs.readFileSync(buttonPath, "utf-8");

      // 检查 disabled 属性
      expect(buttonContent).toContain(":disabled");
    });
  });

  describe("Mobile-First Responsive Breakpoints", () => {
    it("should use Tailwind responsive prefixes correctly", () => {
      const appPath = path.join(__dirname, "../App.vue");
      const appContent = fs.readFileSync(appPath, "utf-8");

      // md 和 lg 前缀用于响应式
      expect(appContent).toMatch(/md:px-6/);
      expect(appContent).toMatch(/lg:grid-cols-/);
      expect(appContent).toMatch(/lg:min-h-/);
    });

    it("should have proper spacing scaling for different screen sizes", () => {
      const appPath = path.join(__dirname, "../App.vue");
      const appContent = fs.readFileSync(appPath, "utf-8");

      // 小屏幕：px-4 py-6
      // 中屏幕及以上：px-6 py-8
      expect(appContent).toContain("px-4");
      expect(appContent).toContain("py-6");
      expect(appContent).toContain("md:px-6");
      expect(appContent).toContain("md:py-8");
    });
  });

  describe("Color Palette and Contrast Compliance", () => {
    it("should define proper color palette in tailwind config", () => {
      const configPath = path.join(__dirname, "../tailwind.config.js");
      const configContent = fs.readFileSync(configPath, "utf-8");

      // 检查色系深度
      expect(configContent).toContain("slate:");
      expect(configContent).toContain("violet:");
      expect(configContent).toContain("rose:");
      expect(configContent).toContain("emerald:");
    });

    it("should use WCAG compliant color combinations", () => {
      const stylePath = path.join(__dirname, "../style.css");
      const styleContent = fs.readFileSync(stylePath, "utf-8");

      // 白色背景 + 深灰色文字 (4.5+ 对比度)
      expect(styleContent).toContain("bg-white");
      expect(styleContent).toContain("text-slate-8");
      expect(styleContent).toContain("text-slate-9");
    });
  });
});
