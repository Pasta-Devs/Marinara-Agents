import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { sweepStagedImages } from "../image/image-generation.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { reconcileNoodlerReserve, runNoodlerAutoPostPoll } from "./slurp-reserve.operation.js";
import { tryBackfillNextNoodlerCreatorArtwork } from "./slurp-artwork.operation.js";
import { slurpPollBackoffMs } from "./slurp-poll-backoff.js";
import { createNoodlerNoodleImagesService } from "./slurp-images.service.js";

const INITIAL_DELAY_MS = 30_000;
const POLL_MS = 60_000;

/**
 * Reserve work writes rows and gallery files in the same pass, and a backup collects tables and
 * assets separately. Running both at once can archive a row whose media is not in the zip, or
 * media no row owns, so the exporter holds this gate for the length of its snapshot.
 */
let pauseDepth = 0;
let activePoll: Promise<void> = Promise.resolve();

export async function withNoodleAutoPostPaused<T>(run: () => Promise<T>): Promise<T> {
  pauseDepth += 1;
  try {
    await activePoll.catch(() => {});
    return await run();
  } finally {
    pauseDepth -= 1;
  }
}

/** True when nothing can be prepared or published, so the poll only has existing rows to tidy. */
export function noodlerReservePollIsIdle(settings: { autoPostingScheduleEnabled: boolean }): boolean {
  return !settings.autoPostingScheduleEnabled;
}

export function startNoodleAutoPostScheduler(app: FastifyInstance, registerStop?: (stop: () => Promise<void>) => void) {
  let stopped = false;
  let running: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveFailures = 0;

  const schedule = (delay = slurpPollBackoffMs(POLL_MS, consecutiveFailures)) => {
    if (stopped) return;
    timer = setTimeout(() => {
      running = poll();
      activePoll = running;
    }, delay);
    timer.unref?.();
  };

  const poll = async () => {
    if (stopped) return;
    // A paused poll re-arms rather than skipping its turn: the backup it is waiting on is short.
    if (pauseDepth > 0) {
      schedule();
      return;
    }
    let failed = false;
    try {
      // Reconciliation walks every prepared post and every Noodle post. With posting off and no
      // reserve rows there is nothing for it to repair or publish, so skip the scan entirely
      // rather than materializing both tables once a minute for the server's lifetime.
      const noodle = createSlurpStorage(app.db);
      const settings = await noodle.getSettings();
      // Artwork is independent of the posting schedule: a creator with no picture needs one even
      // when automatic posting is off, so this runs before the idle check returns.
      const artwork = await tryBackfillNextNoodlerCreatorArtwork(app.db);
      if (artwork !== "idle" && artwork !== "unavailable")
        logger.info("[noodle-autopost] Filled in a creator %s", artwork);
      // Artwork has no budget of its own, so a connection that always fails would otherwise draw
      // one image request a minute forever.
      failed = artwork === "unavailable";
      // A post whose picture failed published without it. Draw one of them per pass, so the
      // post gets its image back without a separate scheduler.
      const redrawn = await createNoodlerNoodleImagesService(app.db).retryNextFailedPostImage();
      if (redrawn === "retried") logger.info("[noodle-autopost] Redrew a missing post image");
      failed = failed || redrawn === "failed";
      if (noodlerReservePollIsIdle(settings) && !(await noodle.hasNoodlerPreparedPosts())) return;
      const outcome = await runNoodlerAutoPostPoll(app.db);
      if (outcome.published > 0) logger.info("[noodle-autopost] Published %d due Slurp post(s)", outcome.published);
      if (outcome.reserve === "prepared") logger.info("[noodle-autopost] Prepared one Slurp post");
      if (outcome.reserve === "scheduled") logger.info("[noodle-autopost] Scheduled one on-demand Slurp post");
    } catch (error) {
      failed = true;
      logger.error(error, "[noodle-autopost] Reserve poll failed");
    } finally {
      consecutiveFailures = failed ? consecutiveFailures + 1 : 0;
      schedule();
    }
  };

  const stop = async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    await running.catch(() => {});
  };
  registerStop?.(stop);

  // Own reserve-state initialization here so upgrades begin their hold at server startup,
  // even when automatic posting is disabled. Provider work still waits for the normal delay.
  running = (async () => {
    // Images staged by a process that was killed mid-preparation are referenced by nothing.
    const swept = sweepStagedImages();
    if (swept > 0) logger.info("[noodle-autopost] Reclaimed %d staged image file(s)", swept);
    await createSlurpStorage(app.db).ensureNoodlerReserveState();
    await reconcileNoodlerReserve(app.db);
  })().catch((error) => logger.error(error, "[noodle-autopost] Startup reconciliation failed"));
  activePoll = running;
  schedule(INITIAL_DELAY_MS);
  app.addHook("onClose", async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    await running.catch(() => {});
  });
  logger.info("[noodle-autopost] Private reserve scheduler started");
  return { stop };
}
