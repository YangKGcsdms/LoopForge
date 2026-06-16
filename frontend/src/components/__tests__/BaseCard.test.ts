import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import BaseCard from "../BaseCard.vue";

describe("BaseCard", () => {
  it("renders with default variant classes", () => {
    const wrapper = mount(BaseCard, {
      props: { variant: "default" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /shadow-sm/, "should have shadow-sm for default variant");
    assert.match(classes, /border-slate-200/, "should have border-slate-200");
    assert.match(classes, /bg-white/, "should have bg-white");
  });

  it("renders with elevated variant classes", () => {
    const wrapper = mount(BaseCard, {
      props: { variant: "elevated" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /shadow-lg/, "should have shadow-lg for elevated variant");
  });

  it("renders with outlined variant classes", () => {
    const wrapper = mount(BaseCard, {
      props: { variant: "outlined" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /border-2/, "should have border-2 for outlined variant");
  });

  it("supports size variants", () => {
    const wrapper = mount(BaseCard, {
      props: { size: "lg" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /p-8/, "should have p-8 for lg size");
    assert.match(classes, /rounded-xl/, "should have rounded-xl for lg size");
  });

  it("applies tone variant classes", () => {
    const wrapper = mount(BaseCard, {
      props: { tone: "success", variant: "default" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /border-emerald-200/, "should have border-emerald-200 for success");
    assert.match(classes, /bg-emerald-50/, "should have bg-emerald-50 for success");
  });

  it("applies interactive hover classes when enabled", () => {
    const wrapper = mount(BaseCard, {
      props: { interactive: true },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /hover:shadow-md/, "should have hover:shadow-md");
    assert.match(classes, /cursor-pointer/, "should have cursor-pointer");
  });

  it("renders slot content correctly", () => {
    const wrapper = mount(BaseCard, {
      slots: {
        default: "Test Content",
      },
    });
    assert.strictEqual(wrapper.text(), "Test Content");
  });

  it("combines multiple variant classes without conflict", () => {
    const wrapper = mount(BaseCard, {
      props: {
        variant: "outlined",
        size: "md",
        tone: "warning",
      },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /border-2/, "should have border-2");
    assert.match(classes, /p-6/, "should have p-6");
    assert.match(classes, /border-amber-300/, "should have border-amber-300");
  });
});
