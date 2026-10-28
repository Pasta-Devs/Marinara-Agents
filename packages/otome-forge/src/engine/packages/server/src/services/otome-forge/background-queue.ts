// ──────────────────────────────────────────────
// Otome Forge: the background lane (memory summaries and line packs, from M2a and M3)
// ──────────────────────────────────────────────
// Jobs are "ensure X exists" tasks keyed by what they make: a key already waiting, backing off or running is not
// queued again. Each connection runs one job at a time, and each job runs inside the Engine's background admission
// (integrations.admission.run with {kind: "background"}), so it yields to the player's own requests. The slot is held
// for the whole job, both attempts of generateJson included, which is why a job calls generateJson with lane
// "background" and its own connectionId.
//
// When admission refuses a job before it starts (admission.isFailure), nothing was sent: the job is requeued after
// 30 s, doubling up to 5 min. A job that started is never run again by the queue, whatever it throws, so an admitted
// job never calls the model twice. Any other failure is logged and dropped; the next request that needs the missing
// thing queues it again.
//
// ponytail: nothing about the queue is stored, so a restart drops it. The ceiling is that line packs wait for the
// next visit; the upgrade path is a job document.
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";

export const BACKGROUND_RETRY_MIN_MS = 30_000;
export const BACKGROUND_RETRY_MAX_MS = 5 * 60_000;

export interface BackgroundJob {
  /** What the job makes, e.g. `${R}:memory:summary`; one job per key at a time. */
  key: string;
  /** The connection the job's admission slot is taken on; generateJson must use the same one. */
  connectionId: string;
  /** Makes and saves the missing thing. Check that it is still missing first: the job may have waited a while. */
  run: () => Promise<void>;
}

interface Entry {
  job: BackgroundJob;
  refusals: number;
}

export function createBackgroundQueue(runtime: Pick<CapabilityRuntimeHost, "integrations" | "logger">) {
  const keys = new Set<string>();
  const lanes = new Map<string, Entry[]>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let disposed = false;

  function enqueue(entry: Entry) {
    const lane = lanes.get(entry.job.connectionId);
    if (lane) {
      lane.push(entry);
      return;
    }
    const fresh = [entry];
    lanes.set(entry.job.connectionId, fresh);
    void drain(entry.job.connectionId, fresh);
  }

  async function drain(connectionId: string, lane: Entry[]) {
    for (let entry = lane.shift(); entry; entry = lane.shift()) await attempt(entry);
    lanes.delete(connectionId);
  }

  async function attempt({ job, refusals }: Entry) {
    const admission = runtime.integrations?.admission;
    let started = false;
    const work = () => {
      started = true;
      return job.run();
    };
    try {
      await (admission ? admission.run(job.connectionId, { kind: "background" }, work) : work());
    } catch (error) {
      if (!started && !disposed && admission?.isFailure(error)) {
        const delay = Math.min(BACKGROUND_RETRY_MAX_MS, BACKGROUND_RETRY_MIN_MS * 2 ** refusals);
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!disposed) enqueue({ job, refusals: refusals + 1 });
        }, delay);
        timers.add(timer);
        return;
      }
      runtime.logger.warn(
        "[otome-forge] Background job %s stopped: %s",
        job.key,
        error instanceof Error ? error.message : String(error),
      );
    }
    keys.delete(job.key);
  }

  return {
    /** Queues the job unless its key is already queued; false when it was. */
    ensure(job: BackgroundJob): boolean {
      if (disposed || keys.has(job.key)) return false;
      keys.add(job.key);
      enqueue({ job, refusals: 0 });
      return true;
    },
    /** True while a job with this key waits, backs off or runs. */
    has: (key: string) => keys.has(key),
    /** Drops every waiting job and backoff timer (on deactivate). A running job finishes on its own. */
    dispose() {
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      for (const lane of lanes.values()) lane.length = 0;
      keys.clear();
    },
  };
}

export type BackgroundQueue = ReturnType<typeof createBackgroundQueue>;
