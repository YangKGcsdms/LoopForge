/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      // ============================================================================
      // 设计 Token —— 暖色账本 / Anthropic 编辑风（取自 carter_book）
      //   颜色全部绑定到 style.css 的 CSS 变量，[data-theme=dark] 切换变量即整站换肤，
      //   无需 Tailwind dark: 变体。语义命名：paper/surface/ink/hair/brand/up/down + 暖色 accent。
      // ============================================================================
      colors: {
        // 表面（暖羊皮纸三层）
        paper: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        // 墨色阶
        ink: "var(--ink)",
        ink2: "var(--ink2)",
        ink3: "var(--ink3)",
        ink4: "var(--ink4)",
        // 发丝线
        hair: "var(--border)",
        "hair-soft": "var(--border-soft)",
        "hair-strong": "var(--border-strong)",
        // 品牌 terracotta（单点聚焦）
        brand: "var(--brand)",
        "brand-soft": "var(--brand-soft)",
        "brand-bg": "var(--brand-bg)",
        "brand-ink": "var(--brand-ink)",
        // 账本红绿
        up: "var(--up)",
        "up-bg": "var(--up-bg)",
        down: "var(--down)",
        "down-bg": "var(--down-bg)",
        // 暖色 accent ramp
        "acc-amber": "var(--acc-amber)",
        "acc-olive": "var(--acc-olive)",
        "acc-clay": "var(--acc-clay)",
        "acc-sage": "var(--acc-sage)",
        "acc-sienna": "var(--acc-sienna)",
        "acc-stone": "var(--acc-stone)",
        "acc-mauve": "var(--acc-mauve)",
      },

      fontFamily: {
        serif: ['"Source Serif 4"', '"Noto Serif SC"', "Georgia", "serif"],
        sans: ['"Inter"', "-apple-system", '"PingFang SC"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"SF Mono"', "Menlo", "ui-monospace", "monospace"],
      },

      borderRadius: {
        // 克制：圆角 ≤ 12px
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        full: "9999px",
      },

      letterSpacing: {
        tight: "-0.02em",
        normal: "0em",
        wide: "0.02em",
        caps: "0.12em",
        kicker: "0.18em",
      },

      transitionTimingFunction: {
        ease: "cubic-bezier(0.2, 0, 0, 1)",
      },
    },
  },
  plugins: [],
};
