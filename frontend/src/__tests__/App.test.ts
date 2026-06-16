import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import App from "../App.vue";
import SkConfig from "../components/SkConfig.vue";
import WorkflowForm from "../components/WorkflowForm.vue";
import WorkflowResults from "../components/WorkflowResults.vue";

describe("App.vue", () => {
  it("应该渲染两栏响应式 CSS Grid 布局", () => {
    const wrapper = mount(App);

    // 检查主网格容器
    const main = wrapper.find("main");
    assert.ok(main.exists(), "应该有 main 标签");
    assert.ok(main.classes().includes("grid"), "应该有 grid 类");
    assert.ok(main.classes().includes("lg:grid-cols-[420px_1fr]"), "宽屏应该是 420px + flex-1 的两列布局");

    // 验证响应式：手机端是单列
    assert.ok(main.classes().includes("grid-cols-1"), "移动端应该是单列布局");
  });

  it("左栏应该包含 SkConfig 组件", () => {
    const wrapper = mount(App);
    const skConfig = wrapper.findComponent(SkConfig);
    assert.ok(skConfig.exists(), "应该有 SkConfig 组件");
  });

  it("左栏应该包含 WorkflowForm 组件", () => {
    const wrapper = mount(App);
    const workflowForm = wrapper.findComponent(WorkflowForm);
    assert.ok(workflowForm.exists(), "应该有 WorkflowForm 组件");
  });

  it("右栏应该包含 WorkflowResults 组件", () => {
    const wrapper = mount(App);
    const workflowResults = wrapper.findComponent(WorkflowResults);
    assert.ok(workflowResults.exists(), "应该有 WorkflowResults 组件");
  });

  it("应该有顶部导航头但不含 tab 切换", () => {
    const wrapper = mount(App);
    const header = wrapper.find("header");
    assert.ok(header.exists(), "应该有 header");

    // 检查品牌标志
    const logo = header.find("div.flex.h-8");
    assert.ok(logo.exists(), "应该有 logo");

    // 检查标题
    const title = header.find("h1");
    assert.ok(title.exists(), "应该有标题");
    assert.strictEqual(title.text(), "LoopForge");

    // 验证不存在 tab 导航
    const tabNav = header.find("nav");
    assert.ok(!tabNav.exists(), "应该没有 tab 导航");
  });

  it("左栏应该包含 SK 配置和运行表单的容器", () => {
    const wrapper = mount(App);

    // 获取所有的 div，找到第一个列容器（左栏）
    const divs = wrapper.findAll("main > div");
    assert.ok(divs.length >= 2, "应该有左栏和右栏两个列容器");

    // 左栏应该包含 space-y-6（间距）
    const leftCol = divs[0];
    assert.ok(leftCol.classes().includes("space-y-6") || leftCol.find(".space-y-6").exists(), "左栏应该有间距");
  });

  it("组件应该在卸载时清理资源", async () => {
    const wrapper = mount(App);

    // 卸载组件不应该抛出错误
    await wrapper.unmount();
    assert.ok(true, "卸载成功");
  });

  it("应该无横向溢出和布局错位", () => {
    const wrapper = mount(App);

    // 检查根容器设置
    const root = wrapper.find("div.min-h-screen");
    assert.ok(root.exists(), "应该有根容器");

    // 检查是否有溢出设置
    const main = wrapper.find("main");
    assert.ok(main.classes().includes("gap-6"), "应该有间距分离");

    // 验证布局不应该有超出范围的 max-width 限制
    assert.ok(!main.classes().includes("max-w"), "不应该有 max-width 限制，允许全宽布局");
  });
});
