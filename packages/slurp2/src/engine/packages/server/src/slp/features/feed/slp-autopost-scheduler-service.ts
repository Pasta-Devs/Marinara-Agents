import type { FastifyInstance } from "fastify";
import { slpIsAdmissionFailure } from "../../base/host/slp-admission.js";
import { logger } from "../../../lib/logger.js";
import { sweepStagedImages } from "../../../services/image/image-generation.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { reconcileCreatorReserve, runCreatorAutoPostPoll } from "./reserve/slp-reserve-operation.js";
import { tryBackfillNextCreatorArtwork } from "../creators/slp-creators-contract.js";
import { slurpPollBackoffMs } from "../../base/model/slp-poll-backoff.js";
import { createCreatorSlpImagesService } from "../media/slp-media-contract.js";

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
  const release = await pauseNoodleAutoPost();
  try {
    return await run();
  } finally {
    release();
  }
}

/**
 * Hold the auto-post scheduler still and wait for any poll already running to finish.
 *
 * A backup or restore spans many seconds, which is far longer than a scoped
 * `withNoodleAutoPostPaused` block wants to be, so the pause is handed out as a release function
 * the job releases in its own `finally`.
 */
export async function pauseNoodleAutoPost(): Promise<() => void> {
  pauseDepth += 1;
  await activePoll.catch(() => {});
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pauseDepth -= 1;
  };
}

/** True when nothing can be prepared or published, so the poll only has existing rows to tidy. */
export function slpCreatorReservePollIsIdle(settings: { autoPostingScheduleEnabled: boolean }): boolean {
  return !settings.autoPostingScheduleEnabled;
}

export function startSlpAutoPostScheduler(app: FastifyInstance, registerStop?: (stop: () => Promise<void>) => void) {
  let stopped = false;
  let running: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveFailures = 0;
  // Cosmetic image work backs off on its own clock. It used to feed `consecutiveFailures`, which
  // is the *publishing* poll's clock, so one creator whose picture could not be drawn — most
  // commonly because no image connection is configured at all — walked the whole reserve poll out
  // to thirty minutes and held it there. Artwork is cosmetic and must never decide how often due
  // posts publish; it still needs a brake of its own, because the backfill retries the same
  // creator every pass and would otherwise draw one image request a minute forever.
  let imageWorkFailures = 0;
  let imageWorkNotBefore = 0;

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
      if (Date.now() >= imageWorkNotBefore) {
        // Artwork is independent of the posting schedule: a creator with no picture needs one even
        // when automatic posting is off, so this runs before the idle check returns.
        const artwork = await tryBackfillNextCreatorArtwork(app.db);
        if (artwork !== "idle" && artwork !== "unavailable")
          logger.info("[slurp-autopost] Filled in a creator %s", artwork);
        // A post whose picture failed published without it. Draw one of them per pass, so the
        // post gets its image back without a separate scheduler.
        const redrawn = await createCreatorSlpImagesService(app.db).retryNextFailedPostImage();
        if (redrawn === "retried") logger.info("[slurp-autopost] Redrew a missing post image");
        const imageWorkFailed = artwork === "unavailable" || redrawn === "failed";
        imageWorkFailures = imageWorkFailed ? imageWorkFailures + 1 : 0;
        imageWorkNotBefore = imageWorkFailed ? Date.now() + slurpPollBackoffMs(POLL_MS, imageWorkFailures) : 0;
      }
      if (slpCreatorReservePollIsIdle(settings) && !(await noodle.hasNoodlerPreparedPosts())) return;
      const outcome = await runCreatorAutoPostPoll(app.db);
      if (outcome.published > 0) logger.info("[slurp-autopost] Published %d due Slurp post(s)", outcome.published);
      if (outcome.reserve === "prepared") logger.info("[slurp-autopost] Prepared one Slurp post");
      if (outcome.reserve === "scheduled") logger.info("[slurp-autopost] Scheduled one on-demand Slurp post");
    } catch (error) {
      // A busy connection is the user working, not a failure: no error log and no backoff.
      if (slpIsAdmissionFailure(error)) {
        logger.debug("[slurp-autopost] Connection busy; the reserve poll waits for the next tick");
      } else {
        failed = true;
        logger.error(error, "[slurp-autopost] Reserve poll failed");
      }
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
    if (swept > 0) logger.info("[slurp-autopost] Reclaimed %d staged image file(s)", swept);
    await createSlurpStorage(app.db).ensureNoodlerReserveState();
    await reconcileCreatorReserve(app.db);
  })().catch((error) => logger.error(error, "[slurp-autopost] Startup reconciliation failed"));
  activePoll = running;
  schedule(INITIAL_DELAY_MS);
  app.addHook("onClose", async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    await running.catch(() => {});
  });
  logger.info("[slurp-autopost] Private reserve scheduler started");
  return { stop };
}
