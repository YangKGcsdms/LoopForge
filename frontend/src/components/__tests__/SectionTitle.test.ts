import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import SectionTitle, { type HeadingLevel } from "../SectionTitle.vue";

describe("SectionTitle", () => {
  it("renders the title text", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Test Title" },
    });
    assert.match(wrapper.text(), /Test Title/);
  });

  describe("heading levels", () => {
    const levels: HeadingLevel[] = ["h1", "h2", "h3", "h4", "h5", "h6"];

    levels.forEach((level) => {
      it(`renders as ${level} element with correct size classes`, () => {
        const wrapper = mount(SectionTitle, {
          props: { title: "Test", level },
        });
        const heading = wrapper.find(level);
        assert.ok(heading.exists(), `should render ${level} element`);

        const classes = heading.attributes("class");
        switch (level) {
          case "h1":
            assert.match(classes, /text-4xl/, "h1 should have text-4xl");
            assert.match(classes, /font-bold/, "h1 should have font-bold");
            break;
          case "h2":
            assert.match(classes, /text-3xl/, "h2 should have text-3xl");
            assert.match(classes, /font-semibold/, "h2 should have font-semibold");
            break;
          case "h3":
            assert.match(classes, /text-2xl/, "h3 should have text-2xl");
            assert.match(classes, /font-semibold/, "h3 should have font-semibold");
            break;
          case "h4":
            assert.match(classes, /text-xl/, "h4 should have text-xl");
            assert.match(classes, /font-semibold/, "h4 should have font-semibold");
            break;
          case "h5":
            assert.match(classes, /text-lg/, "h5 should have text-lg");
            assert.match(classes, /font-medium/, "h5 should have font-medium");
            break;
          case "h6":
            assert.match(classes, /text-base/, "h6 should have text-base");
            assert.match(classes, /font-medium/, "h6 should have font-medium");
            break;
        }
      });
    });
  });

  it("renders description when provided", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title", description: "This is a description" },
    });
    assert.match(wrapper.text(), /This is a description/);
  });

  it("does not render description when not provided", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title" },
    });
    const description = wrapper.find("p");
    assert.strictEqual(description.exists(), false, "should not render p tag when no description");
  });

  it("renders divider by default", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /border-b/, "should have border-b by default");
  });

  it("does not render divider when divider prop is false", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title", divider: false },
    });
    const classes = wrapper.attributes("class");
    assert.strictEqual(
      classes.includes("border-b"),
      false,
      "should not have border-b when divider is false"
    );
  });

  describe("divider colors", () => {
    const colors = ["neutral", "subtle", "accent"] as const;

    colors.forEach((color) => {
      it(`applies correct divider color for ${color}`, () => {
        const wrapper = mount(SectionTitle, {
          props: { title: "Title", divider: true, dividerColor: color },
        });
        const classes = wrapper.attributes("class");
        const colorMap = {
          neutral: "border-slate-200",
          subtle: "border-slate-100",
          accent: "border-slate-300",
        };
        assert.match(classes, new RegExp(colorMap[color]), `should have ${colorMap[color]}`);
      });
    });
  });

  describe("spacing", () => {
    const spacings = ["sm", "md", "lg"] as const;

    spacings.forEach((spacing) => {
      it(`applies correct spacing for ${spacing}`, () => {
        const wrapper = mount(SectionTitle, {
          props: { title: "Title", spacing },
        });
        const classes = wrapper.attributes("class");
        const spacingMap = {
          sm: "pb-2",
          md: "pb-4",
          lg: "pb-6",
        };
        assert.match(classes, new RegExp(spacingMap[spacing]), `should have ${spacingMap[spacing]}`);
      });
    });
  });

  it("applies disabled styles when disabled prop is true", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title", description: "Description", disabled: true },
    });
    const heading = wrapper.find("h2");
    const headingClasses = heading.attributes("class");
    assert.match(headingClasses, /opacity-60/, "heading should have reduced opacity");
    assert.match(headingClasses, /text-slate-400/, "heading should have gray text");

    const description = wrapper.find("p");
    const descriptionClasses = description.attributes("class");
    assert.match(descriptionClasses, /opacity-60/, "description should have reduced opacity");
    assert.match(descriptionClasses, /text-slate-400/, "description should have gray text");

    assert.strictEqual(
      heading.attributes("aria-disabled"),
      "true",
      "should have aria-disabled attribute"
    );
  });

  it("applies normal styles when disabled prop is false", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title", description: "Description", disabled: false },
    });
    const heading = wrapper.find("h2");
    const headingClasses = heading.attributes("class");
    assert.match(headingClasses, /text-slate-900/, "heading should have normal text color");

    const description = wrapper.find("p");
    const descriptionClasses = description.attributes("class");
    assert.match(descriptionClasses, /text-slate-600/, "description should have normal text color");

    assert.strictEqual(
      heading.attributes("aria-disabled"),
      "false",
      "should have aria-disabled=false"
    );
  });

  it("supports prefix slot for icon or decoration before title", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title" },
      slots: {
        prefix: "🎯",
      },
    });
    assert.match(wrapper.text(), /🎯/);
    assert.match(wrapper.text(), /Title/);
  });

  it("supports suffix slot for icon or decoration after title", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title" },
      slots: {
        suffix: "✨",
      },
    });
    assert.match(wrapper.text(), /Title/);
    assert.match(wrapper.text(), /✨/);
  });

  it("supports default slot for additional content", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title" },
      slots: {
        default: "<div>Additional content</div>",
      },
    });
    assert.match(wrapper.text(), /Additional content/);
  });

  it("default level is h2", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title" },
    });
    const h2 = wrapper.find("h2");
    assert.ok(h2.exists(), "should default to h2");
  });

  it("default divider is true", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /border-b/, "divider should be enabled by default");
  });

  it("default dividerColor is neutral", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title", divider: true },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /border-slate-200/, "should use neutral color by default");
  });

  it("default spacing is md", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title" },
    });
    const classes = wrapper.attributes("class");
    assert.match(classes, /pb-4/, "should use md spacing by default");
  });

  it("title hierarchy is maintained across levels", () => {
    const h1 = mount(SectionTitle, { props: { title: "Title", level: "h1" } }).find("h1");
    const h2 = mount(SectionTitle, { props: { title: "Title", level: "h2" } }).find("h2");
    const h3 = mount(SectionTitle, { props: { title: "Title", level: "h3" } }).find("h3");

    const h1Classes = h1.attributes("class");
    const h2Classes = h2.attributes("class");
    const h3Classes = h3.attributes("class");

    assert.match(h1Classes, /text-4xl/, "h1 should be largest");
    assert.match(h2Classes, /text-3xl/, "h2 should be medium");
    assert.match(h3Classes, /text-2xl/, "h3 should be smaller");
  });

  it("respects focus states for accessibility (h2 with aria-disabled)", () => {
    const wrapper = mount(SectionTitle, {
      props: { title: "Title", disabled: false },
    });
    const heading = wrapper.find("h2");
    assert.strictEqual(heading.attributes("aria-disabled"), "false");
  });
});
