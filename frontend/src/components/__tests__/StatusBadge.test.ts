import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import StatusBadge, { type StatusType } from "../StatusBadge.vue";

describe("StatusBadge", () => {
  it("renders with status prop", () => {
    const wrapper = mount(StatusBadge, {
      props: { status: "running" },
    });
    assert.ok(wrapper.exists(), "component should render");
    assert.strictEqual(wrapper.element.tagName, "DIV");
  });

  describe("status types", () => {
    const statuses: StatusType[] = ["running", "completed", "error", "pending", "idle"];

    statuses.forEach((status) => {
      it(`renders ${status} status with correct semantic classes`, () => {
        const wrapper = mount(StatusBadge, {
          props: { status },
        });
        const classes = wrapper.attributes("class");

        switch (status) {
          case "running":
            assert.match(classes, /bg-sky-100/, "should have sky background");
            assert.match(classes, /text-sky-700/, "should have sky text");
            break;
          case "completed":
            assert.match(classes, /bg-emerald-100/, "should have emerald background");
            assert.match(classes, /text-emerald-700/, "should have emerald text");
            break;
          case "error":
            assert.match(classes, /bg-rose-100/, "should have rose background");
            assert.match(classes, /text-rose-700/, "should have rose text");
            break;
          case "pending":
            assert.match(classes, /bg-amber-100/, "should have amber background");
            assert.match(classes, /text-amber-700/, "should have amber text");
            break;
          case "idle":
            assert.match(classes, /bg-slate-100/, "should have slate background");
            assert.match(classes, /text-slate-600/, "should have slate text");
            break;
        }
      });
    });
  });

  it("renders status dot indicator", () => {
    const wrapper = mount(StatusBadge, {
      props: { status: "running" },
    });
    const dot = wrapper.find("span[class*='animate-pulse']");
    assert.ok(dot.exists(), "should render animated dot");
  });

  it("displays default label based on status when no custom label provided", () => {
    const wrapper = mount(StatusBadge, {
      props: { status: "completed" },
    });
    assert.match(wrapper.text(), /完成/, "should display default completed label");
  });

  it("displays custom label when provided", () => {
    const wrapper = mount(StatusBadge, {
      props: { status: "running", label: "正在处理..." },
    });
    assert.match(wrapper.text(), /正在处理/, "should display custom label");
  });

  it("applies compact class when compact prop is true", () => {
    const wrapper = mount(StatusBadge, {
      props: { status: "running", compact: true },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /px-2/, "should have compact horizontal padding");
    assert.match(classes, /text-xs/, "should have compact font size");
  });

  it("applies regular spacing when compact prop is false", () => {
    const wrapper = mount(StatusBadge, {
      props: { status: "running", compact: false },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /px-3/, "should have regular horizontal padding");
    assert.match(classes, /text-sm/, "should have regular font size");
  });

  it("applies disabled styles when disabled prop is true", () => {
    const wrapper = mount(StatusBadge, {
      props: { status: "running", disabled: true },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /opacity-60/, "should have reduced opacity");
    assert.match(classes, /cursor-not-allowed/, "should have not-allowed cursor");
    assert.strictEqual(
      wrapper.attributes("aria-disabled"),
      "true",
      "should have aria-disabled attribute"
    );
  });

  it("does not have disabled styles when disabled prop is false", () => {
    const wrapper = mount(StatusBadge, {
      props: { status: "running", disabled: false },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /hover:shadow-sm/, "should have hover effects");
  });

  it("applies running animation only for running status", () => {
    const runningWrapper = mount(StatusBadge, {
      props: { status: "running" },
    });
    const runningDot = runningWrapper.find("span[class*='animate-pulse']");
    assert.match(runningDot.attributes("class"), /animate-pulse/);

    const completedWrapper = mount(StatusBadge, {
      props: { status: "completed" },
    });
    const completedDot = completedWrapper.find("span[class*='h-2']");
    assert.match(completedDot.attributes("class"), /animate-none/);
  });

  it("sets aria-busy attribute for running status", () => {
    const wrapper = mount(StatusBadge, {
      props: { status: "running" },
    });
    assert.strictEqual(wrapper.attributes("aria-busy"), "true");
  });

  it("sets aria-busy to false for non-running statuses", () => {
    const wrapper = mount(StatusBadge, {
      props: { status: "completed" },
    });
    assert.strictEqual(wrapper.attributes("aria-busy"), "false");
  });

  it("has role status for semantic accessibility", () => {
    const wrapper = mount(StatusBadge, {
      props: { status: "running" },
    });
    assert.strictEqual(wrapper.attributes("role"), "status");
  });

  it("all status types have consistent dot sizes", () => {
    const statuses: StatusType[] = ["running", "completed", "error", "pending", "idle"];

    statuses.forEach((status) => {
      const wrapper = mount(StatusBadge, {
        props: { status },
      });
      const dot = wrapper.find("span[class*='h-2']");
      assert.ok(dot.exists(), `${status} should have h-2 w-2 dot`);
      assert.match(dot.attributes("class"), /w-2/);
    });
  });

  it("supports focus ring styles for interactive focus states", () => {
    const wrapper = mount(StatusBadge, {
      props: { status: "running", disabled: false },
    });
    const classes = wrapper.attributes("class");
    assert.match(
      classes,
      /focus-within:ring-2/,
      "should have focus ring when not disabled"
    );
  });
});
