import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractJson, defineContract, type ContractResult } from "./contract.js";

describe("extractJson", () => {
  it("原样返回纯 JSON", () => {
    assert.equal(extractJson('{"a":1}'), '{"a":1}');
  });
  it("剥掉 ```json 围栏", () => {
    assert.equal(extractJson('```json\n{"a":1}\n```'), '{"a":1}');
  });
  it("剥掉纯 ``` 围栏", () => {
    assert.equal(extractJson('```\n{"a":1}\n```'), '{"a":1}');
  });
  it("从前后多余文本里抠出对象", () => {
    assert.equal(extractJson('好的，结果：{"a":1} 完毕'), '{"a":1}');
  });
  it("抠出数组", () => {
    assert.equal(extractJson("前缀 [1,2,3] 后缀"), "[1,2,3]");
  });
  it("找不到 JSON 时返回原文", () => {
    assert.equal(extractJson("没有 JSON"), "没有 JSON");
  });
});

interface Foo {
  n: number;
}
const fooContract = defineContract<Foo>({
  name: "foo",
  schema: "{ n: number }",
  validate(data): ContractResult<Foo> {
    const d = data as Partial<Foo>;
    if (typeof d.n !== "number") return { ok: false, errors: ["n 必须是 number"] };
    return { ok: true, value: data as Foo };
  },
});

describe("defineContract.parse", () => {
  it("解析合法 JSON", () => {
    const r = fooContract.parse('{"n":42}');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value.n, 42);
  });
  it("解析围栏包裹的合法 JSON", () => {
    const r = fooContract.parse('```json\n{"n":7}\n```');
    assert.equal(r.ok, true);
  });
  it("非 JSON 返回错误", () => {
    const r = fooContract.parse("不是 JSON");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.errors[0], /JSON/);
  });
  it("形状不符返回 validate 错误（供修复重试回灌）", () => {
    const r = fooContract.parse('{"n":"x"}');
    assert.equal(r.ok, false);
    if (!r.ok) assert.deepEqual(r.errors, ["n 必须是 number"]);
  });
  it("describe 返回 schema 文本", () => {
    assert.equal(fooContract.describe(), "{ n: number }");
  });
});
