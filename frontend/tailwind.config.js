import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      // ============================================================================
      // 设计 Token 系统：完整的颜色/间距/圆角/阴影/字体层级
      // ============================================================================
      // 命名规则：统一使用 Tailwind CSS 的语义化色板 + 文化语境
      // 颜色：primary(主)/accent(强调)/neutral(中性) + 状态色 success/warning/error/info
      // 间距：遵循 4px 基线倍数（4,8,12,16,20,24,28,32...）
      // 圆角：sm(4px)/base(6px)/lg(8px)/xl(12px)/2xl(16px)
      // 阴影：文件容器/悬浮/深度分级
      // 字体：标题/正文/代码，含行高与字重

      colors: {
        // ─ 主色调（暖色账本中性 · Anthropic 暖纸风）
        //   将原 slate 冷灰 ramp 重映射为暖纸/暖墨色谱，
        //   现有所有 slate-* class 自动继承暖色外观。
        slate: {
          50: "#faf9f5", // surface（卡片底）
          100: "#efece2", // surface-2（次级底）
          200: "#e4ded1", // hairline border
          300: "#d2cabb", // border-strong
          400: "#c2b7ad", // ink4（最浅文字/占位）
          500: "#9b8f84", // ink3（弱文字）
          600: "#6b5f54", // ink2（次级文字）
          700: "#4a4138", // 正文加重
          800: "#36302a", // 标题
          900: "#2a221c", // ink（最深墨）
        },
        // ─ 品牌强调色（terracotta 陶土橙）
        //   原 violet ramp 重映射为陶土色，作为主品牌/链接/焦点色。
        violet: {
          50: "#faf3ef",
          100: "#f3e1d6", // brand-bg
          200: "#e8c5a8", // brand-soft
          300: "#dba788",
          400: "#d08a63",
          500: "#c96442", // brand（主）
          600: "#c96442", // brand（主，按钮）
          700: "#8a3f24", // brand-ink（hover/加深）
          800: "#74351f",
          900: "#5e2b1a",
        },
        // ─ 暖纸背景基底
        paper: "#f5f4ed",
        // ─ 状态色：成功（账本绿 · 哑光）
        emerald: {
          50: "#eef4ee",
          100: "#dde9df",
          200: "#bcd3c0",
          300: "#92b899",
          400: "#5e9669",
          500: "#1a8754",
          600: "#177a4b",
          700: "#136540",
          800: "#0f4f33",
          900: "#0c3d28",
        },
        // ─ 状态色：警告（账本琥珀 · 哑光）
        amber: {
          50: "#faf3e6",
          100: "#f3e6cc",
          200: "#e6cd99",
          300: "#d6b066",
          400: "#c89a47",
          500: "#c08a3c",
          600: "#a87633",
          700: "#8a5f29",
          800: "#6e4c21",
          900: "#573c1a",
        },
        // ─ 状态色：错误（账本红 · 哑光）
        rose: {
          50: "#f7eceb",
          100: "#efd8d7",
          200: "#deb1b0",
          300: "#cd8a89",
          400: "#c06564",
          500: "#b54545",
          600: "#a03b3b",
          700: "#833030",
          800: "#682727",
          900: "#531f1f",
        },
        // ─ 状态色：信息（哑光石蓝，去冷调）
        sky: {
          50: "#eef1f3",
          100: "#dde3e7",
          200: "#bcc8cf",
          300: "#92a5b0",
          400: "#6c8290",
          500: "#516975",
          600: "#465a64",
          700: "#3a4a52",
          800: "#2f3b42",
          900: "#262f34",
        },
        // ─ 配套色：靛蓝（用于强调标签）
        indigo: {
          50: "#f0f4ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },

      spacing: {
        // ─ 基线间距：4px 倍数（0~128px 已内置，补充常用偏差）
        // 使用场景：padding/margin/width/height/gap/inset
        // 示例：px-2 → 8px / py-6 → 24px
        0: "0",
        1: "0.25rem", // 4px
        2: "0.5rem", // 8px
        3: "0.75rem", // 12px
        4: "1rem", // 16px
        5: "1.25rem", // 20px
        6: "1.5rem", // 24px
        7: "1.75rem", // 28px
        8: "2rem", // 32px
        9: "2.25rem", // 36px
        10: "2.5rem", // 40px
        12: "3rem", // 48px
        16: "4rem", // 64px
        20: "5rem", // 80px
        24: "6rem", // 96px
      },

      borderRadius: {
        // ─ 圆角层级（递进式：小→大）
        sm: "0.25rem", // 4px（input/small badge）
        base: "0.375rem", // 6px（按钮）
        md: "0.5rem", // 8px（卡片）
        lg: "0.75rem", // 12px（大卡片/容器）
        xl: "1rem", // 16px（模态框）
        "2xl": "1.25rem", // 20px（页面容器）
        full: "9999px", // 完全圆形
      },

      boxShadow: {
        // ─ 阴影分级（表达视觉深度）
        // xs: 极浅（hint/disabled）
        // sm: 浅（default button/input focus）
        // base/md: 中（card/panel）
        // lg/xl: 深（popover/dropdown/modal）
        // 2xl/3xl: 最深（高悬浮）
        none: "none",
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1)",
        base: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        "3xl": "0 35px 60px -15px rgba(0, 0, 0, 0.3)",
        inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",
      },

      fontSize: {
        // ─ 字体层级（含行高）
        // 命名：xs/sm/base/lg/xl/2xl/3xl
        // 用途：标题(lg~3xl) / 正文(base/sm) / 辅助(xs)
        xs: ["0.75rem", { lineHeight: "1rem" }], // 12px / 16px
        sm: ["0.875rem", { lineHeight: "1.25rem" }], // 14px / 20px
        base: ["1rem", { lineHeight: "1.5rem" }], // 16px / 24px
        lg: ["1.125rem", { lineHeight: "1.75rem" }], // 18px / 28px
        xl: ["1.25rem", { lineHeight: "1.75rem" }], // 20px / 28px
        "2xl": ["1.5rem", { lineHeight: "2rem" }], // 24px / 32px
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }], // 30px / 36px
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }], // 36px / 40px
      },

      fontFamily: {
        // ─ 字体栈
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          '"Noto Sans"',
          "sans-serif",
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ], // 正文
        mono: [
          '"JetBrains Mono"',
          '"SF Mono"',
          "Monaco",
          "Inconsolata",
          '"Fira Code"',
          '"Droid Sans Mono"',
          '"Source Code Pro"',
          "monospace",
        ], // 代码
        serif: [
          '"Source Serif 4"',
          '"Noto Serif SC"',
          "Georgia",
          "Cambria",
          "serif",
        ], // 标题/数字（衬线强调）
      },

      fontWeight: {
        // ─ 字重梯度
        light: "300",
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },

      letterSpacing: {
        // ─ 字间距（用于强调标题/标签）
        tighter: "-0.05em",
        tight: "-0.025em",
        normal: "0em",
        wide: "0.025em",
        wider: "0.05em",
        widest: "0.1em", // 用于全大写标签
      },

      transitionDuration: {
        // ─ 动画时长
        75: "75ms",
        100: "100ms",
        150: "150ms",
        200: "200ms",
        300: "300ms",
        500: "500ms",
      },

      opacity: {
        // ─ 不透明度（disabled/hover/focus 等状态）
        0: "0",
        5: "0.05",
        10: "0.1",
        20: "0.2",
        30: "0.3",
        40: "0.4",
        50: "0.5",
        60: "0.6",
        70: "0.7",
        80: "0.8",
        90: "0.9",
        95: "0.95",
        100: "1",
      },

      zIndex: {
        // ─ 堆叠顺序
        0: "0",
        10: "10",
        20: "20",
        30: "30",
        40: "40",
        50: "50",
        auto: "auto",
      },
    },
  },
  plugins: [typography],
};
