/**
 * 单元任务定义（纯模块，不碰 SDK）—— 每个任务 = 一个具体小开发任务 + 一把确定性关令。
 *
 * 关令一律判**地面真值**：真读产物文件、做确定性结构/行为检查，不看模型自报。
 * 本模块可被 hermetic 单测安全导入（无 LLM 副作用）；真跑的执行器在 unit-live.ts。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Gate, UnitArtifact } from "./unit.js";

export interface TaskDef {
  /** 单元任务编号，做 output 目录前缀（如 U003-site）。 */
  code: string;
  /** 主产物文件名（执行器快照 + 关令读取的目标）。 */
  file: string;
  /** 首轮输入（开发任务描述）。 */
  prompt: string;
  /** 单元内最大轮次。 */
  maxRounds: number;
  /** 关令工厂：闭包 cwd，真读文件判地面真值。 */
  makeGate(cwd: string): Gate;
}

// ════════════════════════════════════════════════════════════════════
// 任务一：slugify（保留，函数行为型地面真值）
// ════════════════════════════════════════════════════════════════════
const SLUG_EXEC = "executor:slugify";
const SLUG_FILE = "slugify.js";
const SLUG_PROMPT = [
  "在当前工作目录开发一个 CommonJS 文件 slugify.js。",
  "定义 function slugify(str)：把字符串转成 URL slug——",
  "① 全部小写；② 非字母数字字符一律视作分隔；③ 连续分隔折叠成单个连字符 '-'；④ 去掉首尾连字符。",
  "文件末尾必须写 `module.exports = slugify;`。",
  "只创建/修改 slugify.js 这一个文件，别写测试或别的文件。",
].join("\n");

interface SlugCase {
  label: string;
  input: string;
  expect: string;
}
const SLUG_CASES: SlugCase[] = [
  { label: `slugify("Hello World")="hello-world"`, input: "Hello World", expect: "hello-world" },
  { label: `slugify("  Padded  ")="padded"`, input: "  Padded  ", expect: "padded" },
  { label: `slugify("Foo & Bar!")="foo-bar"`, input: "Foo & Bar!", expect: "foo-bar" },
  { label: `slugify("Already-Slug")="already-slug"`, input: "Already-Slug", expect: "already-slug" },
];

export function loadSlugify(src: string): ((s: string) => unknown) | undefined {
  try {
    const mod: { exports: any } = { exports: {} };
    new Function("module", "exports", src)(mod, mod.exports);
    const fn = typeof mod.exports === "function" ? mod.exports : mod.exports?.slugify;
    return typeof fn === "function" ? (fn as (s: string) => unknown) : undefined;
  } catch {
    return undefined;
  }
}

function makeSlugifyGate(cwd: string): Gate {
  return async (_a: UnitArtifact) => {
    let src = "";
    try {
      src = await fs.readFile(path.join(cwd, SLUG_FILE), "utf8");
    } catch {
      /* 缺失 */
    }
    const fn = loadSlugify(src);
    if (!fn) {
      return {
        pass: false,
        target: SLUG_EXEC,
        reason: "slugify.js 缺失或无法加载/导出",
        feedback: "未找到可用的 slugify：请写 slugify.js，定义 function slugify(str) 并 `module.exports = slugify;`。",
        ground: { passed: [], failed: SLUG_CASES.map((c) => c.label) },
      };
    }
    const passed: string[] = [];
    const failed: string[] = [];
    for (const c of SLUG_CASES) {
      let ok = false;
      try {
        ok = fn(c.input) === c.expect;
      } catch {
        ok = false;
      }
      (ok ? passed : failed).push(c.label);
    }
    const pass = failed.length === 0;
    return {
      pass,
      target: SLUG_EXEC,
      reason: pass ? "全部用例通过" : `${failed.length}/${SLUG_CASES.length} 条用例未过`,
      feedback: pass ? "" : `未通过用例：\n- ${failed.join("\n- ")}\n请只修改 slugify.js 修正后继续。`,
      ground: { passed, failed },
    };
  };
}

// ════════════════════════════════════════════════════════════════════
// 任务二：官网着陆页（HTML 结构型地面真值）
// ════════════════════════════════════════════════════════════════════
const SITE_EXEC = "executor:site";
const SITE_FILE = "index.html";
const SITE_PROMPT = [
  "在当前工作目录开发一个产品官网着陆页 index.html（单文件，内联 <style>，可直接浏览器打开）。",
  "产品名：LoopForge —— 定位：把 vibe coding 变成可托管的有界单元。",
  "页面必须包含：",
  "① <title> 含 “LoopForge”；",
  "② 顶部导航（<nav> 或 <header> 内含导航）；",
  "③ 主视觉 hero：一个 <h1> 主标题 + 一句副标题 + 一个行动按钮（<a> 或 <button>，文案含“开始/立即/试用/免费”之一）；",
  "④ 特性区：至少 3 个特性条目（<li> 或 class 含 feature/card 的卡片）；",
  "⑤ 页脚 <footer>，含版权信息；",
  "⑥ 内联 <style>（不外链 CDN）。",
  "只创建/修改 index.html 这一个文件。",
].join("\n");

export interface SiteCheck {
  label: string;
  ok: boolean;
}

/** 纯函数：对 HTML 文本做确定性结构检查 = 地面真值（可被单测直接覆盖）。 */
export function checkSitePage(html: string): SiteCheck[] {
  const h = html;
  const titleMatch = h.match(/<title>([\s\S]*?)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1] : "";
  const liCount = (h.match(/<li\b/gi) || []).length;
  const cardCount = (h.match(/class\s*=\s*["'][^"']*(feature|card)/gi) || []).length;
  const features = Math.max(liCount, cardCount);
  const hasCtaTag = /<a\b|<button\b/i.test(h);
  const hasActionWord = /(开始|立即|试用|免费|获取|体验|马上|start|try|get\s*started)/i.test(h);
  return [
    { label: "index.html 非空（≥300 字节）", ok: h.trim().length >= 300 },
    { label: "<title> 含 LoopForge", ok: /loopforge/i.test(titleText) },
    { label: "有 hero 主标题 <h1>", ok: /<h1\b/i.test(h) },
    { label: "有导航 <nav> 或 <header>", ok: /<nav\b|<header\b/i.test(h) },
    { label: "有 CTA 按钮（<a>/<button> + 行动词）", ok: hasCtaTag && hasActionWord },
    { label: "特性区 ≥3 条（<li> 或 .feature/.card）", ok: features >= 3 },
    { label: "有页脚 <footer>", ok: /<footer\b/i.test(h) },
    { label: "内联 <style>（不外链）", ok: /<style\b/i.test(h) },
  ];
}

function makeSiteGate(cwd: string): Gate {
  return async (_a: UnitArtifact) => {
    let html = "";
    try {
      html = await fs.readFile(path.join(cwd, SITE_FILE), "utf8");
    } catch {
      /* 缺失 */
    }
    const checks = checkSitePage(html);
    const passed = checks.filter((c) => c.ok).map((c) => c.label);
    const failed = checks.filter((c) => !c.ok).map((c) => c.label);
    const pass = failed.length === 0;
    return {
      pass,
      target: SITE_EXEC,
      reason: pass ? `全部 ${checks.length} 项达标` : `${failed.length}/${checks.length} 项未达标`,
      feedback: pass
        ? ""
        : `未达标项：\n- ${failed.join("\n- ")}\n请只修改 index.html 补齐后继续。`,
      ground: { passed, failed },
    };
  };
}

// ════════════════════════════════════════════════════════════════════
export const TASKS: Record<string, TaskDef> = {
  slugify: { code: "U002-slugify", file: SLUG_FILE, prompt: SLUG_PROMPT, maxRounds: 3, makeGate: makeSlugifyGate },
  site: { code: "U003-site", file: SITE_FILE, prompt: SITE_PROMPT, maxRounds: 4, makeGate: makeSiteGate },
};
