/**
 * 运行时审批器入口 —— 配了飞书就走飞书长连接审批，否则保守拒绝。
 * 飞书审批器是单例：进程内起一次长连接，所有 run 复用。
 */
import { feishuConfigFromEnv } from "../../config/feishu.js";
import { createFeishuApprover, type FeishuApprover } from "./feishuApprover.js";
import { denyApprover } from "./policy.js";
import type { ToolApprover } from "../types.js";

export { autoApprover, denyApprover } from "./policy.js";
export { createFeishuApprover } from "./feishuApprover.js";

/**
 * 安全工具白名单：读/改文件、查找类自动放行（否则每次编辑都要审批，没法用）。
 * Bash 等会真正动机器的工具不在此列 → 触发审批回调。
 */
export const SAFE_TOOLS = ["Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "LS", "TodoWrite", "NotebookEdit"];

let feishu: FeishuApprover | null | undefined; // undefined=未初始化，null=未配置

function getFeishu(): FeishuApprover | null {
  if (feishu === undefined) {
    const cfg = feishuConfigFromEnv();
    if (cfg) {
      feishu = createFeishuApprover(cfg);
      feishu.start();
      console.log("[approval] 飞书审批已启用，长连接已起");
    } else {
      feishu = null;
      console.log("[approval] 未配置飞书（缺 FEISHU_APP_ID/SECRET/RECEIVE_ID），需审批的工具将被拒绝");
    }
  }
  return feishu;
}

/** 运行时审批器：配了飞书走飞书，否则保守拒绝（给出明确原因，不静默挂起）。 */
export function runtimeApprover(): ToolApprover {
  return getFeishu()?.approve ?? denyApprover;
}
