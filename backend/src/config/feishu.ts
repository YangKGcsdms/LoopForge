/** 从环境变量读飞书审批配置；缺关键项则返回 null（表示不启用飞书审批）。 */
import type { FeishuApproverConfig } from "../sdk/approval/feishuApprover.js";

export function feishuConfigFromEnv(): FeishuApproverConfig | null {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  const receiveId = process.env.FEISHU_RECEIVE_ID;
  if (!appId || !appSecret || !receiveId) return null;
  return {
    appId,
    appSecret,
    receiveId,
    receiveIdType: (process.env.FEISHU_RECEIVE_ID_TYPE ?? "open_id") as FeishuApproverConfig["receiveIdType"],
    timeoutMs: process.env.FEISHU_APPROVAL_TIMEOUT_MS ? Number(process.env.FEISHU_APPROVAL_TIMEOUT_MS) : undefined,
  };
}
