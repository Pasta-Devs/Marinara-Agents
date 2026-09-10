import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { createSlurpMessagesStorage } from "../storage/slurp-messages.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { isFollowUpDue, formatFollowUpContext, type ScheduledFollowUp } from "./slurp-follow-up.js";
import { generateSlurpMessageReply } from "./slurp-message-generation.service.js";
import { resolveSlurpTextConnection } from "./slurp-connection.js";
import { describeSlurpDayVibe } from "./slurp-day-vibe.service.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { newId, now } from "../../utils/id-generator.js";
import { slurpPollBackoffMs } from "./slurp-poll-backoff.js";
import { activeSlurpStrikes } from "./slurp-stance.js";

const INITIAL_DELAY_MS = 60_000; // Start after 1 minute
const POLL_MS = 120_000; // Check every 2 minutes

/**
 * Poll for threads with pending Creator-initiated follow-ups.
 *
 * Processes reminders, task updates, promise deliveries, and proactive check-ins.
 */
export function startSlurpFollowUpScheduler(app: FastifyInstance, registerStop?: (stop: () => Promise<void>) => void) {
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;
  let active: Promise<void> | null = null;
  let consecutiveFailures = 0;

  const schedule = (delayMs: number) => {
    if (stopped) return;
    timer = setTimeout(() => poll(), delayMs);
  };

  const poll = async () => {
    if (stopped || active) return;
    active = (async () => {
      const messages = createSlurpMessagesStorage(app.db);
      const slurp = createSlurpStorage(app.db);
      const settings = await slurp.getSettings();
      const connection = await resolveSlurpTextConnection(
        createConnectionsStorage(app.db),
        settings.generationConnectionId,
      );
      if (!connection) {
        logger.warn("[slurp-follow-up] No text connection configured, skipping follow-up generation");
        return;
      }

      const dueThreads = await messages.getThreadsWithDueFollowUps();
      let failed = false;

      for (const threadRow of dueThreads) {
        if (stopped) break;

        try {
          const followUp: ScheduledFollowUp = threadRow.dueFollowUp;
          if (!isFollowUpDue(followUp)) continue;

          if (!(await messages.claimScheduledFollowUp(followUp.id))) continue;

          logger.info(
            "[slurp-follow-up] Generating follow-up for thread %s: %s (%s)",
            threadRow.id,
            followUp.reason,
            followUp.type,
          );

          const thread = await messages.getThreadById(threadRow.id);
          if (!thread || thread.state !== "active") {
            await messages.cancelScheduledFollowUp(threadRow.id, followUp.id);
            continue;
          }

          const creator = await slurp.getNoodlerAccountById(threadRow.creatorAccountId);
          const viewer = await slurp.getViewer(threadRow.viewerAccountId);
          if (!creator || !viewer) {
            await messages.cancelScheduledFollowUp(threadRow.id, followUp.id);
            continue;
          }

          const history = await messages.listMessages(threadRow.id, 60);
          const messaging = await messages.getCreatorMessaging(threadRow.creatorAccountId);
          const subscriptions = await slurp.listSubscriptionsForViewer(threadRow.viewerAccountId);
          const subscribed = subscriptions.some((entry) => entry.creatorAccountId === threadRow.creatorAccountId);

          // Add the scheduled reason to the normal guidance so the model knows why it is writing.
          const reply = await generateSlurpMessageReply({
            db: app.db,
            creator,
            viewer,
            history,
            rapport: thread.rapport,
            subscribed,
            dmPolicy: messaging.dmPolicy,
            isRequest: false,
            mood: thread.mood,
            moodUpdatedAt: thread.moodUpdatedAt,
            notes: thread.notes,
            threadState: thread.threadState,
            creatorState: await slurp.getCreatorState(threadRow.creatorAccountId),
            dayVibe: await describeSlurpDayVibe(app.db, threadRow.creatorAccountId),
            coolingOff: false,
            strikes: activeSlurpStrikes(thread.strikes, thread.lastStrikeAt),
            connection,
            generationGuidance: formatFollowUpContext(followUp),
          });

          // Store the follow-up message
          const timestamp = now();
          const message = {
            id: newId(),
            threadId: threadRow.id,
            role: "creator" as const,
            kind: "text" as const,
            content: reply.content,
            price: 0,
            imageUrl: null,
            imageClaimToken: null,
            imageLeaseUntil: null,
            imageMetadata: null,
            unlockedAt: null,
            metadata: JSON.stringify({
              followUp: true,
              followUpType: followUp.type,
              followUpSequence: followUp.sequenceNumber,
            }),
            createdAt: timestamp,
          };

          const stored = await messages.appendMessage(threadRow.id, {
            id: message.id,
            senderAccountId: threadRow.creatorAccountId,
            role: "creator",
            content: message.content,
            createdAt: message.createdAt,
            preserveReplyObligation: true,
            scheduledFollowUpId: followUp.id,
            metadata: JSON.parse(message.metadata),
          });
          if (!stored) throw new Error(`Thread ${threadRow.id} disappeared while storing follow-up`);
          await messages.recordReplyOutcome(threadRow.id, {
            moodShift: reply.moodShift,
            remember: reply.remember,
            stateSignals: reply.stateSignals,
          });

          logger.info(
            "[slurp-follow-up] Sent %s follow-up for thread %s%s",
            followUp.type,
            threadRow.id,
            followUp.sequenceNumber ? ` (${followUp.sequenceNumber}/${followUp.totalInSequence})` : "",
          );
        } catch (error) {
          await messages.failScheduledFollowUp(threadRow.id, threadRow.dueFollowUp.id).catch(() => {});
          logger.error(error, "[slurp-follow-up] Failed to generate follow-up for thread %s", threadRow.id);
          failed = true;
        }
      }

      if (failed) throw new Error("Follow-up generation failed for one or more threads");
    })();

    try {
      await active;
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      logger.warn(error, "[slurp-follow-up] Follow-up poll failed");
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

  schedule(INITIAL_DELAY_MS);
  if (registerStop) registerStop(stop);
  logger.info("[slurp-follow-up] Follow-up scheduler started");
  return stop;
}
