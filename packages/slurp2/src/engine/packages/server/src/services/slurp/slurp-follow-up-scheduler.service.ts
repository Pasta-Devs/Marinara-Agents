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
import { activeSlurpStrikes, SLURP_COOL_OFF_HOURS, type SlurpStanceLatitude } from "./slurp-stance.js";
import { resolveSlurpCreatorAvailability } from "./slurp-creator-schedule-context.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { isNoodlerNightQuietTime } from "./slurp-reserve.operation.js";

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

          // A scheduled follow-up is still the Creator speaking, so it obeys the same silences the
          // reply path obeys: a cool-off she started, night quiet, and her own offline schedule.
          const coolingOff = Boolean(thread.coolUntil && thread.coolUntil > new Date().toISOString());
          const source = await slurp.resolveAccountSource(creator);
          const availability = source
            ? await resolveSlurpCreatorAvailability(
                createCharactersStorage(app.db),
                source,
                undefined,
                new Date(),
                undefined,
              )
            : { online: true, activity: null, minutesUntilOnline: 0 };
          const quiet = settings.nightQuiet && isNoodlerNightQuietTime(new Date());
          if (coolingOff || quiet || !availability.online) {
            const delayMinutes = coolingOff
              ? Math.max(1, Math.ceil((Date.parse(thread.coolUntil as string) - Date.now()) / 60_000))
              : Math.max(15, availability.minutesUntilOnline || 60);
            await messages.postponeScheduledFollowUp(
              threadRow.id,
              followUp.id,
              new Date(Date.now() + delayMinutes * 60_000).toISOString(),
            );
            logger.info(
              "[slurp-follow-up] Postponed follow-up %s for %d minute(s) (%s)",
              followUp.id,
              delayMinutes,
              coolingOff ? "cooling off" : quiet ? "night quiet" : "offline",
            );
            continue;
          }

          const history = await messages.listMessages(threadRow.id, 60);
          const messaging = await messages.getCreatorMessaging(threadRow.creatorAccountId);
          // The operator turned this Creator's unprompted messages off, so the queued follow-up
          // is dropped rather than postponed: it is never going to be allowed to send.
          if (!messaging.proactiveMessages) {
            await messages.cancelScheduledFollowUp(threadRow.id, followUp.id);
            continue;
          }
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
            coolingOff,
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
          // A follow-up reply changes the Creator and the thread exactly like a normal reply does.
          await slurp
            .recordCreatorStateSignals(threadRow.creatorAccountId, reply.stateSignals)
            .catch((error: unknown) => logger.warn(error, "[slurp-follow-up] Could not record creator state signals"));
          await applyFollowUpBoundary(messages, threadRow.id, reply.latitude).catch((error: unknown) =>
            logger.warn(error, "[slurp-follow-up] Could not apply the conversation boundary"),
          );

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

/** Same boundary rules as the reply path: cool-off pauses the thread, close ends it. */
async function applyFollowUpBoundary(
  messages: ReturnType<typeof createSlurpMessagesStorage>,
  threadId: string,
  latitude: SlurpStanceLatitude,
): Promise<void> {
  if (latitude === "cool_off") {
    await messages.beginCoolOff(threadId, SLURP_COOL_OFF_HOURS);
    return;
  }
  if (latitude === "close") await messages.closeThreadByCreator(threadId);
}
