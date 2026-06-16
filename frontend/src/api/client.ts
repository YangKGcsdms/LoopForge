/** 与后端 API 壳对接的轻量客户端。所有路径走 /api，由 Vite 代理到后端。 */

export interface ProviderInfo {
  id: string;
  displayName: string;
  supported: boolean;
  note?: string;
}

export interface SkStatus {
  provider: string;
  configured: boolean;
  maskedKey?: string;
  updatedAt?: string;
  source?: "store" | "env";
}

export interface ValidateResult {
  provider: string;
  valid: boolean;
  detail: string;
  identity?: { apiKeyName?: string; userEmail?: string };
}

export interface CatalogModel {
  id: string;
  displayName: string;
  tier: "cheap" | "mid" | "strong";
  /** 实时可用性：true 可用 / false 被禁用 / null 未知（未配 SK）。 */
  available?: boolean | null;
}

export interface ModelsResponse {
  source: "live" | "fallback";
  provider?: string;
  models: CatalogModel[];
  routing?: Record<string, string>;
  note?: string;
}

export interface RunPipelineBody {
  requirement: string;
  goal: string;
  cwd?: string;
  dryRun?: boolean;
  provider?: string;
}

export interface Subtask {
  id: string;
  title: string;
  estimateHours: number;
  acceptance: string;
}

export interface PipelineRunResult {
  dryRun: boolean;
  difficulty: { value: "easy" | "medium" | "hard"; reason: string | null };
  routing: Record<string, string>;
  plan: {
    approach: string;
    keyDecisions: string[];
    risks: string[];
    phases: string[];
    acceptance: string[];
    openQuestions: string[];
  } | null;
  decompose: { status: string; iterations: number; subtasks: Subtask[] };
  todos: Array<{ subtask: Subtask; status: string; iterations: number }>;
  developed: number;
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message ?? data.detail ?? data.error ?? `HTTP ${res.status}`) as string;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  listProviders: () => http<{ providers: ProviderInfo[] }>("/api/config/providers"),

  getSkStatus: (provider: string) =>
    http<SkStatus>(`/api/config/sk?provider=${encodeURIComponent(provider)}`),

  saveSk: (provider: string, apiKey: string) =>
    http<SkStatus & { ok: boolean }>("/api/config/sk", {
      method: "PUT",
      body: JSON.stringify({ provider, apiKey }),
    }),

  clearSk: (provider: string) =>
    http<{ ok: boolean }>(`/api/config/sk?provider=${encodeURIComponent(provider)}`, {
      method: "DELETE",
    }),

  validateSk: (provider: string, apiKey?: string) =>
    http<ValidateResult>("/api/config/sk/validate", {
      method: "POST",
      body: JSON.stringify({ provider, apiKey }),
    }),

  getModels: (provider = "cursor") =>
    http<ModelsResponse>(`/api/models?provider=${encodeURIComponent(provider)}`),

  runPipeline: (body: RunPipelineBody) =>
    http<PipelineRunResult>("/api/run/pipeline", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
