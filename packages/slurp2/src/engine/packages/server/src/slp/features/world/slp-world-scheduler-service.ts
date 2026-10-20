import type { FastifyInstance } from "fastify";
import { logger } from "../../../lib/logger.js";
import { slurpPollBackoffMs } from "../../base/model/slp-poll-backoff.js";
import { advanceSlurpWorld } from "./slp-world-operation.js";
import { topUpSlurpReactionBank } from "./slp-reaction-bank-operation.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { slurpWorldTimerDue } from "../../../../../shared/src/slp/slp-tuning.js";
import { slurpPlayerPresent } from "./slp-world-tick-state.js";
import { drainSlurpPendingText } from "./slp-pending-text-service.js";
import { advanceSlurpTrends } from "../discovery/slp-discovery-contract.js";
import { advanceSlurpDrama } from "./slp-drama-service.js";
import { drainSlurpAudienceReplies } from "../audience/slp-audience-contract.js";
import {
  advanceSlurpSupportDesk,
  drainSlurpContinuityExtraction,
  textSlurpPartners,
} from "../messages/slp-messages-contract.js";
import { slurpPaused } from "../../base/model/slp-pause.js";

/**
 * The background half of the world clock.
 *
 * Away, it polls slowly (a few catch-ups a day, unless "Run in the background" is on). While the
 * player is here (the badge poll marks it) it runs every tick length, so the world moves while they
 * watch, not only when the Inbox opens (user, fix phase 1b / R1-106).
 *
 * The tick itself is free-tier. The model work after it (bank top-up, pending rewrites, written
 * replies, continuity) follows the AI budget: with the player here it runs as present work, away
 * only in background mode, and every job claims a paced share of the day's calls. All of it is
 * best-effort and kept off this poll's backoff clock: the free tick must not slow down because
 * model work could not run.
 */
const INITIAL_DELAY_MS = 90_000;

/**
 * Rewrites per scheduled pass. The read path keeps its small limit so the first read stays fast;
 * here the AI budget and its day pace already decide the spend, so a busy world does not queue
 * faster than it rewrites. ponytail: fixed at 10; derive it from the budget if 10 still falls behind.
 */
const SCHEDULED_DRAIN_LIMIT = 10;

/** Fallback wake interval when settings cannot be read. Normally `clock.tickMinutes`. */
const POLL_MS = 5 * 60 * 1000;

export function startSlurpWorldScheduler(app: FastifyInstance, registerStop?: (stop: () => Promise<void>) => void) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active: Promise<unknown> | null = null;
  let consecutiveFailures = 0;
  let lastRunMs = 0;
  let pollMs = POLL_MS;
  const schedule = (delay: number) => {
    if (stopped) return;
    timer = setTimeout(() => void poll(), delay);
    timer.unref?.();
  };
  const poll = async () => {
    if (stopped || active) return;
    // `active` covers the whole pass, not just the tick: `stop()` awaits it, and the bank top-up
    // below is a provider call that must not be left in flight after shutdown returns.
    active = (async () => {
      // Re-read every wake, so `backgroundTimer` and `tickMinutes` apply without a restart. Off
      // keeps the old four-catch-ups-a-day cadence; on ticks every `tickMinutes`.
      const { clock } = (await createSlurpStorage(app.db).getSettings()).simulationTuning;
      pollMs = clock.tickMinutes * 60_000;
      // "Pause all": the world stands still (the settings read above keeps the flag in step).
      if (slurpPaused()) return;
      // While the player is here the free tick runs every wake (R1-106): likes, follows and
      // storylines move while they watch, not only when the Inbox opens.
      const present = slurpPlayerPresent();
      if (!present && !slurpWorldTimerDue(clock, lastRunMs, Date.now())) return;
      lastRunMs = Date.now();
      const result = await advanceSlurpWorld(app.db);
      if (result.actions > 0) logger.info("[slurp-world] Tick applied %d actions", result.actions);
      // The Support desk rides the same clock (free tier: templates only).
      await advanceSlurpSupportDesk(app.db).catch((error: unknown) =>
        logger.warn(error, "[slurp-desk] Desk tick failed"),
      );
      // Drama rides the same clock too (docs/DRAMA.md): nothing runs until the player switches it on.
      await advanceSlurpDrama(app.db).catch((error: unknown) => logger.warn(error, "[slurp-drama] Drama tick failed"));
      // A post that took off may become a trend (docs/TRENDS.md); it never fails the tick.
      await advanceSlurpTrends(app.db, new Date());
      // A Creator who is with the player texts like a partner, a few times a day.
      await textSlurpPartners(app.db).catch((error: unknown) => logger.warn(error, "[slurp-partner] Texts failed"));
      // After the tick, and never in a way that can fail it: the bank feeds the free comments the
      // tick above just wrote, so a slow or refused top-up costs nothing that is due now.
      await topUpSlurpReactionBank(app.db).catch((error: unknown) =>
        logger.warn(error, "[slurp-world] Free comment bank top-up failed"),
      );
      // The model work the Inbox catch-up does, on the same clock: "present" while the player is
      // here, "background" (only in the AI budget's background mode) while they are away. Each job
      // claims a paced share of the day, so the budget is spread over the whole day (R1-106).
      const context = present ? "present" : "background";
      await drainSlurpPendingText(app.db, SCHEDULED_DRAIN_LIMIT, context).catch((error: unknown) =>
        logger.warn(error, "[slurp-pending] Scheduled drain failed"),
      );
      // Written replies to comments stay present-only work (R1-105).
      if (present)
        await drainSlurpAudienceReplies(app.db).catch((error: unknown) =>
          logger.warn(error, "[slurp-audience-reply] Scheduled drain failed"),
        );
      await drainSlurpContinuityExtraction(app.db, context).catch((error: unknown) =>
        logger.warn(error, "[slurp-continuity] Scheduled drain failed"),
      );
    })();
    try {
      await active;
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      logger.warn(error, "[slurp-world] Tick failed");
    } finally {
      active = null;
      schedule(slurpPollBackoffMs(pollMs, consecutiveFailures));
    }
  };
  const stop = async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    await active?.catch(() => {});
  };
  registerStop?.(stop);
  schedule(INITIAL_DELAY_MS);
  app.addHook("onClose", stop);
  return { stop };
}
