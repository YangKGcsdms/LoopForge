import { ref, type Ref } from "vue";
import { renderNodeOutput } from "../lib/format";

interface Subtask {
  id: string;
  title: string;
  estimateHours: number;
  acceptance: string;
}
interface NodeItem {
  kind: "node";
  key: string;
  id: string;
  nodeKind: string;
  status: string;
  iteration: number | null;
  full: string;
  typed: string;
}
interface PhaseItem {
  kind: "phase";
  key: string;
  name: string;
}
interface TodosItem {
  kind: "todos";
  key: string;
  subtasks: Subtask[];
}
type LiveItem = NodeItem | PhaseItem | TodosItem;

export interface UseRunState {
  running: Ref<boolean>;
  error: Ref<string>;
  live: Ref<LiveItem[]>;
  difficulty: Ref<{ value: string; reason: string | null } | null>;
  routing: Ref<Record<string, string> | null>;
  finalDone: Ref<{ todos: number; developed: number; decompose: string } | null>;
}

export interface UseRunActions {
  startRun: (params: {
    requirement: string;
    goal: string;
    provider: string;
    dryRun: boolean;
    cwd?: string;
  }) => void;
  cleanup: () => void;
}

export function useRun(): UseRunState & UseRunActions {
  const running = ref(false);
  const error = ref("");
  const live = ref<LiveItem[]>([]);
  const difficulty = ref<{ value: string; reason: string | null } | null>(null);
  const routing = ref<Record<string, string> | null>(null);
  const finalDone = ref<{ todos: number; developed: number; decompose: string } | null>(null);

  let es: EventSource | null = null;
  const queue: LiveItem[] = [];
  let typing = false;
  let seq = 0;
  let pending: { todos: number; developed: number; decompose: string } | null = null;

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  async function pump() {
    if (typing) return;
    typing = true;
    while (queue.length) {
      const item = queue.shift()!;
      if (item.kind === "node") {
        const full = item.full;
        live.value.push({ ...item, typed: "" });
        const idx = live.value.length - 1;
        for (let i = 0; i <= full.length; i++) {
          (live.value[idx] as NodeItem).typed = full.slice(0, i);
          await sleep(4);
        }
      } else {
        live.value.push(item);
        await sleep(40);
      }
    }
    typing = false;
    if (pending) {
      finalDone.value = pending;
      running.value = false;
    }
  }

  function cleanup() {
    if (es) {
      es.close();
      es = null;
    }
  }

  function startRun(params: {
    requirement: string;
    goal: string;
    provider: string;
    dryRun: boolean;
    cwd?: string;
  }) {
    cleanup();
    error.value = "";
    live.value = [];
    difficulty.value = null;
    routing.value = null;
    finalDone.value = null;
    queue.length = 0;
    pending = null;
    seq = 0;
    running.value = true;

    const queryParams = new URLSearchParams({
      requirement: params.requirement,
      goal: params.goal,
      provider: params.provider,
      dryRun: String(params.dryRun),
    });
    if (params.cwd?.trim()) queryParams.set("cwd", params.cwd.trim());

    es = new EventSource(`/api/run/pipeline/stream?${queryParams.toString()}`);

    es.addEventListener("difficulty", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        difficulty.value = { value: d.value, reason: d.reason };
      } catch (err) {
        console.error("Failed to parse difficulty event", err);
      }
    });

    es.addEventListener("routing", (e) => {
      try {
        routing.value = JSON.parse((e as MessageEvent).data);
      } catch (err) {
        console.error("Failed to parse routing event", err);
      }
    });

    es.addEventListener("phase", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        queue.push({ kind: "phase", key: `p${seq++}`, name: d.name });
        void pump();
      } catch (err) {
        console.error("Failed to parse phase event", err);
      }
    });

    es.addEventListener("todos", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        queue.push({ kind: "todos", key: `t${seq++}`, subtasks: d.subtasks });
        void pump();
      } catch (err) {
        console.error("Failed to parse todos event", err);
      }
    });

    es.addEventListener("node-end", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        queue.push({
          kind: "node",
          key: `n${seq++}`,
          id: d.id,
          nodeKind: d.kind,
          status: d.status,
          iteration: d.iteration ?? null,
          full: d.status === "error" ? `⚠ ${d.error ?? "节点报错"}` : renderNodeOutput(d),
          typed: "",
        });
        void pump();
      } catch (err) {
        console.error("Failed to parse node-end event", err);
      }
    });

    es.addEventListener("done", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        pending = { todos: d.todos, developed: d.developed, decompose: d.decompose };
        cleanup();
        if (!typing && queue.length === 0) {
          finalDone.value = pending;
          running.value = false;
        }
      } catch (err) {
        console.error("Failed to parse done event", err);
        error.value = "无法解析完成状态";
        cleanup();
        running.value = false;
      }
    });

    es.addEventListener("error", (e) => {
      const me = e as MessageEvent;
      if (me.data) {
        try {
          const parsed = JSON.parse(me.data);
          error.value = parsed.message || "运行出错";
        } catch {
          error.value = me.data || "运行出错";
        }
      } else if (running.value && !pending) {
        error.value = "连接中断";
      }
      cleanup();
      running.value = false;
    });
  }

  return {
    running,
    error,
    live,
    difficulty,
    routing,
    finalDone,
    startRun,
    cleanup,
  };
}
