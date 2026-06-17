/**
 * Run 事件中枢 —— 把"运行"与"观看连接"解耦，解决刷新即丢的问题。
 *
 * 每个 runId 一个 channel：缓冲全部已发事件 + 维护订阅者集合。pipeline 通过 emit 往 channel 写，
 * 任意时刻有几个 SSE 客户端订阅都行；客户端断开（刷新/关页）只是退订，run 照常跑下去。
 * 刷新后用同一 runId 重新订阅 → 先回放缓冲区把整段进度追平，再接着看实时。
 *
 * 注意：缓冲在内存里，进程重启（如 tsx watch 热重载）会清空 → 此时退化为 checkpoint 断点续跑。
 */

export type Emit = (event: string, data: unknown) => void;

interface BufferedEvent {
  seq: number;
  event: string;
  data: unknown;
}

interface RunChannel {
  runId: string;
  events: BufferedEvent[];
  subscribers: Set<Emit>;
  status: "running" | "done" | "failed";
  seq: number;
}

/** 单条 act 流式事件可能很多，给每个 channel 的 node-stream 事件设一个软上限，避免内存膨胀。 */
const MAX_STREAM_EVENTS = 4000;

class RunHub {
  private channels = new Map<string, RunChannel>();

  /** 该 runId 是否还有 channel（running 或刚收尾仍在 30s 保留期内）——有就能订阅回放。 */
  has(runId: string): boolean {
    return this.channels.has(runId);
  }

  /** 新建 channel（同 runId 已存在则复用，覆盖为 running——续跑/重连场景）。 */
  open(runId: string): RunChannel {
    let ch = this.channels.get(runId);
    if (!ch) {
      ch = { runId, events: [], subscribers: new Set(), status: "running", seq: 0 };
      this.channels.set(runId, ch);
    } else {
      ch.status = "running";
    }
    return ch;
  }

  /** 往 channel 写一条事件：缓冲 + 扇出给所有订阅者（订阅者写失败自动退订）。 */
  emit(runId: string, event: string, data: unknown): void {
    const ch = this.channels.get(runId);
    if (!ch) return;
    ch.events.push({ seq: ch.seq++, event, data });
    this.trim(ch);
    for (const sub of [...ch.subscribers]) {
      try {
        sub(event, data);
      } catch {
        ch.subscribers.delete(sub); // res 已关闭等：剔除该订阅者，不影响 run
      }
    }
  }

  /**
   * 订阅一个 channel：先把缓冲区里已有事件回放给该订阅者（追平进度），再加入实时扇出。
   * 返回退订函数（客户端断开时调用）。
   */
  subscribe(runId: string, emit: Emit): () => void {
    const ch = this.channels.get(runId);
    if (!ch) return () => {};
    for (const e of ch.events) {
      try {
        emit(e.event, e.data);
      } catch {
        return () => {}; // 回放途中就断了，直接放弃订阅
      }
    }
    ch.subscribers.add(emit);
    return () => ch.subscribers.delete(emit);
  }

  /** 标记 run 收尾；保留缓冲一小段时间供刚好在收尾瞬间重连的客户端回放，然后清理。 */
  finish(runId: string, status: "done" | "failed"): void {
    const ch = this.channels.get(runId);
    if (!ch) return;
    ch.status = status;
    ch.subscribers.clear();
    // 收尾后短暂保留（30s）再删，给"刚好收尾时刷新"的客户端一次回放机会。
    setTimeout(() => {
      const cur = this.channels.get(runId);
      if (cur && cur.status !== "running") this.channels.delete(runId);
    }, 30_000).unref?.();
  }

  /** node-stream 事件超上限时丢最早的（只丢流式增量，里程碑事件 phase/node-end/done 等全保留）。 */
  private trim(ch: RunChannel): void {
    const streamCount = ch.events.reduce((n, e) => n + (e.event === "node-stream" ? 1 : 0), 0);
    if (streamCount <= MAX_STREAM_EVENTS) return;
    const idx = ch.events.findIndex((e) => e.event === "node-stream");
    if (idx >= 0) ch.events.splice(idx, 1);
  }
}

export const runHub = new RunHub();
