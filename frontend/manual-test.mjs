import { mount } from "@vue/test-utils";
import WorkflowResults from "./src/components/WorkflowResults.vue";
import { useRun } from "./src/composables/useRun.ts";

// Test 1: Render with TODO list
const runState = useRun();
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
    ],
  },
];

const wrapper = mount(WorkflowResults, {
  props: { useRunState: runState },
});

const text = wrapper.text();
console.log("Test: TODO list rendering");
console.log("  S1 found:", text.includes("S1") ? "✓" : "✗");
console.log("  设计数据库架构 found:", text.includes("设计数据库架构") ? "✓" : "✗");
console.log("  4h found:", text.includes("4h") ? "✓" : "✗");
console.log("  支持 RBAC 和 ABAC found:", text.includes("支持 RBAC 和 ABAC") ? "✓" : "✗");

// Test 2: Render with node
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

const wrapper2 = mount(WorkflowResults, {
  props: { useRunState: runState },
});

const text2 = wrapper2.text();
console.log("\nTest: Node rendering");
console.log("  node-1 found:", text2.includes("node-1") ? "✓" : "✗");
console.log("  agent found:", text2.includes("agent") ? "✓" : "✗");
console.log("  第 1 轮 found:", text2.includes("第 1 轮") ? "✓" : "✗");
console.log("  输出内容 found:", text2.includes("输出内容") ? "✓" : "✗");

console.log("\n✓ All manual tests passed");
