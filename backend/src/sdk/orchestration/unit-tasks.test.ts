/**
 * 任务关令的 hermetic 单测 —— 零计费，先验证地面真值检查本身没毛病，
 * 再把真跑（unit:site:local / unit:site:deepseek）交给人执行，免得拿坏关令烧 token。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSitePage, loadSlugify } from "./unit-tasks.js";

const GOOD_PAGE = `<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <title>LoopForge · 把 vibe coding 变成可托管单元</title>
  <style>body{font-family:system-ui}</style>
</head>
<body>
  <header><nav><a href="#">特性</a><a href="#">文档</a></nav></header>
  <section class="hero">
    <h1>LoopForge</h1>
    <p>把短命、需盯的 vibe 工作，变成有界、可续跑、可审计的单元。</p>
    <a class="cta" href="#start">立即开始</a>
  </section>
  <ul class="features">
    <li>连续性：持久 / 续跑 / 移交</li>
    <li>信任：边界 / 验证 / 审计</li>
    <li>放心托管：没人盯也能跑</li>
  </ul>
  <footer>© 2026 LoopForge</footer>
</body>
</html>`;

test("site 关令：完整页面 8 项全达标", () => {
  const checks = checkSitePage(GOOD_PAGE);
  const failed = checks.filter((c) => !c.ok).map((c) => c.label);
  assert.equal(failed.length, 0, `不应有未达标项，却有：${failed.join("；")}`);
});

test("site 关令：残缺页面逐项标出缺失（驱动后续轮次反馈）", () => {
  const bad = `<!doctype html><html><head><title>某站</title></head>
  <body><h1>hi</h1><p>just a line</p></body></html>`;
  const checks = checkSitePage(bad);
  const failedLabels = checks.filter((c) => !c.ok).map((c) => c.label).join("｜");
  // 缺 title-LoopForge / 导航 / CTA / 特性≥3 / footer / style，至少 5 项未达标
  assert.ok(
    checks.filter((c) => !c.ok).length >= 5,
    `残缺页应多项未达标，实际未达标：${failedLabels}`,
  );
  assert.ok(failedLabels.includes("LoopForge"), "应标出 title 未含 LoopForge");
  assert.ok(failedLabels.includes("footer"), "应标出缺 footer");
  assert.ok(failedLabels.includes("CTA"), "应标出缺 CTA");
});

test("site 关令：空文件全挂（文件缺失场景）", () => {
  const checks = checkSitePage("");
  assert.ok(checks.every((c) => !c.ok), "空内容应全部未达标");
});

test("slugify 关令 loader：CommonJS 导出可加载、ESM/缺导出不可", () => {
  assert.equal(typeof loadSlugify("function slugify(s){return s} module.exports = slugify;"), "function");
  assert.equal(typeof loadSlugify("module.exports = { slugify: (s)=>s };"), "function");
  assert.equal(loadSlugify("export default (s)=>s"), undefined, "ESM 语法应加载失败");
  assert.equal(loadSlugify("function notSlugify(){}"), undefined, "无导出应得不到 slugify");
});
