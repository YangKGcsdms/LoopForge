import { ref } from "vue";
import { api } from "../api/client";

/**
 * 全局所选 Provider/SDK 状态（模块级单例，跨组件共享）。
 * - 启动时从后端读取已落库的偏好
 * - 切换时写回后端持久化
 * 这样「运行页」「配置页」共用同一选择，路由卡片随之跟随。
 */
const provider = ref<string>("cursor");
let loaded = false;
let loadingPromise: Promise<void> | null = null;

async function load(): Promise<void> {
  if (loaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const prefs = await api.getPreferences();
      if (prefs?.provider) provider.value = prefs.provider;
    } catch {
      // 后端不可用时静默回落默认值
    } finally {
      loaded = true;
    }
  })();
  return loadingPromise;
}

async function setProvider(next: string): Promise<void> {
  if (next === provider.value) return;
  provider.value = next;
  try {
    await api.savePreferences({ provider: next });
  } catch {
    // 落库失败不阻塞前端切换
  }
}

export function useProvider() {
  return { provider, load, setProvider };
}
