import { computed, onMounted, onUnmounted, ref, type ComputedRef, type Ref } from "vue";

/**
 * 设备/视图识别 —— 浏览器(桌面)版与 H5(移动)版共存的唯一判定来源。
 *
 * 判定优先级（高 → 低）：
 *   1. 用户显式覆盖（手机 / 电脑）—— 存 localStorage，跨刷新生效；
 *   2. URL `?view=` 参数（h5 / m / mobile | pc / desktop / web）—— 便于分享指定版本的链接；
 *   3. 自动识别 = 移动 UA  或  视口宽度 < 阈值。
 *
 * 自动模式下监听 resize，桌面缩窄到阈值以内会实时切到 H5（反之亦然）。
 */

export type ViewMode = "auto" | "mobile" | "desktop";

/** < md(768) 视为移动端；与 Tailwind 默认断点对齐。 */
export const MOBILE_MAX_WIDTH = 768;
const STORAGE_KEY = "loopforge:view-mode";

const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Silk|Kindle|HarmonyOS/i;

/** UA 串是否像移动端（纯函数，便于测试）。 */
export function isMobileUserAgent(ua: string): boolean {
  return MOBILE_UA.test(ua || "");
}

/** 归一化 URL `?view=` 参数到 ViewMode；不认得则 null。 */
export function normalizeQueryMode(raw: string | null): ViewMode | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "h5" || v === "m" || v === "mobile") return "mobile";
  if (v === "pc" || v === "desktop" || v === "web") return "desktop";
  return null;
}

/** 决定初始模式：URL 参数 > localStorage > auto（纯函数）。 */
export function pickInitialMode(queryRaw: string | null, savedRaw: string | null): ViewMode {
  const fromQuery = normalizeQueryMode(queryRaw);
  if (fromQuery) return fromQuery;
  if (savedRaw === "mobile" || savedRaw === "desktop" || savedRaw === "auto") return savedRaw;
  return "auto";
}

/** 综合用户覆盖与自动信号，得出是否渲染 H5 版（纯函数，核心判定）。 */
export function resolveIsMobile(
  mode: ViewMode,
  signals: { uaMobile: boolean; width: number; threshold?: number },
): boolean {
  if (mode === "mobile") return true;
  if (mode === "desktop") return false;
  return signals.uaMobile || signals.width < (signals.threshold ?? MOBILE_MAX_WIDTH);
}

function detectUaMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return isMobileUserAgent(navigator.userAgent || "");
}

function readInitialMode(): ViewMode {
  if (typeof window === "undefined") return "auto";
  const queryRaw = new URLSearchParams(window.location.search).get("view");
  const savedRaw = window.localStorage?.getItem(STORAGE_KEY) ?? null;
  return pickInitialMode(queryRaw, savedRaw);
}

export interface UseDevice {
  /** 当前模式：auto / mobile / desktop。 */
  mode: Ref<ViewMode>;
  /** 最终是否渲染 H5 版（已综合覆盖与自动识别）。 */
  isMobile: ComputedRef<boolean>;
  /** 纯自动识别的结果（不含用户覆盖）—— 用于 UI 提示"自动判定为…"。 */
  autoIsMobile: ComputedRef<boolean>;
  /** 设备 UA 是否为移动端。 */
  uaMobile: ComputedRef<boolean>;
  /** 显式设定模式（持久化，并清掉 URL 里的 view 参数避免再次抢占）。 */
  setMode: (m: ViewMode) => void;
  /** 在 手机版 / 电脑版 之间一键互切（显式）。 */
  toggle: () => void;
}

export function useDevice(): UseDevice {
  const mode = ref<ViewMode>(readInitialMode());
  const width = ref(typeof window !== "undefined" ? window.innerWidth : 1280);
  const ua = ref(detectUaMobile());

  const autoIsMobile = computed(() => resolveIsMobile("auto", { uaMobile: ua.value, width: width.value }));
  const isMobile = computed(() => resolveIsMobile(mode.value, { uaMobile: ua.value, width: width.value }));

  function onResize() {
    width.value = window.innerWidth;
  }

  onMounted(() => {
    width.value = window.innerWidth;
    window.addEventListener("resize", onResize, { passive: true });
  });
  onUnmounted(() => {
    if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
  });

  function setMode(m: ViewMode) {
    mode.value = m;
    try {
      if (m === "auto") window.localStorage?.removeItem(STORAGE_KEY);
      else window.localStorage?.setItem(STORAGE_KEY, m);
    } catch {
      /* 隐私模式下 localStorage 可能抛错，忽略即可——本次仍生效 */
    }
    // 清掉 URL 的 view 参数：否则刷新后它会再次抢占用户随后的手动选择。
    if (typeof window !== "undefined" && window.history?.replaceState) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("view")) {
        url.searchParams.delete("view");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }

  function toggle() {
    setMode(isMobile.value ? "desktop" : "mobile");
  }

  return {
    mode,
    isMobile,
    autoIsMobile,
    uaMobile: computed(() => ua.value),
    setMode,
    toggle,
  };
}
