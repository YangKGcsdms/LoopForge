/**
 * 语义色 Token 映射 —— 暖色账本 / Anthropic 编辑风。
 * 返回的是 style.css @layer components 里定义的 chip 色调类名（.tone-*），
 * 由 BaseTag 套用；切暗色时这些 tone 类随 CSS 变量自动适配。
 *
 * 设计原则（暖色谱，terracotta 单点聚焦）：
 * - 模型强度 (tier)：brand(强/terracotta) → olive(中) → mute(弱/默认)
 * - 节点类型 (kind)：amber(评估) → down(关卡/红) → sage(生产者/默认)
 * - 难度 (diff)：down(难/红) → amber(中) → up(易/绿)
 */

export const tierTone: Record<string, string> = {
  strong: "tone-brand",
  mid: "tone-olive",
  default: "tone-mute",
};

export const kindTone: Record<string, string> = {
  evaluator: "tone-amber",
  gate: "tone-down",
  default: "tone-sage",
};

export const diffTone: Record<string, string> = {
  hard: "tone-down",
  medium: "tone-amber",
  easy: "tone-up",
  default: "tone-up",
};
