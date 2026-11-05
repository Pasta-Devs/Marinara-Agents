import { resolve } from "node:path";
import { logger } from "../package-runtime.js";
import { holdsLtmVaultLock, outsideLtmVaultLock } from "../persistence/vault-lock.js";

/** A scheduled rebuild waits this long after the last request for more writes... */
export const LTM_REBUILD_QUIET_MS = 1_000;
/** ...but never longer than this after the first waiting request, so a steady stream of writes still rebuilds. */
export const LTM_REBUILD_MAX_WAIT_MS = 10_000;

type LtmRebuildRun = (root: string, signal: AbortSignal) => Promise<unknown>;
type Job = {
  run: LtmRebuildRun;
  /** A write is waiting for this job, so readers wait for it too. False while it only upgrades the vectors. */
  content: boolean;
  /** A request arrived during a run: arm the timer again when it ends. */
  again: boolean;
  firstRequestAt?: number;
  timer?: ReturnType<typeof setTimeout>;
  running?: Promise<void>;
  controller?: AbortController;
};
const jobs = new Map<string, Job>();
/** Roots whose package was deactivated: nothing schedules there until it is activated again. */
const stopped = new Set<string>();

function arm(key: string, job: Job) {
  const now = Date.now();
  job.firstRequestAt ??= now;
  clearTimeout(job.timer);
  const delay = Math.max(0, Math.min(LTM_REBUILD_QUIET_MS, job.firstRequestAt + LTM_REBUILD_MAX_WAIT_MS - now));
  job.timer = outsideLtmVaultLock(() => setTimeout(() => void start(key, job), delay));
  // A pending rebuild must not keep the process alive: the index stays dirty and the next recall rebuilds it inline.
  job.timer.unref?.();
}

function start(key: string, job: Job) {
  clearTimeout(job.timer);
  job.timer = undefined;
  job.firstRequestAt = undefined;
  const controller = new AbortController();
  job.controller = controller;
  job.running = outsideLtmVaultLock(() => job.run(key, controller.signal))
    .then(
      () => undefined,
      (error) => {
        if (!controller.signal.aborted) logger.warn(error, "[ltm] Background index rebuild failed");
      },
    )
    .finally(() => {
      job.running = undefined;
      job.controller = undefined;
      if (jobs.get(key) !== job) return;
      if (!job.again) return void jobs.delete(key);
      job.again = false;
      arm(key, job);
    });
  return job.running;
}

function waitUnlessAborted(running: Promise<void>, signal?: AbortSignal) {
  if (!signal) return running;
  return new Promise<void>((done, fail) => {
    const abort = () => fail(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    void running.finally(() => signal.removeEventListener("abort", abort)).then(done);
  });
}

function assertNotHoldingVaultLock(root: string) {
  // The rebuild takes the vault lock to read and to publish, so waiting for it under that lock never returns.
  if (holdsLtmVaultLock(root))
    throw new Error("A background index rebuild cannot be awaited while holding the vault lock.");
}

/**
 * Start or extend the root's quiet period. An upgrade-only request (the index text is current, its vectors are
 * from another embedding source) never makes readers wait, and any existing job covers it.
 */
export function scheduleLtmIndexRebuild(root: string, run: LtmRebuildRun, options: { upgradeOnly?: boolean } = {}) {
  const key = resolve(root);
  if (stopped.has(key)) return;
  const current = jobs.get(key);
  if (options.upgradeOnly && current) return;
  const job = current ?? { run, content: false, again: false };
  jobs.set(key, job);
  job.run = run;
  if (!options.upgradeOnly) {
    // A write is waiting now. Once a running upgrade-only build has read the notes, that write drops it at
    // publish anyway, so it stops here and the follow-up run covers the write.
    if (job.running && !job.content) job.controller?.abort();
    job.content = true;
  }
  if (job.running) job.again = true;
  else arm(key, job);
}

/**
 * Wait for the rebuild a write is waiting for: the running one, or the pending one, started now. One run is
 * enough. A build publishes only when no write moved the index since it read the notes, and a write it missed
 * leaves the index dirty, which the reader's index load rebuilds inline. Waiting for the re-runs later
 * writes ask for would let a steady stream of writes hold a reader indefinitely.
 */
export async function flushLtmIndexRebuild(root: string, signal?: AbortSignal) {
  assertNotHoldingVaultLock(root);
  const key = resolve(root);
  const job = jobs.get(key);
  if (!job?.content) return;
  signal?.throwIfAborted();
  await waitUnlessAborted(job.running ?? start(key, job), signal);
}

/**
 * A rebuild that holds the vault lock covers every write made so far, so a job waiting for them can stand down.
 * It also publishes vectors for its own embedding source, so a running upgrade-only job is aborted.
 */
export function cancelPendingLtmIndexRebuild(root: string) {
  const key = resolve(root);
  const job = jobs.get(key);
  if (!job) return;
  job.again = false;
  if (job.running) {
    if (!job.content) job.controller?.abort();
    return;
  }
  clearTimeout(job.timer);
  jobs.delete(key);
}

/**
 * Package deactivation: drop a pending rebuild, abort a running one before it publishes, and schedule nothing
 * more for the root, so a recall still finishing cannot start an upgrade after it.
 */
export async function stopLtmIndexRebuild(root: string) {
  assertNotHoldingVaultLock(root);
  const key = resolve(root);
  stopped.add(key);
  const job = jobs.get(key);
  if (!job) return;
  jobs.delete(key);
  clearTimeout(job.timer);
  job.controller?.abort();
  await job.running;
}

/** Package activation: background rebuilds may run for the root again. */
export function resumeLtmIndexRebuild(root: string) {
  stopped.delete(resolve(root));
}
