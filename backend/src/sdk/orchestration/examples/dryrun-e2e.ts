/**
 * dryRun 端到端冒烟 —— 证明切分后的整条 pipeline（think + act 双原语）在 mock 下跑通。
 * 运行：npx tsx src/sdk/orchestration/examples/dryrun-e2e.ts
 *
 * act 节点（devStep）走 mock act-sender（空证据）、think 节点走 mock send；
 * 无 verify（mock 不真改文件），dev loop 仍靠 mock 评审收敛。
 */

import { runPipeline, makeMockSender, makeMockActSender } from "../index.js";

const mock = makeMockSender();
const r = await runPipeline(
  { requirement: "给后台加多租户 RBAC 权限系统", goal: "各角色按资源鉴权，越权被拦，关键路径有测试" },
  { send: mock, act: makeMockActSender(mock), summarize: mock, providerId: "claude-agent" },
);

console.log("难度：", r.difficulty.value);
console.log("路由：", r.routing);
console.log("拆解：", r.decompose.status, `${r.decompose.subtasks.length} 个 TODO`);
console.log("开发：", `${r.developed}/${r.todos.length} 收敛`);
console.log("各 TODO：", r.todos.map((t) => `${t.subtask.id}=${t.status}(${t.iterations}轮)`).join("  "));

const ok = r.developed === r.todos.length && r.todos.length > 0 && r.decompose.status === "converged";
console.log(ok ? "\n✅ dryRun e2e 通过：切分后的 think/act pipeline 跑通并收敛" : "\n❌ 未达预期");
if (!ok) process.exit(1);
