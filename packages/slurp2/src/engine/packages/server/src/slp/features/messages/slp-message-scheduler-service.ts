import type { FastifyInstance } from "fastify";
import { logger } from "../../../lib/logger.js";
import { createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createSlurpReplyQueueStorage } from "../../data/messages/slp-reply-queue-storage.js";
import { deliverDueSlurpCommissions } from "./commissions/slp-commission-delivery-service.js";
import { replyToSlurpMessage } from "./slp-message-operation.js";
import { slurpPollBackoffMs } from "../../base/model/slp-poll-backoff.js";

const INITIAL_DELAY_MS = 15_000;
// Delayed reply bubbles are timed in seconds, and a 60 s poll delivered every second bubble a
// minute later. A tick is cheap reads unless something is due.
// ponytail: fixed 15 s tick; deliver due bubbles on thread read if this is still too coarse.
const POLL_MS = 15_000;

/** Poll queued threads. Availability is checked again by the operation before generation. */
export function startSlurpMessageScheduler(app: FastifyInstance, registerStop?: (stop: () => Promise<void>) => void) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active: Promise<void> | null = null;
  let consecutiveFailures = 0;
  let deliveryTimer: ReturnType<typeof setTimeout> | null = null;
  let delivering: Promise<void> | null = null;
  const schedule = (delay: number) => {
    if (!stopped) {
      timer = setTimeout(() => void poll(), delay);
      timer.unref?.();
    }
  };
  // Delivery owes the model nothing, so it runs on its own clock. Sharing the reply loop's backoff
  // held every delayed bubble for up to 30 minutes whenever one thread's generation kept failing.
  const scheduleDelivery = (delay: number) => {
    if (!stopped) {
      deliveryTimer = setTimeout(() => void deliver(), delay);
      deliveryTimer.unref?.();
    }
  };
  const deliver = async () => {
    if (stopped || delivering) return;
    delivering = (async () => {
      const storage = createSlurpMessagesStorage(app.db);
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
        try {
          const thread = await storage.getThreadById(bubble.threadId);
          if (
            !thread ||
            thread.state === "declined" ||
            bubble.senderAccountId !== thread.creatorAccountId ||
            bubble.generationEpoch !== thread.generationEpoch
          ) {
            await replyQueue.remove(bubble.id);
            continue;
          }
          const stored = await storage.appendMessage(bubble.threadId, {
            id: bubble.messageId,
            senderAccountId: bubble.senderAccountId,
            role: "creator",
            content: bubble.content,
            // Keep the original trigger for obligation checks, but order the stored message by delivery.
            createdAt: new Date().toISOString(),
            replyObligationCreatedAt: bubble.createdAt,
            replyBubbleId: bubble.id,
          });
          if (stored === null) await replyQueue.remove(bubble.id);
        } catch (error) {
          logger.warn(error, "[slurp-message] Failed to deliver bubble %s", bubble.id);
        }
      }
    })();
    try {
      await delivering;
    } catch (error) {
      logger.warn(error, "[slurp-message] bubble delivery failed");
    } finally {
      delivering = null;
      scheduleDelivery(POLL_MS);
    }
  };
  const poll = async () => {
    if (stopped || active) return;
    active = (async () => {
      const storage = createSlurpMessagesStorage(app.db);
      let failed = false;
      // Off means the background loop stays asleep. Queued bubbles and commissions above are not
      // gated on it: those are already-sent and already-paid-for, and holding them back would lose
      // half a reply rather than prevent one.
      const awayReplies = (await createSlurpStorage(app.db).getSettings()).messagesAwayRepliesEnabled;
      for (const thread of awayReplies ? await storage.listThreadsAwaitingReply() : []) {
        if (stopped) break;
        // The fan's newest message is the one being answered, even when a creator bubble or
        // follow-up was stored after it.
        const triggerMessageId = await storage.latestViewerMessageId(thread.id);
        // An obligation whose trigger already has a stored reply is finished. Without this the
        // thread is re-selected every tick and holds one of the twenty oldest-first slots forever.
        const answered = triggerMessageId ? await storage.getCompletedReply(thread.id, triggerMessageId) : null;
        if (answered && (await storage.getMessageById(answered))) {
          await storage.clearReplyObligation(thread.id);
          continue;
        }
        if (triggerMessageId) {
          const outcome = await replyToSlurpMessage(app.db, {
            threadId: thread.id,
            triggerMessageId,
            force: true,
            background: true,
          });
          // `replyToSlurpMessage` reports a provider failure instead of rejecting. Discarding it
          // left `consecutiveFailures` at zero, so a dead connection was retried at full rate.
          if (outcome.status === "failed") {
            failed = true;
            // The failing thread steps back on its own. Left oldest-first, it took the first slot
            // every tick and each retry spent model budget.
            // ponytail: fixed 10 min per-thread wait; store a failure count if this needs to grow.
            await storage.setReplyNotBefore(thread.id, new Date(Date.now() + 10 * 60_000).toISOString());
          }
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
    if (deliveryTimer) clearTimeout(deliveryTimer);
    await Promise.all([active?.catch(() => {}), delivering?.catch(() => {})]);
  };
  registerStop?.(stop);
  schedule(INITIAL_DELAY_MS);
  scheduleDelivery(INITIAL_DELAY_MS);
  app.addHook("onClose", stop);
  return { stop };
}
