import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { slurpPollBackoffMs } from "./slurp-poll-backoff.js";
import { advanceSlurpWorld } from "./slurp-world.operation.js";

/**
 * The background half of the world clock.
 *
 * The maintainer asked for a few catch-ups a day rather than a constant simulation, so this polls
 * slowly. The catch-up when the player opens Slurp does the same work through the same function;
 * this exists so a session left open still sees the world move, and so a long stretch is already
 * partly applied before the player arrives.
 *
 * Every action it takes is free-tier. Nothing here calls the model.
 */
const INITIAL_DELAY_MS = 90_000;

/** Four times a day. Often enough that the world is never far behind, rare enough to stay quiet. */
const POLL_MS = 6 * 60 * 60 * 1000;

export function startSlurpWorldScheduler(app: FastifyInstance, registerStop?: (stop: () => Promise<void>) => void) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active: Promise<unknown> | null = null;
  let consecutiveFailures = 0;
  const schedule = (delay: number) => {
    if (stopped) return;
    timer = setTimeout(() => void poll(), delay);
    timer.unref?.();
  };
  const poll = async () => {
    if (stopped || active) return;
    active = advanceSlurpWorld(app.db);
    try {
      const result = await active;
      if (result.actions > 0) logger.info("[slurp-world] Tick applied %d actions", result.actions);
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      logger.warn(error, "[slurp-world] Tick failed");
    } finally {
      active = null;
      schedule(slurpPollBackoffMs(POLL_MS, consecutiveFailures));
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
