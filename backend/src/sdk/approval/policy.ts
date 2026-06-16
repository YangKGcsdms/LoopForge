/** 简单审批策略（无外部依赖），作为飞书不可用时的兜底。 */
import type { ToolApprover } from "../types.js";

/** 全放行（信任本地工作目录）：任何工具都允许。仅用于明确信任的场景。 */
export const autoApprover: ToolApprover = async () => ({ allow: true });

/** 全拒绝：headless 又没接审批通道时的保守默认，避免静默挂起或越权。 */
export const denyApprover: ToolApprover = async (req) => ({
  allow: false,
  reason: `无审批通道，默认拒绝工具 ${req.tool}`,
});
