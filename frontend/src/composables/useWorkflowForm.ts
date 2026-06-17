import { ref, type Ref } from "vue";

/**
 * 运行表单的字段状态 —— 由 App 持有、桌面版与 H5 版共用同一实例，
 * 因此在两个版本间切换（自动或手动）时已填的需求/目标/cwd 不会丢。
 */
export interface WorkflowForm {
  provider: Ref<string>;
  requirement: Ref<string>;
  goal: Ref<string>;
  cwd: Ref<string>;
  dryRun: Ref<boolean>;
}

export function useWorkflowForm(): WorkflowForm {
  return {
    // 默认走 Claude Code SDK（cursor 已冻结）；挂载时按它加载模型池。
    provider: ref("claude-agent"),
    requirement: ref("检查当前项目新版本的 oa-system-ui 前台权限系统"),
    goal: ref("评估 RBAC/ABAC 权限系统进展，缺的补齐，确保能推进"),
    cwd: ref(""),
    dryRun: ref(true),
  };
}
