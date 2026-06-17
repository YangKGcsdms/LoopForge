import { ref, type Ref } from "vue";
import { api, type CatalogModel } from "../api/client";

/**
 * 模型目录 + 路由池拉取 —— 从 WorkflowForm 抽出，桌面版与 H5 版共用同一套加载逻辑。
 * 加载错误独立于运行错误（运行错误归 useRun.error），避免两者互相覆盖。
 */
export interface UseModels {
  models: Ref<CatalogModel[]>;
  modelSource: Ref<string>;
  modelNote: Ref<string>;
  poolRouting: Ref<Record<string, string> | null>;
  loadError: Ref<string>;
  load: (provider: string) => Promise<void>;
}

export function useModels(): UseModels {
  const models = ref<CatalogModel[]>([]);
  const modelSource = ref("");
  const modelNote = ref("");
  const poolRouting = ref<Record<string, string> | null>(null);
  const loadError = ref("");

  async function load(provider: string) {
    loadError.value = "";
    try {
      const res = await api.getModels(provider);
      models.value = res.models;
      modelSource.value = res.source;
      modelNote.value = res.note ?? "";
      poolRouting.value = res.routing ?? null;
    } catch (e) {
      loadError.value = `加载模型失败：${(e as Error).message}`;
    }
  }

  return { models, modelSource, modelNote, poolRouting, loadError, load };
}
