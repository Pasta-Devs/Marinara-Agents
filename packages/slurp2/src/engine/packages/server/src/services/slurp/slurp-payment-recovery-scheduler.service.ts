import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { createSlurpMessagesStorage } from "../storage/slurp-messages.storage.js";

const POLL_MS = 60_000;

/** Revisit fresh charging intents after their five-minute lease expires. */
export function startSlurpPaymentRecoveryScheduler(
  app: FastifyInstance,
  registerStop?: (stop: () => Promise<void>) => void,
) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active: Promise<void> | null = null;

  const pollNow = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (active) return active;
    active = createSlurpMessagesStorage(app.db)
      .recoverPendingPayments()
      .catch((error) => logger.warn(error, "[slurp-payment] durable recovery poll failed"))
      .finally(() => {
        active = null;
      });
    return active;
  };
  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(async () => {
      timer = null;
      await pollNow();
      schedule();
    }, POLL_MS);
    timer.unref?.();
  };
  const stop = async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    await active?.catch(() => undefined);
  };

  registerStop?.(stop);
  app.addHook("onClose", stop);
  schedule();
  return { pollNow, stop };
}
