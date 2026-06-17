import { ref, watch, type Ref } from "vue";
import { renderNodeOutput } from "../lib/format";

/** 展示状态快照的本地存储键：用于刷新/H5 重开后还原运行结果。 */
const SNAPSHOT_KEY = "loopforge:run-snapshot";

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
  /** 当前运行 id（后端 run-started 事件回传），用于断点续跑。 */
  runId: Ref<string>;
}

export interface RunParams {
  requirement: string;
  goal: string;
  provider: string;
  dryRun: boolean;
  cwd?: string;
  /** 续跑已有运行 id；不传则新建。 */
  resume?: string;
}

export interface UseRunActions {
  startRun: (params: RunParams) => void;
  /** 用上次参数 + 当前 runId 断点续跑。 */
  resumeRun: () => void;
  cleanup: () => void;
}

export function useRun(): UseRunState & UseRunActions {
  const running = ref(false);
  const error = ref("");
  const live = ref<LiveItem[]>([]);
  const difficulty = ref<{ value: string; reason: string | null } | null>(null);
  const routing = ref<Record<string, string> | null>(null);
  const finalDone = ref<{ todos: number; developed: number; decompose: string } | null>(null);
  const runId = ref("");
  let lastParams: RunParams | null = null;

  // ── 刷新/H5 重开还原：启动时从 localStorage 恢复上次展示快照 ──
  hydrateFromSnapshot();

  function hydrateFromSnapshot() {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as {
        live?: LiveItem[];
        difficulty?: typeof difficulty.value;
        routing?: typeof routing.value;
        finalDone?: typeof finalDone.value;
        runId?: string;
        error?: string;
        wasRunning?: boolean;
        lastParams?: RunParams | null;
      };
      // 还原节点时直接显示完整文本，不再重播打字机
      live.value = (snap.live ?? []).map((it) =>
        it.kind === "node" ? { ...it, typed: it.full } : it,
      );
      difficulty.value = snap.difficulty ?? null;
      routing.value = snap.routing ?? null;
      finalDone.value = snap.finalDone ?? null;
      runId.value = snap.runId ?? "";
      lastParams = snap.lastParams ?? null;
      // 运行态一律复位（SSE 连接已随刷新断开）；若上次确实在跑且没出结果，给个提示
      running.value = false;
      if (snap.error) error.value = snap.error;
      else if (snap.wasRunning && !snap.finalDone)
        error.value = "页面已刷新，实时连接中断。点「断点续跑」可从已完成步骤继续。";
    } catch {
      // 快照损坏忽略
    }
  }

  function persistSnapshot() {
    try {
      const snap = {
        live: live.value.map((it) =>
          it.kind === "node" ? { ...it, typed: it.full } : it,
        ),
        difficulty: difficulty.value,
        routing: routing.value,
        finalDone: finalDone.value,
        runId: runId.value,
        error: error.value,
        wasRunning: running.value,
        lastParams,
      };
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
    } catch {
      // localStorage 不可用（隐私模式/超额）忽略
    }
  }

  // 展示状态有实质变化就存快照（不逐字存，typed 还原时统一置满）
  watch(
    [() => live.value.length, difficulty, routing, finalDone, runId, running, error],
    persistSnapshot,
    { deep: true },
  );

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

  function startRun(params: RunParams) {
    cleanup();
    lastParams = params;
    error.value = "";
    live.value = [];
    difficulty.value = null;
    routing.value = null;
    finalDone.value = null;
    queue.length = 0;
    pending = null;
    seq = 0;
    running.value = true;
    // 续跑时保留已知 runId；新跑清空，等 run-started 回传。
    if (!params.resume) runId.value = "";

    const queryParams = new URLSearchParams({
      requirement: params.requirement,
      goal: params.goal,
      provider: params.provider,
      dryRun: String(params.dryRun),
    });
    if (params.cwd?.trim()) queryParams.set("cwd", params.cwd.trim());
    if (params.resume) queryParams.set("resume", params.resume);

    es = new EventSource(`/api/run/pipeline/stream?${queryParams.toString()}`);

    es.addEventListener("run-started", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        if (d.runId) runId.value = d.runId;
      } catch (err) {
        console.error("Failed to parse run-started event", err);
      }
    });

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

  function resumeRun() {
    if (!lastParams || !runId.value) return;
    startRun({ ...lastParams, resume: runId.value });
  }

  return {
    running,
    error,
    live,
    difficulty,
    routing,
    finalDone,
    runId,
    startRun,
    resumeRun,
    cleanup,
  };
}
