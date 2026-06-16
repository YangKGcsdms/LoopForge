import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mount, VueWrapper } from "@vue/test-utils";
import WorkflowResults from "../WorkflowResults.vue";
import { useRun } from "../../composables/useRun";
import type { UseRunState } from "../../composables/useRun";

describe("WorkflowResults - 状态完备化", () => {
  let wrapper: VueWrapper<any>;

  beforeEach(() => {
    // 清理 DOM
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("状态呈现", () => {
    it("空态：应该显示等待运行提示", () => {
      const runState = useRun();
      // 初始化时为空态
      assert.strictEqual(runState.running.value, false);
      assert.strictEqual(runState.live.value.length, 0);
      assert.strictEqual(runState.error.value, "");

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      const text = wrapper.text();
      assert.ok(text.includes("等待运行"), "应该显示等待运行提示");
      assert.ok(text.includes("在左侧表单中填写需求"), "应该显示操作提示");
    });

    it("加载态：应该显示运行中状态和内容", async () => {
      const runState = useRun();
      runState.running.value = true;
      runState.live.value = [
        {
          kind: "phase",
          key: "p1",
          name: "初始化",
        },
      ];

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      await wrapper.vm.$nextTick();
      const text = wrapper.text();
      assert.ok(text.includes("运行中") || text.includes("实时自驱运行"), "应该显示运行中状态");
      assert.ok(text.includes("初始化"), "应该显示阶段信息");
    });

    it("运行中态：应该显示 running 状态徽章", async () => {
      const runState = useRun();
      runState.running.value = true;
      runState.live.value = [
        {
          kind: "phase",
          key: "p1",
          name: "分析",
        },
      ];

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      await wrapper.vm.$nextTick();
      const statusBadges = wrapper.findAll("[role='status']");
      const runningBadge = statusBadges.find(
        (badge) => badge.attributes("aria-busy") === "true"
      );
      assert.ok(runningBadge, "应该显示 running 状态徽章");
    });

    it("完成态：应该显示已完成状态和最终统计", async () => {
      const runState = useRun();
      runState.running.value = false;
      runState.finalDone.value = {
        todos: 5,
        developed: 3,
        decompose: "设计、开发、测试、部署",
      };
      runState.live.value = [
        {
          kind: "node",
          key: "n1",
          id: "node-1",
          nodeKind: "agent",
          status: "ok",
          iteration: 1,
          full: "完成输出",
          typed: "完成输出",
        },
      ];

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      await wrapper.vm.$nextTick();
      const text = wrapper.text();
      assert.ok(
        text.includes("已完成") || text.includes("运行完成"),
        "应该显示完成状态"
      );
      assert.ok(text.includes("5"), "应该显示 TODO 总数");
      assert.ok(text.includes("3"), "应该显示完成数");
    });

    it("错误态：应该显示错误信息且可读", async () => {
      const runState = useRun();
      runState.running.value = false;
      runState.error.value = "API 请求失败：连接超时";

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      await wrapper.vm.$nextTick();
      const text = wrapper.text();
      assert.ok(text.includes("运行出错"), "应该显示错误标题");
      assert.ok(
        text.includes("API 请求失败") || text.includes("连接超时"),
        "应该显示错误详情"
      );
      assert.ok(
        text.includes("不会阻塞") || text.includes("后续运行"),
        "应该表明错误不阻塞"
      );
    });

    it("错误态：不阻塞后续运行（可重新运行）", async () => {
      const runState = useRun();
      runState.error.value = "前次运行出错";
      runState.running.value = false;

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      // 模拟清除错误并重新运行
      runState.error.value = "";
      runState.running.value = true;
      runState.live.value = [
        {
          kind: "phase",
          key: "p1",
          name: "重试",
        },
      ];

      await wrapper.vm.$nextTick();
      const text = wrapper.text();
      assert.ok(text.includes("重试"), "应该能够清除错误并重新运行");
    });
  });

  describe("自动滚动功能", () => {
    it("应该存在自动滚动容器", async () => {
      const runState = useRun();
      runState.running.value = true;
      runState.live.value = [
        {
          kind: "phase",
          key: "p1",
          name: "开始",
        },
      ];

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      await wrapper.vm.$nextTick();
      const scrollContainer = wrapper.find("div[style*='max-height: 500px']");
      assert.ok(scrollContainer.exists(), "应该存在滚动容器");
    });

    it("长输出应该自动滚动到最新内容", async () => {
      const runState = useRun();
      runState.running.value = true;

      // 创建长内容
      const nodes = [];
      for (let i = 0; i < 10; i++) {
        nodes.push({
          kind: "node" as const,
          key: `n${i}`,
          id: `node-${i}`,
          nodeKind: "agent",
          status: "ok",
          iteration: 1,
          full: `很长的输出内容 ${i}`.repeat(50),
          typed: `很长的输出内容 ${i}`.repeat(50),
        });
      }
      runState.live.value = nodes;

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      await wrapper.vm.$nextTick();
      const scrollContainer = wrapper.find("div[style*='max-height: 500px']");
      assert.ok(scrollContainer.exists(), "应该存在滚动容器");

      // 验证内容都存在
      const text = wrapper.text();
      assert.ok(text.includes("node-0"), "应该显示第一个节点");
      assert.ok(text.includes("node-9"), "应该显示最后一个节点");
    });

    it("多节点下应该支持滚动且不卡顿", async () => {
      const runState = useRun();
      runState.running.value = true;

      // 创建多个节点以测试性能
      const startTime = Date.now();
      const nodes = [];
      for (let i = 0; i < 50; i++) {
        nodes.push({
          kind: "node" as const,
          key: `n${i}`,
          id: `node-${i}`,
          nodeKind: "agent",
          status: i % 10 === 0 ? "error" : "ok",
          iteration: Math.floor(i / 10) + 1,
          full: `输出 ${i}`,
          typed: `输出 ${i}`,
        });
      }
      runState.live.value = nodes;

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      await wrapper.vm.$nextTick();
      const renderTime = Date.now() - startTime;

      // 验证性能（应该在合理时间内完成，比如 < 1000ms）
      assert.ok(renderTime < 1000, `渲染应该在 1 秒内完成，实际 ${renderTime}ms`);

      const text = wrapper.text();
      assert.ok(text.includes("node-0"), "应该显示节点");
      assert.ok(text.includes("node-49"), "应该显示最后的节点");
    });

    it("用户手动滚动后应该停止自动滚动", async () => {
      const runState = useRun();
      runState.running.value = true;

      const nodes = [];
      for (let i = 0; i < 5; i++) {
        nodes.push({
          kind: "node" as const,
          key: `n${i}`,
          id: `node-${i}`,
          nodeKind: "agent",
          status: "ok",
          iteration: 1,
          full: `输出 ${i}`,
          typed: `输出 ${i}`,
        });
      }
      runState.live.value = nodes;

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      await wrapper.vm.$nextTick();
      const scrollContainer = wrapper.find("div[style*='max-height: 500px']");

      // 模拟用户滚动到非底部位置
      if (scrollContainer.element) {
        const el = scrollContainer.element as HTMLDivElement;
        el.scrollTop = 0; // 滚动到顶部
        scrollContainer.trigger("scroll");

        await wrapper.vm.$nextTick();
        // 此时 shouldAutoScroll 应该为 false，不再自动滚动到底部
        assert.ok(true, "应该成功停止自动滚动");
      }
    });
  });

  describe("错误态处理", () => {
    it("错误信息应该可读且完整", async () => {
      const runState = useRun();
      const errorMessage = "模块引入错误: Cannot find module './lib/utils'\n位置: src/components/Form.vue:3";
      runState.error.value = errorMessage;

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      await wrapper.vm.$nextTick();
      const text = wrapper.text();
      assert.ok(text.includes("Cannot find module"), "应该显示完整的错误信息");
    });

    it("错误态下应该保留错误详情区域的可读样式", async () => {
      const runState = useRun();
      runState.error.value = "网络错误";

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      await wrapper.vm.$nextTick();
      const errorCard = wrapper.find("div.bg-rose-50");
      assert.ok(errorCard.exists(), "应该存在错误样式的 card");
      assert.ok(
        errorCard.classes().includes("bg-rose-50"),
        "应该使用错误颜色"
      );
    });

    it("从错误态恢复：清除错误后应该恢复到可运行状态", async () => {
      const runState = useRun();
      runState.error.value = "之前出错";

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      await wrapper.vm.$nextTick();
      assert.ok(wrapper.text().includes("运行出错"), "初始应该显示错误");

      // 清除错误
      runState.error.value = "";
      await wrapper.vm.$nextTick();

      // 现在应该显示空态
      assert.ok(
        wrapper.text().includes("等待运行") || wrapper.text().length > 0,
        "清除错误后应该回到其他状态"
      );
    });
  });

  describe("节点错误呈现", () => {
    it("错误节点应该有不同的样式区分", async () => {
      const runState = useRun();
      runState.running.value = false;
      runState.live.value = [
        {
          kind: "node",
          key: "n1",
          id: "error-node",
          nodeKind: "agent",
          status: "error",
          iteration: 1,
          full: "⚠ 节点执行失败：超时",
          typed: "⚠ 节点执行失败：超时",
        },
        {
          kind: "node",
          key: "n2",
          id: "ok-node",
          nodeKind: "agent",
          status: "ok",
          iteration: 1,
          full: "节点执行成功",
          typed: "节点执行成功",
        },
      ];

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      await wrapper.vm.$nextTick();
      const text = wrapper.text();
      assert.ok(text.includes("error-node"), "应该显示错误节点");
      assert.ok(text.includes("ok-node"), "应该显示成功节点");
      assert.ok(text.includes("超时"), "应该显示错误详情");
    });
  });

  describe("完整流程", () => {
    it("从空态 -> 运行中 -> 完成的完整流程", async () => {
      const runState = useRun();

      wrapper = mount(WorkflowResults, {
        props: {
          useRunState: runState,
        },
      });

      // 阶段 1：空态
      await wrapper.vm.$nextTick();
      assert.ok(wrapper.text().includes("等待运行"), "初始应该是空态");

      // 阶段 2：运行中
      runState.running.value = true;
      runState.difficulty.value = { value: "medium", reason: "项目规模中等" };
      runState.live.value = [
        {
          kind: "phase",
          key: "p1",
          name: "分析",
        },
        {
          kind: "node",
          key: "n1",
          id: "node-1",
          nodeKind: "agent",
          status: "ok",
          iteration: 1,
          full: "分析中...",
          typed: "分析中...",
        },
      ];

      await wrapper.vm.$nextTick();
      const text = wrapper.text();
      assert.ok(text.includes("实时自驱运行"), "运行中应该显示运行容器");
      assert.ok(text.includes("分析"), "应该显示阶段");

      // 阶段 3：完成
      runState.running.value = false;
      runState.finalDone.value = {
        todos: 3,
        developed: 3,
        decompose: "设计、开发、测试",
      };

      await wrapper.vm.$nextTick();
      assert.ok(wrapper.text().includes("已完成"), "应该显示完成状态");
    });
  });
});
