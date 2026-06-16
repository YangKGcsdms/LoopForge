import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import BaseSelect from "../BaseSelect.vue";

describe("BaseSelect", () => {
  it("renders as select element", () => {
    const wrapper = mount(BaseSelect);
    assert.strictEqual(wrapper.element.tagName, "SELECT");
  });

  it("applies correct size variant classes", () => {
    const wrapper = mount(BaseSelect, {
      props: { size: "lg" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /px-4/, "should have px-4 for lg size");
    assert.match(classes, /py-3/, "should have py-3 for lg size");
    assert.match(classes, /text-base/, "should have text-base for lg size");
  });

  it("applies disabled attribute and styles when disabled prop is true", () => {
    const wrapper = mount(BaseSelect, {
      props: { disabled: true },
    });
    const classes = wrapper.attributes("class");
    assert.strictEqual(wrapper.attributes("disabled"), "", "should have disabled attribute");
    assert.match(classes, /disabled:bg-slate-50/, "should have disabled:bg-slate-50");
    assert.match(classes, /disabled:cursor-not-allowed/, "should have disabled:cursor-not-allowed");
  });

  it("applies fullWidth class when fullWidth prop is true", () => {
    const wrapper = mount(BaseSelect, {
      props: { fullWidth: true },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /w-full/, "should have w-full");
  });

  it("supports v-model with modelValue prop and update:modelValue event", async () => {
    const wrapper = mount(BaseSelect, {
      props: { modelValue: "option1" },
      slots: {
        default: `<option value="option1">Option 1</option><option value="option2">Option 2</option>`,
      },
    });
    assert.strictEqual(wrapper.attributes("value"), "option1");

    const select = wrapper.find("select");
    await select.setValue("option2");
    assert.deepEqual(wrapper.emitted("update:modelValue"), [["option2"]]);
  });

  it("emits change event when value changes", async () => {
    const wrapper = mount(BaseSelect, {
      slots: {
        default: `<option value="a">A</option><option value="b">B</option>`,
      },
    });
    const select = wrapper.find("select");
    await select.setValue("b");
    assert.strictEqual(wrapper.emitted("change")?.length, 1, "should emit change event");
  });

  it("has unified focus ring classes (ring-2 and ring-offset-2)", () => {
    const wrapper = mount(BaseSelect);
    const classes = wrapper.attributes("class");
    assert.match(classes, /focus:outline-none/, "should have focus:outline-none");
    assert.match(classes, /focus:ring-2/, "should have focus:ring-2 (unified spec)");
    assert.match(classes, /focus:ring-offset-2/, "should have focus:ring-offset-2 (unified spec)");
    assert.match(classes, /focus:ring-slate-500/, "should have focus:ring-slate-500");
  });

  it("renders option slot content", () => {
    const wrapper = mount(BaseSelect, {
      slots: {
        default: `<option value="test">Test Option</option>`,
      },
    });
    assert.strictEqual(
      wrapper.find("option").text(),
      "Test Option",
      "should render option text"
    );
  });
});
