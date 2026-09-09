import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { createSlurpMessagesStorage } from "../storage/slurp-messages.storage.js";
import { createSlurpReplyQueueStorage } from "../storage/slurp-reply-queue.storage.js";
import { deliverDueSlurpCommissions } from "./slurp-commission-delivery.service.js";
import { replyToSlurpMessage } from "./slurp-message.operation.js";
import { slurpPollBackoffMs } from "./slurp-poll-backoff.js";

const INITIAL_DELAY_MS = 45_000;
const POLL_MS = 60_000;

/** Poll queued threads. Availability is checked again by the operation before generation. */
export function startSlurpMessageScheduler(app: FastifyInstance, registerStop?: (stop: () => Promise<void>) => void) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active: Promise<void> | null = null;
  let consecutiveFailures = 0;
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
      let failed = false;
      // A commissioned piece is drawn and paid for at accept time and then held, so this owes the
      // model nothing — it is a clock running out. Done first, and separately, so a dead text
      // connection never keeps a finished commission from arriving.
      try {
        await deliverDueSlurpCommissions(app.db);
      } catch (error) {
        logger.warn(error, "[slurp-commission] scheduled delivery failed");
      }
      const replyQueue = createSlurpReplyQueueStorage(app.db);
      for (const bubble of await replyQueue.listDue()) {
        if (stopped) break;
        const thread = await storage.getThreadById(bubble.threadId);
        if (
          !thread ||
          thread.state === "declined" ||
          bubble.senderAccountId !== thread.creatorAccountId ||
          (thread.coolUntil && thread.coolUntil > new Date().toISOString())
        ) {
          await replyQueue.remove(bubble.id);
          continue;
        }
        await storage.appendMessage(bubble.threadId, {
          id: bubble.messageId,
          senderAccountId: bubble.senderAccountId,
          role: "creator",
          content: bubble.content,
          createdAt: bubble.createdAt,
          replyObligationCreatedAt: bubble.createdAt,
        });
        await replyQueue.remove(bubble.id);
      }
      for (const thread of await storage.listThreadsAwaitingReply()) {
        if (stopped) break;
        const unreadViewer = (await storage.listMessages(thread.id)).findLast(
          (message) => message.role === "viewer" && !message.readAt,
        );
        if (unreadViewer) {
          const outcome = await replyToSlurpMessage(app.db, {
            threadId: thread.id,
            triggerMessageId: unreadViewer.id,
            force: true,
          });
          // `replyToSlurpMessage` reports a provider failure instead of rejecting. Discarding it
          // left `consecutiveFailures` at zero, so a dead connection was retried at full rate.
          if (outcome.status === "failed") failed = true;
        }
      }
      if (failed) throw new Error("Queued Slurp reply generation failed");
    })();
    try {
      await active;
      consecutiveFailures = 0;
    } catch (error) {
      // Matches the auto-post and audience schedulers: a connection that keeps failing is retried
      // exponentially slower instead of once a minute forever.
      consecutiveFailures += 1;
      logger.warn(error, "[slurp-message] queued reply poll failed");
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
