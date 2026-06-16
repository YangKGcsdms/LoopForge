/**
 * 输出契约 —— 节点「返回固定结构」的核心抽象。
 *
 * Cursor SDK 的 send 只回一个字符串、没有 schema 参数，所以「传入内容 → 返回固定结构」
 * 这件事必须由这一层提供：把形状注入提示词，再把回来的字符串解析校验成目标类型。
 * 这里只定契约接口，不绑死校验库——zod / JSON Schema / 手写校验都能实现它。
 */

export type ContractResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

export interface Contract<T> {
  /** 契约名，进 NodeRunRecord 和日志用。 */
  readonly name: string;
  /**
   * 给模型看的形状描述（JSON Schema 文本或等价说明）。
   * 由 runNode 注入提示词，让模型知道该吐什么。
   */
  describe(): string;
  /**
   * 把模型回来的原始字符串解析 + 校验成 T。
   * 失败时返回人类可读的 errors，供修复重试回灌给模型。
   */
  parse(raw: string): ContractResult<T>;
}

/**
 * 便捷构造：给一个 schema 文本 + 校验函数，包出 Contract。
 * 内部负责从模型输出里抠 JSON 再交给 validate，zod 适配器也能走这个。
 */
export function defineContract<T>(spec: {
  name: string;
  schema: string;
  validate: (data: unknown) => ContractResult<T>;
}): Contract<T> {
  return {
    name: spec.name,
    describe: () => spec.schema,
    parse(raw: string): ContractResult<T> {
      let data: unknown;
      try {
        data = JSON.parse(extractJson(raw));
      } catch {
        return { ok: false, errors: ["输出不是合法 JSON"] };
      }
      return spec.validate(data);
    },
  };
}

/** 从模型输出里抠出 JSON：容忍 ```json 代码块包裹与前后多余文本。 */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : trimmed).trim();
  const start = body.search(/[{[]/);
  if (start === -1) return body;
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  return end > start ? body.slice(start, end + 1) : body;
}
