import { onMounted, onUnmounted, ref, type Ref } from "vue";

/**
 * 主题（明 / 暗 / 自动）—— 暖色账本配色的换肤开关，桌面与 H5 共用。
 * 实际换肤靠 <html data-theme> 切换 style.css 的 CSS 变量；这里只管状态与持久化。
 * 首帧防闪在 index.html 的内联脚本里已做，这里负责后续交互与 theme-color 同步。
 */

export type Theme = "auto" | "light" | "dark";

const STORAGE_KEY = "loopforge:theme";
const THEME_COLOR = { light: "#f5f4ed", dark: "#1c1a17" };

const ORDER: Theme[] = ["auto", "light", "dark"];
export function nextTheme(t: Theme): Theme {
  return ORDER[(ORDER.indexOf(t) + 1) % ORDER.length];
}

export const THEME_ICON: Record<Theme, string> = { auto: "◐", light: "○", dark: "●" };
export const THEME_LABEL: Record<Theme, string> = { auto: "自动", light: "浅色", dark: "深色" };

function readInitial(): Theme {
  if (typeof window === "undefined") return "auto";
  const raw = window.localStorage?.getItem(STORAGE_KEY);
  return raw === "light" || raw === "dark" || raw === "auto" ? raw : "auto";
}

function isDark(t: Theme): boolean {
  if (t === "dark") return true;
  if (t === "light") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function syncThemeColor(t: Theme) {
  if (typeof document === "undefined") return;
  const color = isDark(t) ? THEME_COLOR.dark : THEME_COLOR.light;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => (m.content = color));
}

export interface UseTheme {
  theme: Ref<Theme>;
  cycle: () => void;
}

export function useTheme(): UseTheme {
  const theme = ref<Theme>(readInitial());

  function apply(t: Theme) {
    if (typeof document !== "undefined") document.documentElement.dataset.theme = t;
    try {
      window.localStorage?.setItem(STORAGE_KEY, t);
    } catch {
      /* 隐私模式忽略 */
    }
    syncThemeColor(t);
  }

  function cycle() {
    theme.value = nextTheme(theme.value);
    apply(theme.value);
  }

  // auto 模式下跟随系统变化刷新 theme-color
  let mq: MediaQueryList | null = null;
  const onSystemChange = () => {
    if (theme.value === "auto") syncThemeColor("auto");
  };

  onMounted(() => {
    apply(theme.value);
    mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onSystemChange);
  });
  onUnmounted(() => mq?.removeEventListener("change", onSystemChange));

  return { theme, cycle };
}
