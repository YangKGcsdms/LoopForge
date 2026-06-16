/**
 * 内置 mock Sender —— 给前端/演示用：不装 @cursor/sdk、不配 SK 也能把整条 pipeline 跑通。
 *
 * 模拟出"自拆解 → 自出 N 个 TODO → 每个 TODO 自循环开发"的真实形态：
 *   · 拆解：粗（1 个 16h 大任务）→ 评审打回 → 细（N 个 3~5 工时任务）→ 通过
 *   · 每个 TODO 的开发是一个带评估+矫正的小 loop：
 *       devStep（初版，边界用例没补、测试没全过）→ devReviewer 打回 →
 *       devStep（按评审修复）→ devReviewer 通过
 * 每次 makeMockSender() 得到独立计数的实例。
 */

import type { Sender } from "./run.js";

export function makeMockSender(): Sender {
  let decomposeProd = 0;
  const devReviewCount = new Map<string, number>();
  const devRedTeamCount = new Map<string, number>();

  return async (req) => {
    const sys = req.system;

    if (sys.includes("用一句话")) {
      return { result: "（mock 一句话总结）", durationMs: 2 };
    }
    if (sys.includes("难度评估")) {
      return {
        result: JSON.stringify({ difficulty: "medium", reason: "涉及多模块改动与状态流转，属中等难度" }),
        durationMs: 3,
      };
    }

    // 开发评审（代码评审员）—— 第一次打回、第二次通过，体现"外围 agent 矫正评估"
    if (sys.includes("代码评审员")) {
      const taskId = req.user.match(/"id":"(T\d+)"/)?.[1] ?? "T?";
      const n = (devReviewCount.get(taskId) ?? 0) + 1;
      devReviewCount.set(taskId, n);
      const pass = n >= 2;
      return {
        result: JSON.stringify({
          completion: {
            done: pass,
            evidence: pass ? "相关测试 6/6 通过" : "边界用例缺失，2 项测试未过",
          },
          deviation: {
            score: pass ? 0.12 : 0.45,
            reason: pass ? "实现贴合验收标准" : "未覆盖无权限/越权场景，偏离验收",
          },
          pass,
          requiredFixes: pass ? [] : ["补无权限/越权访问的用例", "对齐验收标准里的审计要求"],
        }),
        durationMs: 7,
      };
    }

    // 红队对抗评审 —— 与代码评审同步：第一轮打回、第二轮通过（独立计数，和主评审同进退）
    if (sys.includes("红队评审员")) {
      const taskId = req.user.match(/"id":"(T\d+)"/)?.[1] ?? "T?";
      const n = (devRedTeamCount.get(taskId) ?? 0) + 1;
      devRedTeamCount.set(taskId, n);
      const pass = n >= 2;
      return {
        result: JSON.stringify({
          completion: { done: pass, evidence: pass ? "红队复核：测试与产出可信" : "testsRun 存疑、越权场景未证实，按未验证处理" },
          deviation: { score: pass ? 0.1 : 0.5, reason: pass ? "未发现硬伤" : "存疑即打回" },
          pass,
          requiredFixes: pass ? [] : ["红队：给出测试真过的证据", "红队：确认越权/无权限场景被覆盖"],
        }),
        durationMs: 6,
      };
    }

    // 拆解评审
    if (sys.includes("评审员")) {
      const converged = decomposeProd >= 2;
      return {
        result: JSON.stringify({
          completion: { done: converged, evidence: converged ? "全部 ≤5 工时、无未决项" : "存在 16 工时大任务" },
          deviation: { score: converged ? 0.1 : 0.6, reason: converged ? "粒度适合 agent 开发" : "粒度过粗、有未决项" },
          pass: converged,
          requiredFixes: converged ? [] : ["把大任务拆到每个 3~5 工时", "补充缺失的验收标准"],
        }),
        durationMs: 6,
      };
    }

    // 开发步进（开发工程师）—— 见到"评审要求修复"则产出修复版
    if (sys.includes("开发工程师")) {
      const taskId = req.user.match(/子任务\[([^\]]+)\]/)?.[1] ?? "T?";
      const fixing = req.user.includes("评审要求修复");
      const dir = taskId.toLowerCase();
      return {
        result: JSON.stringify({
          taskId,
          filesTouched: fixing
            ? [`src/${dir}/index.ts`, `src/${dir}/index.test.ts`, `src/${dir}/guard.test.ts`]
            : [`src/${dir}/index.ts`, `src/${dir}/index.test.ts`],
          summary: fixing ? `按评审补了无权限/越权用例并修正 ${taskId}` : `实现了 ${taskId} 的核心逻辑并补了测试`,
          testsRun: fixing ? { passed: 6, failed: 0 } : { passed: 4, failed: 2 },
          selfCheck: fixing ? "补齐边界用例后本地全过" : "主流程通过，边界用例待补",
        }),
        durationMs: 14,
      };
    }

    // 出方案（架构师）
    if (sys.includes("架构师")) {
      return {
        result: JSON.stringify({
          approach: "分层推进：先盘点现状与缺口，再补齐核心链路，最后联调与验收",
          keyDecisions: ["复用现有 RBAC 切面做租户隔离", "异步导出走任务队列"],
          risks: ["跨国算薪规则不全", "schema 与生产漂移"],
          phases: ["盘点现状", "补齐核心链路", "联调与验收"],
          acceptance: ["关键路径有测试", "各国可算薪"],
          openQuestions: ["上线国家范围未定"],
        }),
        durationMs: 5,
      };
    }

    // 拆解产出：粗 → 细（N 个 3~5 工时任务）
    decomposeProd++;
    const coarse = decomposeProd === 1;
    const out = coarse
      ? {
          subtasks: [{ id: "T1", title: "整体实现（过粗）", estimateHours: 16, acceptance: "能用" }],
          ambiguities: ["边界场景未定"],
          gaps: [],
          toSupplement: [],
        }
      : {
          subtasks: [
            { id: "T1", title: "权限模型梳理与缺口盘点", estimateHours: 4, acceptance: "列出 RBAC/ABAC 现状与缺口清单" },
            { id: "T2", title: "策略数据模型与迁移", estimateHours: 5, acceptance: "角色/资源/策略表 + 迁移可回滚" },
            { id: "T3", title: "鉴权中间件与策略求值", estimateHours: 5, acceptance: "请求级鉴权 + 单测覆盖越权场景" },
            { id: "T4", title: "前端权限位与路由守卫", estimateHours: 4, acceptance: "按钮级/路由级可见性 + 守卫测试" },
          ],
          ambiguities: [],
          gaps: [],
          toSupplement: [],
        };
    return { result: JSON.stringify(out), durationMs: 8 };
  };
}
