import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { createSlurpMessagesStorage } from "../storage/slurp-messages.storage.js";
import { replyToSlurpMessage } from "./slurp-message.operation.js";

const INITIAL_DELAY_MS = 45_000;
const POLL_MS = 60_000;

/** Poll queued threads. Availability is checked again by the operation before generation. */
export function startSlurpMessageScheduler(app: FastifyInstance, registerStop?: (stop: () => Promise<void>) => void) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active: Promise<void> | null = null;
  const schedule = (delay: number) => {
    if (!stopped) {
      timer = setTimeout(() => void poll(), delay);
      timer.unref?.();
    }
  };
  const poll = async () => {
    if (stopped || active) return;
    active = (async () => {
      const storage = createSlurpMessagesStorage(app.db);
      for (const thread of await storage.listThreadsAwaitingReply()) {
        if (stopped) break;
        const latest = (await storage.listMessages(thread.id, 1))[0];
        if (latest?.role === "viewer") {
          await replyToSlurpMessage(app.db, { threadId: thread.id, triggerMessageId: latest.id, force: true });
        }
      }
    })();
    try {
      await active;
    } catch (error) {
      logger.warn(error, "[slurp-message] queued reply poll failed");
    } finally {
      active = null;
      schedule(POLL_MS);
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
