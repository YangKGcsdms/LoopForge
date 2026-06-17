/**
 * 运行时审批器入口 —— 读飞书配置（存储优先、env 兜底）构建长连接审批器；
 * 配置变更（前端改了 aksk/receive_id）则重建连接；没配则保守拒绝。
 */
import { getFeishuConfig } from "../../config/feishu.js";
import { createFeishuApprover, type FeishuApprover, type FeishuApproverConfig } from "./feishuApprover.js";
import { denyApprover } from "./policy.js";
import type { ToolApprover } from "../types.js";

export { autoApprover, denyApprover } from "./policy.js";
export { createFeishuApprover, sendFeishuTest } from "./feishuApprover.js";

/**
 * 安全工具白名单：读/改文件、查找类自动放行（否则每次编辑都要审批，没法用）。
 * Bash 等会真正动机器的工具不在此列 → 触发审批回调。
 */
export const SAFE_TOOLS = ["Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "LS", "TodoWrite", "NotebookEdit"];

let current: { sig: string; approver: FeishuApprover } | null = null;

/** 配置指纹：变了才重建长连接（secret 只取前段，避免整串进日志）。 */
function sigOf(cfg: FeishuApproverConfig): string {
  return [cfg.appId, cfg.receiveId, cfg.receiveIdType, cfg.appSecret.slice(0, 6)].join("|");
}

/**
 * 运行时审批器：配了飞书走飞书长连接审批，否则保守拒绝（给出明确原因，不静默挂起）。
 * 在每次真跑装配 sender 时 await 调用——配置变更后下一次跑即生效。
 */
export async function runtimeApprover(): Promise<ToolApprover> {
  const cfg = await getFeishuConfig();
  if (!cfg) {
    if (current) {
      current.approver.stop();
      current = null;
      console.log("[approval] 飞书配置缺失/已清空，需审批的工具将被拒绝");
    }
    return denyApprover;
  }
  const sig = sigOf(cfg);
  if (!current || current.sig !== sig) {
    current?.approver.stop();
    const approver = createFeishuApprover(cfg);
    approver.start();
    current = { sig, approver };
    console.log("[approval] 飞书审批已启用/更新，长连接已起");
  }
  return current.approver.approve;
}
