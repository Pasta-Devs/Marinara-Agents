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
// A job the player asked for (`foreground`, the memory's Retry) is their own request, not background work: it runs in
// its lane under foreground admission, which never refuses, so it never waits for an idle connection. Background
// admission refuses while the player's own calls run on the connection, for 30 s after each, and for hours after
// three failed background jobs, so a Retry that waited for it would wait as long as the player reads. It goes ahead
// of every background job waiting in its lane (one running finishes first). Asked for again while it waits or backs
// off, a job becomes foreground and moves ahead in its lane, or goes back in it, at once.
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
  /** The player asked for it (the memory's Retry): it runs under foreground admission (see the header). */
  foreground?: boolean;
  /** Makes and saves the missing thing. Check that it is still missing first: the job may have waited a while. */
  run: () => Promise<void>;
}

interface Entry {
  job: BackgroundJob;
  refusals: number;
  /** The job's own `foreground`, or a later request's for the same key. */
  foreground: boolean;
  /** Set while it backs off after an admission refusal. */
  backoff?: ReturnType<typeof setTimeout>;
  /** Admitted: it runs or has run, and is never run again. */
  started?: boolean;
}

export function createBackgroundQueue(runtime: Pick<CapabilityRuntimeHost, "integrations" | "logger">) {
  /** Each key that waits, backs off or runs, with its entry. */
  const entries = new Map<string, Entry>();
  const lanes = new Map<string, Entry[]>();
  let disposed = false;

  function enqueue(entry: Entry) {
    const lane = lanes.get(entry.job.connectionId);
    if (lane) {
      // A foreground job goes ahead of every background one waiting (see the header).
      const at = entry.foreground ? lane.findIndex((waiting) => !waiting.foreground) : -1;
      lane.splice(at < 0 ? lane.length : at, 0, entry);
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

  async function attempt(entry: Entry) {
    const { job } = entry;
    const admission = runtime.integrations?.admission;
    const work = () => {
      entry.started = true;
      return job.run();
    };
    try {
      await (admission
        ? admission.run(job.connectionId, { kind: entry.foreground ? "foreground" : "background" }, work)
        : work());
    } catch (error) {
      if (!entry.started && !disposed && admission?.isFailure(error)) {
        // Made foreground while this attempt was refused: again at once.
        const delay = entry.foreground
          ? 0
          : Math.min(BACKGROUND_RETRY_MAX_MS, BACKGROUND_RETRY_MIN_MS * 2 ** entry.refusals);
        entry.refusals += 1;
        entry.backoff = setTimeout(() => {
          entry.backoff = undefined;
          if (!disposed) enqueue(entry);
        }, delay);
        return;
      }
      runtime.logger.warn(
        "[otome-forge] Background job %s stopped: %s",
        job.key,
        error instanceof Error ? error.message : String(error),
      );
    }
    entries.delete(job.key);
  }

  return {
    /**
     * Queues the job unless its key is already queued; false when it was. A `foreground` job whose key waits or backs
     * off makes that one foreground and moves it ahead (see the header); one running goes on as it is.
     */
    ensure(job: BackgroundJob): boolean {
      if (disposed) return false;
      const queued = entries.get(job.key);
      if (!queued) {
        const entry: Entry = { job, refusals: 0, foreground: job.foreground === true };
        entries.set(job.key, entry);
        enqueue(entry);
        return true;
      }
      if (job.foreground && !queued.foreground) {
        queued.foreground = true;
        const lane = lanes.get(queued.job.connectionId);
        const at = lane?.indexOf(queued) ?? -1;
        if (queued.backoff) {
          clearTimeout(queued.backoff);
          queued.backoff = undefined;
          enqueue(queued);
        } else if (lane && at >= 0) {
          lane.splice(at, 1);
          enqueue(queued);
        }
      }
      return false;
    },
    /** True while a job with this key waits, backs off or runs. */
    has: (key: string) => entries.has(key),
    /** True while a background job with this key waits or backs off: not admitted yet, and nobody asked for it. */
    waiting(key: string) {
      const entry = entries.get(key);
      return !!entry && !entry.started && !entry.foreground;
    },
    /** Drops every waiting job and backoff timer (on deactivate). A running job finishes on its own. */
    dispose() {
      disposed = true;
      for (const entry of entries.values()) clearTimeout(entry.backoff);
      for (const lane of lanes.values()) lane.length = 0;
      entries.clear();
    },
  };
}

export type BackgroundQueue = ReturnType<typeof createBackgroundQueue>;
