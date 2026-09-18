import type { FastifyInstance } from "fastify";
import { logger } from "../../../lib/logger.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { runSlurpAutopurge } from "./slp-autopurge.js";
import { nextSlurpAutopurgeRunAt } from "../../../../../shared/src/slp/slp-autopurge-time.js";
import { slurpPollBackoffMs } from "../../base/model/slp-poll-backoff.js";

const POLL_MS = 60_000;

/** Run an overdue purge on startup, then keep checking while the Engine stays online. */
export function startSlurpAutopurgeScheduler(app: FastifyInstance, registerStop?: (stop: () => Promise<void>) => void) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active: Promise<void> | null = null;
  let consecutiveFailures = 0;

  const schedule = (delay = slurpPollBackoffMs(POLL_MS, consecutiveFailures)) => {
    if (stopped) return;
    timer = setTimeout(() => void pollNow(), delay);
    timer.unref?.();
  };
  const pollNow = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (active) return active;
    active = (async () => {
      const storage = createSlurpStorage(app.db);
      const settings = await storage.getSettings();
      if (!settings.autopurgeEnabled) return;
      if (!settings.autopurgeNextRunAt) {
        await storage.updateSettings({ autopurgeNextRunAt: nextSlurpAutopurgeRunAt(settings) });
        return;
      }
      if (Date.parse(settings.autopurgeNextRunAt) > Date.now()) return;
      const outcome = await runSlurpAutopurge(app.db);
      if (outcome.status === "completed") {
        logger.info(
          "[slurp-autopurge] Removed %d posts, %d post media items, and %d message media items",
          outcome.result.deletedPosts,
          outcome.result.removedPostMedia,
          outcome.result.removedMessageMedia,
        );
      }
    })();
    return active
      .then(() => {
        consecutiveFailures = 0;
      })
      .catch((error: unknown) => {
        consecutiveFailures += 1;
        logger.warn(error, "[slurp-autopurge] Scheduled purge failed");
      })
      .finally(() => {
        active = null;
        schedule();
      });
  };
  const stop = async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    await active?.catch(() => undefined);
  };

  registerStop?.(stop);
  app.addHook("onClose", stop);
  void pollNow();
  return { pollNow, stop };
}
