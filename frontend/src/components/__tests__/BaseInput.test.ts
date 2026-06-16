import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import BaseInput from "../BaseInput.vue";

describe("BaseInput", () => {
  it("renders as input element", () => {
    const wrapper = mount(BaseInput);
    assert.strictEqual(wrapper.element.tagName, "INPUT");
  });

  it("supports different input types", () => {
    const types = ["email", "password", "number", "search", "tel", "url"];
    types.forEach((type) => {
      const wrapper = mount(BaseInput, {
        props: { type },
      });
      assert.strictEqual(wrapper.attributes("type"), type);
    });
  });

  it("applies correct size variant classes", () => {
    const wrapper = mount(BaseInput, {
      props: { size: "lg" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /px-4/, "should have px-4 for lg size");
    assert.match(classes, /py-3/, "should have py-3 for lg size");
    assert.match(classes, /text-base/, "should have text-base for lg size");
  });

  it("applies disabled attribute and styles when disabled prop is true", () => {
    const wrapper = mount(BaseInput, {
      props: { disabled: true },
    });
    const classes = wrapper.attributes("class");
    assert.strictEqual(wrapper.attributes("disabled"), "", "should have disabled attribute");
    assert.match(classes, /disabled:bg-slate-50/, "should have disabled:bg-slate-50");
    assert.match(classes, /disabled:cursor-not-allowed/, "should have disabled:cursor-not-allowed");
  });

  it("applies error state classes when error prop is true", () => {
    const wrapper = mount(BaseInput, {
      props: { error: true },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /border-rose-300/, "should have border-rose-300 for error");
    assert.match(classes, /focus:ring-rose-500/, "should have focus:ring-rose-500 for error");
  });

  it("applies fullWidth class when fullWidth prop is true", () => {
    const wrapper = mount(BaseInput, {
      props: { fullWidth: true },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /w-full/, "should have w-full");
  });

  it("sets placeholder attribute correctly", () => {
    const placeholder = "Enter your name";
    const wrapper = mount(BaseInput, {
      props: { placeholder },
    });
    assert.strictEqual(wrapper.attributes("placeholder"), placeholder);
  });

  it("supports v-model with modelValue prop and update:modelValue event", async () => {
    const wrapper = mount(BaseInput, {
      props: { modelValue: "test" },
    });
    assert.strictEqual(wrapper.attributes("value"), "test");

    await wrapper.setValue("new value");
    assert.deepEqual(wrapper.emitted("update:modelValue"), [["new value"]]);
  });

  it("emits input event when value changes", async () => {
    const wrapper = mount(BaseInput);
    const input = wrapper.find("input");
    await input.setValue("test");
    assert.strictEqual(wrapper.emitted("input")?.length, 1, "should emit input event");
  });

  it("emits focus event when input is focused", async () => {
    const wrapper = mount(BaseInput);
    await wrapper.trigger("focus");
    assert.strictEqual(wrapper.emitted("focus")?.length, 1, "should emit focus event");
  });

  it("emits blur event when input loses focus", async () => {
    const wrapper = mount(BaseInput);
    await wrapper.trigger("blur");
    assert.strictEqual(wrapper.emitted("blur")?.length, 1, "should emit blur event");
  });

  it("has unified focus ring classes (ring-2 and ring-offset-2)", () => {
    const wrapper = mount(BaseInput);
    const classes = wrapper.attributes("class");
    assert.match(classes, /focus:outline-none/, "should have focus:outline-none");
    assert.match(classes, /focus:ring-2/, "should have focus:ring-2 (unified spec)");
    assert.match(classes, /focus:ring-offset-2/, "should have focus:ring-offset-2 (unified spec)");
  });

  it("applies muted variant classes", () => {
    const wrapper = mount(BaseInput, {
      props: { variant: "muted" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /border-slate-200/, "should have border-slate-200");
    assert.match(classes, /text-slate-500/, "should have text-slate-500");
  });

  it("handles number input type correctly", async () => {
    const wrapper = mount(BaseInput, {
      props: { type: "number", modelValue: 42 },
    });
    assert.strictEqual(wrapper.attributes("value"), "42");
    await wrapper.setValue("100");
    assert.deepEqual(wrapper.emitted("update:modelValue"), [[100]]);
  });
});
