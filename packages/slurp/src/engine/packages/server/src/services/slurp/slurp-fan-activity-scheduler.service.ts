import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { runNoodlerFanActivity, type NoodlerFanRunResult } from "./slurp-fan-activity.operation.js";

const INITIAL_DELAY_MS = 45_000;
const POLL_MS = 60_000;

export function startNoodlerFanActivityScheduler(app: FastifyInstance) {
  let stopped = false;
  let active: Promise<NoodlerFanRunResult> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (delay: number) => {
    if (stopped) return;
    timer = setTimeout(() => void poll(), delay);
    timer.unref?.();
  };
  const poll = async () => {
    if (stopped || active) return;
    active = runNoodlerFanActivity({
      db: app.db,
      mode: "automatic",
    });
    try {
      const result = await active;
      if (result.status === "generated" || result.status === "resumed") {
        logger.info("[noodler-fan] Audience run %s created %d interactions", result.status, result.created);
      }
    } catch (error) {
      logger.warn(error, "[noodler-fan] Automatic audience activity failed");
    } finally {
      active = null;
      schedule(POLL_MS);
    }
  };
  schedule(INITIAL_DELAY_MS);
  app.addHook("onClose", async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    await active?.catch(() => {});
  });
  return {
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      await active?.catch(() => {});
    },
  };
}
