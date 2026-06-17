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

/** 运行中节点的内部 SDK session 转写条目（类 GUI Claude Code）。 */
export type StreamEntry =
  | { t: "say"; text: string }
  | { t: "think"; text: string }
  | { t: "tool"; tool: string; input: string; ok: boolean | null; preview?: string }
  | { t: "ask"; question: string };

/** 当前正在跑的节点的实时态（think/act 都有，act 才有 entries 流）。 */
export interface ActiveNode {
  id: string;
  kind: string;
  iteration: number | null;
  /** starting=刚进入还没产出（显示加载态）；running=已在流式产出。 */
  status: "starting" | "running";
  entries: StreamEntry[];
}

export interface UseRunState {
  /** 当前运行中的节点（含 think，按进入顺序）；空数组=当前没有在跑的节点。 */
  activeNodes: Ref<ActiveNode[]>;
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
  const activeNodes = ref<ActiveNode[]>([]);
  let lastParams: RunParams | null = null;
  // 刷新时若上次正在跑：记下重连参数，待 startRun 定义后自动重连（不能在此处直接调，TDZ）
  let reconnectParams: RunParams | null = null;

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
      // 上次正在跑且没出结果 → 自动重连：后端 run 与连接已解耦，重连会回放进度并接着实时跑。
      // （hub 里还活着就无缝续看；进程重启/已收尾则退化为从 checkpoint 断点续跑。）
      if (snap.wasRunning && !snap.finalDone && lastParams && runId.value) {
        running.value = true;
        reconnectParams = { ...lastParams, resume: runId.value };
      } else {
        running.value = false;
        if (snap.error) error.value = snap.error;
      }
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
  // 重连/续跑时，回放的历史事件直接显示完整（不逐字重打），只对其后的实时事件用打字机。
  let fastForwardUntil = 0;
  // 连接意外断开（非刷新）时的自动重连计数；run 与连接已解耦，重连只是重新订阅。
  let reconnectAttempts = 0;

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  async function pump() {
    if (typing) return;
    typing = true;
    while (queue.length) {
      const item = queue.shift()!;
      const fast = Date.now() < fastForwardUntil;
      if (item.kind === "node") {
        const full = item.full;
        if (fast) {
          live.value.push({ ...item, typed: full }); // 回放：秒显完整
          continue;
        }
        live.value.push({ ...item, typed: "" });
        const idx = live.value.length - 1;
        for (let i = 0; i <= full.length; i++) {
          (live.value[idx] as NodeItem).typed = full.slice(0, i);
          await sleep(4);
        }
      } else {
        live.value.push(item);
        await sleep(fast ? 0 : 40);
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

  /** 把工具入参压成一行展示文本。 */
  function fmtToolInput(tool: string, input: unknown): string {
    const o = (input ?? {}) as Record<string, unknown>;
    if (tool === "Bash" && typeof o.command === "string") return o.command;
    if (typeof o.file_path === "string") return o.file_path;
    try {
      return JSON.stringify(o).slice(0, 120);
    } catch {
      return "";
    }
  }

  /** 找当前运行中节点（按 id + iteration）。 */
  function findActive(id: string, iteration: number | null): ActiveNode | undefined {
    return activeNodes.value.find((n) => n.id === id && n.iteration === iteration);
  }

  /** 节点进入：立刻登记为 starting（含 think 节点），前端据此显示加载态。 */
  function nodeStart(d: { id: string; kind: string; iteration: number | null }) {
    if (findActive(d.id, d.iteration)) return;
    activeNodes.value.push({ id: d.id, kind: d.kind, iteration: d.iteration, status: "starting", entries: [] });
  }

  /** 节点结束：从运行中列表移除（产出会进入下方时间线）。 */
  function nodeEnd(id: string) {
    activeNodes.value = activeNodes.value.filter((n) => n.id !== id);
  }

  /** 收到一条内部 SDK 流式事件：建/更新对应运行中节点的转写。 */
  function applyStreamEvent(d: {
    nodeId: string;
    kind: string;
    iteration: number | null;
    event: { kind: string; delta?: string; tool?: string; input?: unknown; ok?: boolean | null; preview?: string; question?: string };
  }) {
    let node = findActive(d.nodeId, d.iteration);
    if (!node) {
      node = { id: d.nodeId, kind: d.kind, iteration: d.iteration, status: "running", entries: [] };
      activeNodes.value.push(node);
    }
    node.status = "running";
    const ev = d.event;
    const entries = node.entries;
    const last = entries[entries.length - 1];
    if (ev.kind === "text") {
      if (last && last.t === "say") last.text += ev.delta ?? "";
      else entries.push({ t: "say", text: ev.delta ?? "" });
    } else if (ev.kind === "thinking") {
      if (last && last.t === "think") last.text += ev.delta ?? "";
      else entries.push({ t: "think", text: ev.delta ?? "" });
    } else if (ev.kind === "tool_use") {
      entries.push({ t: "tool", tool: ev.tool ?? "?", input: fmtToolInput(ev.tool ?? "", ev.input), ok: null });
    } else if (ev.kind === "tool_result") {
      // 回填最近一个还没有结果的工具调用
      for (let i = entries.length - 1; i >= 0; i--) {
        const en = entries[i];
        if (en.t === "tool" && en.ok === null) {
          en.ok = ev.ok ?? null;
          en.preview = ev.preview;
          break;
        }
      }
    } else if (ev.kind === "ask_human") {
      entries.push({ t: "ask", question: ev.question ?? "" });
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
    activeNodes.value = [];
    queue.length = 0;
    pending = null;
    seq = 0;
    running.value = true;
    // 续跑/重连时保留已知 runId；新跑清空，等 run-started 回传。
    if (!params.resume) runId.value = "";
    // 续跑/重连：回放的历史事件在前 8 秒内秒显完整（追平进度），之后的实时事件再走打字机。
    fastForwardUntil = params.resume ? Date.now() + 8000 : 0;

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
        reconnectAttempts = 0; // 连上了，重置重连计数
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

    // 节点进入：立即显示加载态（含 think 节点），知道在跑哪个、轮到第几轮
    es.addEventListener("node-start", (e) => {
      try {
        nodeStart(JSON.parse((e as MessageEvent).data));
      } catch (err) {
        console.error("Failed to parse node-start event", err);
      }
    });

    // 内部 SDK session 流式事件：维护「当前运行中节点」的实时转写（类 GUI Claude Code）
    es.addEventListener("node-stream", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as {
          nodeId: string;
          kind: string;
          iteration: number | null;
          event: { kind: string; delta?: string; tool?: string; input?: unknown; ok?: boolean | null; preview?: string; question?: string };
        };
        applyStreamEvent(d);
      } catch (err) {
        console.error("Failed to parse node-stream event", err);
      }
    });

    es.addEventListener("node-end", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        // 节点收尾，从运行中列表移除（产出进入下方时间线）
        nodeEnd(d.id);
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
        activeNodes.value = [];
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
        // 服务端主动发来的 error 事件：运行真的出错了，不重连。
        try {
          const parsed = JSON.parse(me.data);
          error.value = parsed.message || "运行出错";
        } catch {
          error.value = me.data || "运行出错";
        }
        activeNodes.value = [];
        cleanup();
        running.value = false;
        return;
      }
      // 传输层断开（网络抖动等）：run 在后端独立跑，未出结果就自动重新订阅续看。
      if (running.value && !pending && runId.value && lastParams && reconnectAttempts < 5) {
        reconnectAttempts += 1;
        cleanup();
        const delay = Math.min(1000 * reconnectAttempts, 5000);
        setTimeout(() => {
          if (running.value && !pending) startRun({ ...lastParams!, resume: runId.value });
        }, delay);
        return;
      }
      if (running.value && !pending) {
        error.value = "连接已断开。run 仍在后端运行，刷新页面或点「断点续跑」可重新接上。";
      }
      activeNodes.value = [];
      cleanup();
      running.value = false;
    });
  }

  function resumeRun() {
    if (!lastParams || !runId.value) return;
    startRun({ ...lastParams, resume: runId.value });
  }

  // 刷新后自动重连上次仍在跑的 run（延到本同步 setup 结束后，避开 startRun 内部引用的 TDZ）
  if (reconnectParams) {
    const params = reconnectParams;
    reconnectParams = null;
    queueMicrotask(() => startRun(params));
  }

  return {
    running,
    error,
    live,
    difficulty,
    routing,
    finalDone,
    runId,
    activeNodes,
    startRun,
    resumeRun,
    cleanup,
  };
}
