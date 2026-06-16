/**
 * 语义色 Token 映射
 * 定义难度/路由/diff 颜色的统一 token，与 tailwind 设计系统对齐
 *
 * 设计原则：
 * - 模型强度 (tier)：violet(强) → sky(中) → slate(弱/默认)
 * - 节点类型 (kind)：amber(评估) → rose(关卡) → sky(生产者/默认)
 * - 难度 (diff)：rose(难) → amber(中) → emerald(易)
 */

export type SemanticColorToken = {
  bg: string; // 背景色 class
  text: string; // 文字色 class
};

/**
 * 模型档位色彩映射
 * strong → 紫色强调
 * mid → 天蓝色强调
 * cheap/default → 灰色低调
 */
export const tierColors: Record<string, SemanticColorToken> = {
  strong: {
    bg: "bg-violet-100",
    text: "text-violet-700",
  },
  mid: {
    bg: "bg-amber-100",
    text: "text-amber-700",
  },
  default: {
    bg: "bg-slate-100",
    text: "text-slate-600",
  },
};

/**
 * 节点类型色彩映射
 * evaluator → 琥珀色警告
 * gate → 玫瑰色严格
 * producer/default → 天蓝色常规
 */
export const kindColors: Record<string, SemanticColorToken> = {
  evaluator: {
    bg: "bg-amber-100",
    text: "text-amber-700",
  },
  gate: {
    bg: "bg-rose-100",
    text: "text-rose-700",
  },
  default: {
    bg: "bg-slate-100",
    text: "text-slate-600",
  },
};

/**
 * 难度色彩映射
 * hard → 玫瑰色高风险
 * medium → 琥珀色中等
 * easy/default → 翠绿色低风险
 */
export const diffColors: Record<string, SemanticColorToken> = {
  hard: {
    bg: "bg-rose-100",
    text: "text-rose-700",
  },
  medium: {
    bg: "bg-amber-100",
    text: "text-amber-700",
  },
  easy: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
  },
  default: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
  },
};

/**
 * 获取语义色 token，返回合并后的 tailwind class
 */
export function getTokenClasses(token: SemanticColorToken): string {
  return `${token.bg} ${token.text}`;
}
