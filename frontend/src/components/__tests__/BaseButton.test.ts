import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import BaseButton from "../BaseButton.vue";

describe("BaseButton", () => {
  it("renders as button element", () => {
    const wrapper = mount(BaseButton);
    assert.strictEqual(wrapper.element.tagName, "BUTTON");
  });

  it("renders with primary variant classes", () => {
    const wrapper = mount(BaseButton, {
      props: { variant: "primary" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /bg-violet-600/, "should have bg-violet-600 (terracotta) for primary");
    assert.match(classes, /text-slate-50/, "should have text-slate-50");
    assert.match(classes, /hover:bg-violet-700/, "should have hover:bg-violet-700");
  });

  it("renders with secondary variant classes", () => {
    const wrapper = mount(BaseButton, {
      props: { variant: "secondary" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /border.*border-slate-300/, "should have border-slate-300");
    assert.match(classes, /bg-white/, "should have bg-white");
  });

  it("renders with danger variant classes", () => {
    const wrapper = mount(BaseButton, {
      props: { variant: "danger" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /text-rose-600/, "should have text-rose-600");
    assert.match(classes, /focus:ring-rose-500/, "should have focus:ring-rose-500");
  });

  it("applies disabled attribute and styles when disabled prop is true", () => {
    const wrapper = mount(BaseButton, {
      props: { disabled: true },
    });
    const classes = wrapper.attributes("class");
    assert.strictEqual(wrapper.attributes("disabled"), "", "should have disabled attribute");
    assert.match(classes, /disabled:opacity-50/, "should have disabled:opacity-50");
    assert.match(classes, /disabled:cursor-not-allowed/, "should have disabled:cursor-not-allowed");
  });

  it("applies fullWidth class when fullWidth prop is true", () => {
    const wrapper = mount(BaseButton, {
      props: { fullWidth: true },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /w-full/, "should have w-full");
  });

  it("applies correct size variant classes", () => {
    const wrapper = mount(BaseButton, {
      props: { size: "lg" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /px-6/, "should have px-6 for lg size");
    assert.match(classes, /py-3/, "should have py-3 for lg size");
    assert.match(classes, /text-base/, "should have text-base for lg size");
  });

  it("has unified focus ring classes (ring-2 and ring-offset-2)", () => {
    const wrapper = mount(BaseButton);
    const classes = wrapper.attributes("class");
    assert.match(classes, /focus:outline-none/, "should have focus:outline-none");
    assert.match(classes, /focus:ring-2/, "should have focus:ring-2 (unified spec)");
    assert.match(classes, /focus:ring-offset-2/, "should have focus:ring-offset-2 (unified spec)");
  });

  it("emits click event when clicked", async () => {
    const wrapper = mount(BaseButton);
    await wrapper.trigger("click");
    assert.strictEqual(wrapper.emitted("click")?.length, 1, "should emit click event");
  });

  it("renders slot content correctly", () => {
    const wrapper = mount(BaseButton, {
      slots: {
        default: "Click Me",
      },
    });
    assert.strictEqual(wrapper.text(), "Click Me");
  });

  it("respects type attribute (submit/reset/button)", () => {
    const wrapper = mount(BaseButton, {
      props: { type: "submit" },
    });
    assert.strictEqual(wrapper.attributes("type"), "submit");
  });
});
