import type { FastifyInstance, InjectOptions } from "fastify";
import { logger } from "../../../lib/logger.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { AUTOMATIC_GENERATION_HEADER } from "../../../services/generation/connection-admission.js";
import { createGarnishAds } from "../ads/slp-ads-contract.js";
import { syncGarnishAdsWithLorebook } from "../ads/slp-ads-contract.js";
import {
  dueSlpRefreshTimes,
  markSlpRefreshAttempt,
  markSlpRefreshFailure,
  markSlpRefreshSuccess,
  nextSlpRefreshTime,
  type PersistedSlpRefreshSchedule,
} from "../../modules/feed/slp-refresh-schedule.js";

const SLP_SCHEDULER_INITIAL_DELAY_MS = 20_000;
const SLP_SCHEDULER_MAX_POLL_MS = 60_000;
// Nothing is scheduled while automatic refresh is off, so the poll only needs to notice that the
// setting changed. A minute-by-minute wake for that costs battery on phone installs for nothing.
const SLP_SCHEDULER_DISABLED_POLL_MS = 15 * 60_000;
const SLP_SCHEDULER_CONFIGURATION_RETRY_MS = 15 * 60_000;
const SLP_SCHEDULER_BUSY_RETRY_MS = 60_000;
const SLP_SCHEDULER_RATE_LIMIT_RETRY_MS = 5 * 60_000;
const SLP_SCHEDULER_FAILURE_BASE_RETRY_MS = 5 * 60_000;
const SLP_SCHEDULER_FAILURE_MAX_RETRY_MS = 60 * 60_000;
const SLP_SCHEDULER_CONFIGURATION_STATUS_CODES = new Set([400, 401, 403, 404, 405, 410, 422]);
let refreshPauseDepth = 0;
let activeRefreshPoll: Promise<void> | null = null;

/** Same contract as `pauseNoodleAutoPost`, for the refresh poll. */
export async function pauseSlpRefreshScheduler(): Promise<() => void> {
  refreshPauseDepth += 1;
  await activeRefreshPoll?.catch(() => {});
  let released = false;
  return () => {
    if (released) return;
    released = true;
    refreshPauseDepth -= 1;
  };
}

function responseError(payload: string): string {
  try {
    const parsed = JSON.parse(payload) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error) return parsed.error;
  } catch {
    // Fall through to the raw payload.
  }
  return payload.trim().slice(0, 500) || "Automatic Slurp refresh failed";
}

export function slpRefreshRetryDelayMs(statusCode: number, failureAttempts: number): number {
  if (statusCode === 409) return SLP_SCHEDULER_BUSY_RETRY_MS;
  if (statusCode === 429) return SLP_SCHEDULER_RATE_LIMIT_RETRY_MS;
  if (SLP_SCHEDULER_CONFIGURATION_STATUS_CODES.has(statusCode)) {
    return SLP_SCHEDULER_CONFIGURATION_RETRY_MS;
  }
  return Math.min(
    SLP_SCHEDULER_FAILURE_MAX_RETRY_MS,
    SLP_SCHEDULER_FAILURE_BASE_RETRY_MS * 2 ** Math.max(0, failureAttempts),
  );
}

export function nextSlpSchedulerPollDelayMs(schedule: PersistedSlpRefreshSchedule, at: Date): number {
  if (schedule.refreshesPerDay === 0) return SLP_SCHEDULER_DISABLED_POLL_MS;
  const now = at.getTime();
  const retryAt = schedule.nextAttemptAt ? Date.parse(schedule.nextAttemptAt) : Number.NaN;
  if (Number.isFinite(retryAt) && retryAt > now) {
    return Math.max(1_000, Math.min(SLP_SCHEDULER_MAX_POLL_MS, retryAt - now));
  }
  const nextRefreshAt = nextSlpRefreshTime(schedule);
  if (!nextRefreshAt) return SLP_SCHEDULER_MAX_POLL_MS;
  return Math.max(1_000, Math.min(SLP_SCHEDULER_MAX_POLL_MS, Date.parse(nextRefreshAt) - now));
}

export function startSlpRefreshScheduler(
  app: FastifyInstance,
  registerStop?: (stop: () => Promise<void>) => void,
  runInternalRoute?: (options: InjectOptions | string) => ReturnType<FastifyInstance["inject"]>,
) {
  const noodle = createSlurpStorage(app.db);
  let stopped = false;
  let polling = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active: Promise<void> | null = null;

  const scheduleNext = (delayMs: number) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(
      () => {
        active = poll().finally(() => {
          active = null;
          activeRefreshPoll = null;
        });
        activeRefreshPoll = active;
      },
      Math.max(1_000, delayMs),
    );
    timer.unref?.();
  };

  const persistFailure = async (schedule: PersistedSlpRefreshSchedule, error: string, statusCode: number, at: Date) => {
    const failed = markSlpRefreshFailure(
      schedule,
      error,
      at,
      slpRefreshRetryDelayMs(statusCode, schedule.failureAttempts),
    );
    await noodle.saveRefreshSchedule(failed);
    if (SLP_SCHEDULER_CONFIGURATION_STATUS_CODES.has(statusCode)) {
      logger.debug("[slurp-scheduler] Automatic refresh is waiting for valid configuration: %s", error);
    } else {
      logger.warn(
        "[slurp-scheduler] Automatic refresh failed with status %d; retrying at %s: %s",
        statusCode,
        failed.nextAttemptAt ?? "unknown",
        error,
      );
    }
    return failed;
  };

  const poll = async () => {
    if (stopped || polling) return;
    // A backup or restore owns the data while it runs; come back once it has released.
    if (refreshPauseDepth > 0) {
      scheduleNext(SLP_SCHEDULER_BUSY_RETRY_MS);
      return;
    }
    polling = true;
    let nextDelay = SLP_SCHEDULER_MAX_POLL_MS;
    try {
      const now = new Date();
      const settings = await noodle.getSettings();
      // A lorebook-backed ad pool follows its book. This is a no-op unless the book's content
      // fingerprint actually changed, so a steady setting costs one cheap read per poll.
      if (settings.inlineAdsLorebookId) {
        await syncGarnishAdsWithLorebook(app.db, createGarnishAds(app.db).pool).catch((error) =>
          logger.warn(error, "[slurp-scheduler] Lorebook ad sync failed"),
        );
      }
      let schedule = await noodle.ensureRefreshSchedule(now, settings);
      const retryAt = schedule.nextAttemptAt ? Date.parse(schedule.nextAttemptAt) : Number.NaN;
      if (Number.isFinite(retryAt) && retryAt > now.getTime()) {
        nextDelay = nextSlpSchedulerPollDelayMs(schedule, now);
        return;
      }

      const dueTimes = dueSlpRefreshTimes(schedule, now);
      if (settings.refreshesPerDay === 0 || dueTimes.length === 0) {
        nextDelay = nextSlpSchedulerPollDelayMs(schedule, now);
        return;
      }

      schedule = markSlpRefreshAttempt(schedule, now);
      await noodle.saveRefreshSchedule(schedule);

      const request = {
        method: "POST",
        url: "/api/slurp2/refresh",
        headers: { [AUTOMATIC_GENERATION_HEADER]: "1" },
        payload: { mode: "noodler" },
      } satisfies InjectOptions;
      const response = await (runInternalRoute ? runInternalRoute(request) : app.inject(request));
      const completedAt = new Date();
      const latest = await noodle.ensureRefreshSchedule(completedAt);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        const latestDueTimes = dueSlpRefreshTimes(latest, completedAt);
        const consumedTimes = dueTimes.filter((time) => latest.scheduledTimes.includes(time));
        const completed = markSlpRefreshSuccess(
          latest,
          consumedTimes.length > 0 ? consumedTimes : latestDueTimes,
          completedAt,
        );
        await noodle.saveRefreshSchedule(completed);
        logger.info(
          "[slurp-scheduler] Automatic timeline refresh completed; consumed %d due slot%s",
          Math.max(consumedTimes.length, latestDueTimes.length),
          Math.max(consumedTimes.length, latestDueTimes.length) === 1 ? "" : "s",
        );
        nextDelay = nextSlpSchedulerPollDelayMs(completed, completedAt);
        return;
      }

      const failed = await persistFailure(latest, responseError(response.payload), response.statusCode, completedAt);
      nextDelay = nextSlpSchedulerPollDelayMs(failed, completedAt);
    } catch (error) {
      const at = new Date();
      const message = error instanceof Error ? error.message : String(error);
      try {
        const schedule = await noodle.ensureRefreshSchedule(at);
        const failed = await persistFailure(schedule, message, 500, at);
        nextDelay = nextSlpSchedulerPollDelayMs(failed, at);
      } catch (persistError) {
        logger.error(persistError, "[slurp-scheduler] Failed to persist scheduler failure state");
      }
    } finally {
      polling = false;
      scheduleNext(nextDelay);
    }
  };

  const stop = async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    await active?.catch(() => {});
  };
  registerStop?.(stop);
  scheduleNext(SLP_SCHEDULER_INITIAL_DELAY_MS);
  app.addHook("onClose", async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    await active?.catch(() => {});
  });

  logger.info("[slurp-scheduler] Automatic timeline refresh scheduler started");
  return { stop };
}
