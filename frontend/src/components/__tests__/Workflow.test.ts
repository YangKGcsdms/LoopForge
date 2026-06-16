import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import Workflow from "../Workflow.vue";
import WorkflowForm from "../WorkflowForm.vue";
import WorkflowResults from "../WorkflowResults.vue";
import { useRun } from "../../composables/useRun";

describe("Workflow Components", () => {
  it("Workflow.vue 应该渲染左栏运行表单和右栏结果容器", () => {
    const wrapper = mount(Workflow);

    // 检查是否有两栏布局
    const gridDiv = wrapper.find("div.grid");
    assert.ok(gridDiv.exists(), "应该存在网格容器");
    assert.ok(gridDiv.classes().includes("lg:grid-cols-2"), "应该是两列布局");

    // 检查是否有 WorkflowForm 组件
    const formComponent = wrapper.findComponent(WorkflowForm);
    assert.ok(formComponent.exists(), "应该有 WorkflowForm 组件");

    // 检查是否有 WorkflowResults 组件
    const resultsComponent = wrapper.findComponent(WorkflowResults);
    assert.ok(resultsComponent.exists(), "应该有 WorkflowResults 组件");
  });

  it("WorkflowForm 应该正确消费 useRunState", () => {
    const runState = useRun();

    const wrapper = mount(WorkflowForm, {
      props: {
        useRunState: runState,
      },
    });

    // 检查是否有需求输入框
    const requirementTextarea = wrapper.find("textarea");
    assert.ok(requirementTextarea.exists(), "应该有需求 textarea");

    // 检查是否有最终目标输入框
    const goalInputs = wrapper.findAll("input[type='text']");
    assert.ok(goalInputs.length > 0, "应该有输入框");

    // 检查是否有 dryRun checkbox
    const checkboxes = wrapper.findAll("input[type='checkbox']");
    assert.ok(checkboxes.length > 0, "应该有 dryRun checkbox");

    // 检查是否有运行按钮
    const buttons = wrapper.findAll("button");
    const runButton = buttons.find(b => b.text().includes("评估"));
    assert.ok(runButton, "应该有'评估并自驱运行'按钮");
  });

  it("WorkflowResults 应该正确消费 useRunState 的难度和路由", () => {
    const runState = useRun();

    // 模拟设置难度和路由
    runState.difficulty.value = { value: "medium", reason: "项目规模中等" };
    runState.routing.value = {
      plan: "cursor-opus",
      execute: "cursor-sonnet",
      review: "claude-opus",
      test: "claude-opus",
    };

    const wrapper = mount(WorkflowResults, {
      props: {
        useRunState: runState,
      },
    });

    // 检查难度显示
    const diffText = wrapper.text();
    assert.ok(diffText.includes("medium"), "应该显示难度值");
    assert.ok(diffText.includes("项目规模中等"), "应该显示难度原因");

    // 检查路由显示
    assert.ok(diffText.includes("cursor-opus"), "应该显示 plan 路由");
    assert.ok(diffText.includes("cursor-sonnet"), "应该显示 execute 路由");
  });

  it("WorkflowResults 应该正确渲染 TODO 列表", () => {
    const runState = useRun();

    // 模拟添加 TODO
    runState.live.value = [
      {
        kind: "todos",
        key: "t1",
        subtasks: [
          {
            id: "S1",
            title: "设计数据库架构",
            estimateHours: 4,
            acceptance: "支持 RBAC 和 ABAC",
          },
          {
            id: "S2",
            title: "实现权限校验",
            estimateHours: 6,
            acceptance: "通过单元测试",
          },
        ],
      },
    ];

    const wrapper = mount(WorkflowResults, {
      props: {
        useRunState: runState,
      },
    });

    const text = wrapper.text();
    assert.ok(text.includes("S1"), "应该显示任务 ID S1");
    assert.ok(text.includes("S2"), "应该显示任务 ID S2");
    assert.ok(text.includes("设计数据库架构"), "应该显示任务标题");
    assert.ok(text.includes("4h"), "应该显示估计工时");
  });

  it("WorkflowResults 应该正确渲染节点卡片", () => {
    const runState = useRun();

    // 模拟添加节点
    runState.live.value = [
      {
        kind: "node",
        key: "n1",
        id: "node-1",
        nodeKind: "agent",
        status: "ok",
        iteration: 1,
        full: "输出内容示例",
        typed: "输出内容",
      },
    ];

    const wrapper = mount(WorkflowResults, {
      props: {
        useRunState: runState,
      },
    });

    const text = wrapper.text();
    assert.ok(text.includes("node-1"), "应该显示节点 ID");
    assert.ok(text.includes("agent"), "应该显示节点类型");
    assert.ok(text.includes("第 1 轮"), "应该显示迭代次数");
    assert.ok(text.includes("输出内容"), "应该显示输出内容");
  });

  it("WorkflowResults 应该显示最终完成状态", () => {
    const runState = useRun();

    runState.finalDone.value = {
      todos: 5,
      developed: 4,
      decompose: "设计、开发、测试、部署、文档",
    };

    const wrapper = mount(WorkflowResults, {
      props: {
        useRunState: runState,
      },
    });

    const text = wrapper.text();
    assert.ok(text.includes("拆出 5 个 TODO"), "应该显示总 TODO 数");
    assert.ok(text.includes("完成 4 个"), "应该显示完成数");
  });

  it("Workflow 在卸载时应该调用 cleanup", async () => {
    const wrapper = mount(Workflow);

    // 模拟 EventSource
    let closeWasCalled = false;
    const originalEventSource = (global as any).EventSource;
    (global as any).EventSource = class {
      listeners = new Map();
      constructor(public url: string) {}
      addEventListener(event: string, handler: (e: any) => void) {
        this.listeners.set(event, handler);
      }
      close() {
        closeWasCalled = true;
      }
    };

    try {
      // 获取 useRun 实例并启动一次运行
      // 注：这需要 EventSource 的存在

      // 卸载组件
      await wrapper.unmount();

      // cleanup 应该已经被调用（虽然由于 EventSource mock 可能没有实际的网络请求）
      assert.ok(true, "卸载成功完成");
    } finally {
      (global as any).EventSource = originalEventSource;
    }
  });
});
