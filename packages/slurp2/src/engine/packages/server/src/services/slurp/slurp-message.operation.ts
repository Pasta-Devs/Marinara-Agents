/**
 * Generate and store one creator reply in a direct-message thread.
 *
 * Mirrors `slurp-creator-reply.operation.ts`: claim, resolve a connection, generate, store, and
 * release after the visible bubble plus delayed batch are durable. The claim is what stops the live
 * send path and the offline scheduler from both answering the same message.
 */
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { resolveSlurpTextConnection } from "./slurp-connection.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { createSlurpMessagesStorage, type SlurpMessage } from "../storage/slurp-messages.storage.js";
import { createSlurpEventsStorage } from "../storage/slurp-events.storage.js";
import { tryNoodlerAccountOperation } from "./slurp-account-operation-lock.js";
import { generateSlurpMessageReply } from "./slurp-message-generation.service.js";
import { describeSlurpDayVibe } from "./slurp-day-vibe.service.js";
import { recoverSlurpMood } from "./slurp-mood.js";
import { activeSlurpStrikes, SLURP_COOL_OFF_HOURS, type SlurpStanceLatitude } from "./slurp-stance.js";
import { resolveSlurpCreatorAvailability } from "./slurp-creator-schedule-context.js";
import {
  calculateConversationMomentum,
  extendedOnlineDurationMinutes,
  shouldPauseMoodRecovery,
} from "./slurp-conversation-momentum.js";
import { readTalkativenessProfile, allowMultiBubbleSplit } from "./slurp-talkativeness.js";
import {
  slurpReplyBubbleDelayMs,
  slurpReplyPacing,
  splitSlurpReplyBurst,
  type SlurpReplyPacing,
} from "./slurp-messaging.js";
import { generateSlurpCommissionImage } from "./slurp-commission-image.operation.js";
import { slurpMessageMediaUrl } from "./slurp-media.js";
import { resolveSlurpMediaOffer } from "./slurp-media-offer.js";
import { slurpCreatorStateCanUseMedia } from "./slurp-creator-state.js";

export type SlurpReplyOutcome =
  | { status: "replied"; message: SlurpMessage; pacing: SlurpReplyPacing }
  | { status: "queued"; pacing: SlurpReplyPacing }
  /** The creator has stepped away from this conversation. `until` is when they come back. */
  | { status: "cooling"; until: string }
  | { status: "busy" }
  | { status: "ineligible" }
  | { status: "connection_not_found" }
  | { status: "failed"; error: string };

/**
 * Decide when the creator answers, and answer now if the answer is "now".
 *
 * `force` is the scheduler's entry point: the wait has already elapsed, so pacing only shapes
 * the typing indicator and never sends the work back to the queue a second time.
 */
export async function replyToSlurpMessage(
  db: DB,
  input: { threadId: string; triggerMessageId: string; force?: boolean; debugMode?: boolean },
): Promise<SlurpReplyOutcome> {
  const messagesStore = createSlurpMessagesStorage(db);
  const slurp = createSlurpStorage(db);
  const thread = await messagesStore.getThreadById(input.threadId);
  if (!thread || (thread.state !== "active" && thread.state !== "request")) return { status: "ineligible" };

  const [creator, viewer] = await Promise.all([
    slurp.getNoodlerAccountById(thread.creatorAccountId),
    slurp.getViewer(thread.viewerAccountId),
  ]);
  if (!creator || !viewer) return { status: "ineligible" };
  // A persona-backed Creator is operated by hand: it never auto-posts and it never answers a DM
  // on its own either. The operator writes the answer through the draft-reply route.
  if (creator.kind === "persona" && creator.sourceKind === "persona") return { status: "ineligible" };

  // Nothing outranks a boundary. A creator who has walked away from this conversation has walked
  // away from it, whatever the rapport, the schedule or the tone dial say.
  if (thread.coolUntil && thread.coolUntil > new Date().toISOString()) {
    return { status: "cooling", until: thread.coolUntil };
  }

  const source = await slurp.resolveAccountSource(creator);
  const latestPost = await slurp.getNoodlerLatestPublishedPost(creator.id);
  const replyDelays = await slurp.getSettings();
  const scheduled = source
    ? await resolveSlurpCreatorAvailability(
        createCharactersStorage(db),
        source,
        undefined,
        new Date(),
        latestPost?.createdAt ?? null,
        replyDelays,
      )
    : { online: true, activity: null, minutesUntilOnline: 0 };
  // An open conversation window keeps the Creator online; momentum alone never wakes her.
  const availability =
    thread.extendedOnlineUntil && thread.extendedOnlineUntil > new Date().toISOString()
      ? { online: true, activity: "chatting", minutesUntilOnline: 0 }
      : scheduled;

  const history = await messagesStore.listMessages(thread.id, 60);

  // Calculate conversation momentum
  const momentumAnalysis = calculateConversationMomentum(
    thread.lastMessageAt,
    history.map((m) => ({ role: m.role as "viewer" | "creator", createdAt: m.createdAt })),
  );

  // Clear extendedOnlineUntil if momentum is no longer hot
  if (momentumAnalysis.momentum !== "hot" && thread.extendedOnlineUntil) {
    await messagesStore.setExtendedOnline(thread.id, null).catch((error: unknown) => {
      logger.warn(error, "[slurp-message] Could not clear extended online for thread %s", thread.id);
    });
  }

  // Momentum can extend the stored conversation window, but it must not override a schedule that
  // says the Creator is offline. Only an online Creator can open or extend that window.

  // REMOVED: Busy check for pending replies - let fans send during Creator typing
  // if (await replyQueue.hasPending(thread.id)) return { status: "busy" };

  // A request can receive one guarded first answer. Storing that Creator answer promotes the
  // thread to active, because replying is itself a clear acceptance; after that, schedule and
  // subscription shape pacing and tone but cannot strand an already-started conversation.
  const isRequest = thread.state === "request";
  if (isRequest && history.some((message) => message.role === "creator")) return { status: "ineligible" };
  const trigger = history.find((message) => message.id === input.triggerMessageId) ?? history[history.length - 1];
  const triggerObligationCreatedAt = trigger?.createdAt ?? new Date().toISOString();
  const subscriptions = await slurp.listSubscriptionsForViewer(thread.viewerAccountId);
  const subscribed = subscriptions.some((entry) => entry.creatorAccountId === thread.creatorAccountId);

  // Read talkativeness profile from generated schedule if available
  const talkativenessProfile = readTalkativenessProfile({});

  // Calculate mood with recovery (but pause recovery if hot conversation + negative mood)
  const minutesSinceMoodUpdate = thread.moodUpdatedAt
    ? Math.max(0, (Date.now() - Date.parse(thread.moodUpdatedAt)) / 60_000)
    : 0;

  let currentMood = thread.mood;
  if (!shouldPauseMoodRecovery(momentumAnalysis.momentum, thread.mood)) {
    currentMood = recoverSlurpMood(thread.mood, minutesSinceMoodUpdate);
  }

  const pacing = slurpReplyPacing({
    online: availability.online,
    rapport: thread.rapport,
    subscribed,
    messageLength: trigger?.content.length ?? 0,
    minutesUntilOnline: availability.minutesUntilOnline,
    mood: currentMood,
    momentum: momentumAnalysis.momentum,
    // replyLength will be filled in after generation
    talkativeness: talkativenessProfile.talkativeness,
    delays: replyDelays,
  });
  const completedReplyId = await messagesStore.getCompletedReply(thread.id, input.triggerMessageId);
  if (completedReplyId) {
    const completedReply = await messagesStore.getMessageById(completedReplyId);
    if (completedReply) return { status: "replied", message: completedReply, pacing };
  }
  if ((pacing.mode === "queued" || pacing.mode === "delayed") && input.force !== true) {
    await messagesStore.setReplyNotBefore(thread.id, new Date(Date.now() + pacing.notBeforeMs).toISOString());
    // She has seen it and is not answering yet. That is the whole meaning of a queued reply, and
    // it was indistinguishable from the app being broken because nothing recorded the noticing.
    // "Seen, no reply" is the loudest thing this surface can say, and the timestamp already exists.
    // Mark read with slight delay for realism (not instant)
    setTimeout(
      () => {
        messagesStore.markRead(thread.id, "creator").catch((err) => {
          logger.error(err, "[slurp-message] Failed to mark thread %s as read", thread.id);
        });
      },
      Math.round(5000 + Math.random() * 25000),
    ); // 5-30 seconds
    return { status: "queued", pacing };
  }

  const claim = await messagesStore.claimReply(thread.id, input.triggerMessageId, thread.creatorAccountId);
  if (claim.status === "completed") {
    const completedReply = await messagesStore.getMessageById(claim.messageId);
    return completedReply ? { status: "replied", message: completedReply, pacing } : { status: "busy" };
  }
  if (claim.status !== "claimed") return { status: "busy" };
  const release = async () => {
    try {
      await messagesStore.releaseReplyClaim(claim.claimId);
    } catch (error) {
      logger.error(error, "[slurp-message] Failed to release the reply claim %s", claim.claimId);
    }
  };

  try {
    const locked = await tryNoodlerAccountOperation(thread.creatorAccountId, async () => {
      const settings = await slurp.getSettings();
      const connection = await resolveSlurpTextConnection(
        createConnectionsStorage(db),
        settings.generationConnectionId,
      );
      if (!connection) return { status: "connection_not_found" } as const;
      const messaging = await messagesStore.getCreatorMessaging(thread.creatorAccountId);
      const creatorState = await slurp.getCreatorState(thread.creatorAccountId);
      const reply = await generateSlurpMessageReply({
        db,
        creator,
        viewer,
        history,
        rapport: thread.rapport,
        subscribed,
        dmPolicy: messaging.dmPolicy,
        isRequest,
        mood: thread.mood,
        moodUpdatedAt: thread.moodUpdatedAt,
        notes: thread.notes,
        threadState: thread.threadState,
        creatorState,
        dayVibe: await describeSlurpDayVibe(db, thread.creatorAccountId),
        coolingOff: false,
        strikes: activeSlurpStrikes(thread.strikes, thread.lastStrikeAt),
        connection,
        debugMode: input.debugMode,
      });
      // Two or three messages when the conversation is going well, one when it is not. A creator
      // who always answers in exactly one tidy block reads as a form letter.
      // Settings caps the burst, energy still decides whether it earns the top of that cap. A limit
      // of one is a player asking for the tidy block instead of the texting rhythm.
      const burstLimit = Math.min(settings.messagesReplyBubbleLimit, creatorState.energy >= 70 ? 3 : 2);
      const shouldSplit = allowMultiBubbleSplit(talkativenessProfile.talkativeness, currentMood);
      const bubbles = splitSlurpReplyBurst(
        reply.content,
        burstLimit > 1 &&
          shouldSplit &&
          creatorState.energy >= 35 &&
          reply.latitude === "normal" &&
          reply.moodShift !== "down",
        burstLimit,
      );
      let stored = null;
      const queuedBubbles = [];
      for (const [index, bubble] of bubbles.entries()) {
        if (index === 0) continue;
        const delayMs = bubbles.slice(1, index + 1).reduce(
          (total, _, offset) =>
            total +
            slurpReplyBubbleDelayMs({
              bubbleIndex: offset + 1,
              bubbleCount: bubbles.length,
              previousBubble: bubbles[offset],
              nextBubble: bubbles[offset + 1]!,
              momentum: momentumAnalysis.momentum,
              mood: currentMood,
            }),
          0,
        );
        queuedBubbles.push({
          batchId: claim.claimId,
          sequence: index,
          threadId: thread.id,
          senderAccountId: thread.creatorAccountId,
          content: bubble,
          deliverAt: new Date(Date.now() + delayMs).toISOString(),
          generationEpoch: thread.generationEpoch,
          createdAt: triggerObligationCreatedAt,
        });
      }
      stored = await messagesStore.appendReplyBatch(thread.id, {
        first: { id: claim.claimId, senderAccountId: thread.creatorAccountId, content: bubbles[0] },
        delayed: queuedBubbles.map((bubble) => ({ ...bubble, id: `${claim.claimId}:${bubble.sequence}` })),
      });
      if (!stored) return { status: "ineligible" } as const;
      if (reply.sharedPost) {
        const postAccess = reply.sharedPost.access === "locked" ? "locked" : "public";
        const previewLocked =
          postAccess === "locked" ||
          (reply.sharedPost.access !== "public" && thread.rapport.tier !== "whale" && !subscribed);
        stored =
          (await messagesStore.appendMessage(thread.id, {
            senderAccountId: thread.creatorAccountId,
            role: "creator",
            kind: "post_preview",
            content: reply.sharedPost.title || reply.sharedPost.content.slice(0, 180),
            imageUrl: reply.sharedPost.imageUrl,
            metadata: {
              postId: reply.sharedPost.id,
              title: reply.sharedPost.title,
              content: reply.sharedPost.content,
              access: reply.sharedPost.access,
              previewLocked,
              shareReason: reply.sharePost !== undefined ? "relevant" : "tease",
            },
          })) ?? stored;
      }
      if (
        reply.image &&
        reply.canSendImage &&
        slurpCreatorStateCanUseMedia(creatorState, thread.threadState) &&
        input.force !== true
      ) {
        const imageAllowedBySettings = settings.enableImagePrompts === true;
        const recentGeneratedImage = history.some(
          (message) =>
            message.imageUrl &&
            typeof message.metadata.generatedContext === "string" &&
            Date.now() - Date.parse(message.createdAt) < 3 * 60 * 60_000,
        );
        const drawn =
          imageAllowedBySettings && !recentGeneratedImage
            ? await generateSlurpCommissionImage(db, {
                creatorAccountId: thread.creatorAccountId,
                brief: `${reply.image.prompt}\nImage mode: ${reply.imageMode}`,
              })
            : "unavailable";
        if (drawn !== "unavailable") {
          const offer = resolveSlurpMediaOffer({
            intent: reply.imageMode === "hostile" ? "hostile" : "friendly",
            rapportTier: thread.rapport.tier,
            subscribed,
            configuredPrice: messaging.ppvPrice,
          });
          const price = offer.price;
          const imageMessage = await messagesStore.appendMessage(thread.id, {
            senderAccountId: thread.creatorAccountId,
            role: "creator",
            kind: price > 0 ? "ppv" : "text",
            content: reply.image.caption,
            price,
            unlockedAt: price > 0 ? null : new Date().toISOString(),
            metadata: { noodlerMediaPath: drawn.mediaPath, generatedContext: reply.imageMode },
          });
          if (!imageMessage) {
            drawn.compensate();
          } else {
            drawn.promote();
            await messagesStore.setMessageMedia(
              imageMessage.id,
              slurpMessageMediaUrl(imageMessage.id),
              drawn.mediaPath,
            );
            stored = imageMessage;
          }
        }
      }
      // After the message is safely stored. The conversation's mood and what she now knows are
      // worth keeping, but never at the price of the reply itself.
      if (stored) {
        await messagesStore
          .recordReplyOutcome(thread.id, {
            moodShift: reply.moodShift,
            remember: reply.remember,
            stateSignals: reply.stateSignals,
          })
          .catch((error: unknown) => logger.warn(error, "[slurp-message] Could not record the reply outcome"));

        // Set extended online duration if momentum is hot
        if (momentumAnalysis.momentum === "hot" && availability.online) {
          const extendedDuration = extendedOnlineDurationMinutes(momentumAnalysis.momentum, thread.rapport.score);
          if (extendedDuration !== null) {
            const extendedUntil = new Date(Date.now() + extendedDuration * 60_000).toISOString();
            await messagesStore
              .setExtendedOnline(thread.id, extendedUntil)
              .catch((error: unknown) => logger.warn(error, "[slurp-message] Could not set extended online duration"));
          }
        }

        // Handle follow-up scheduling if AI signaled intent
        if (reply.followUp) {
          try {
            const { createScheduledFollowUps } = await import("./slurp-follow-up.js");

            // Link the follow-up to the promise note the reply just wrote. The note IDs only
            // exist after `recordReplyOutcome` applied the operations, so read the thread again.
            let relatedNoteId: string | undefined;
            if (reply.followUp.type === "promise_delivery" || reply.followUp.type === "task_update") {
              const { findPromiseNotes } = await import("./slurp-thread-notes.js");
              const refreshed = await messagesStore.getThreadById(thread.id);
              relatedNoteId = findPromiseNotes(refreshed?.notes ?? []).at(-1)?.id;
            }

            const followUps = createScheduledFollowUps(
              {
                type: reply.followUp.type,
                timing: reply.followUp.timing,
                count: reply.followUp.count ?? 1,
                reason: reply.followUp.reason,
                context: reply.followUp.context,
              },
              new Date(),
              relatedNoteId,
            );

            await messagesStore.addScheduledFollowUps(thread.id, followUps);
            logger.info(
              "[slurp-message] Scheduled %d follow-up(s) for thread %s: %s",
              followUps.length,
              thread.id,
              reply.followUp.reason,
            );
          } catch (error: unknown) {
            logger.warn(error, "[slurp-message] Could not schedule follow-ups");
          }
        } else {
          // Fallback: detect promises from natural language if AI didn't signal
          try {
            const { detectPromiseFromText, createScheduledFollowUps } = await import("./slurp-follow-up.js");
            const detected = detectPromiseFromText(reply.content);
            if (detected) {
              const followUps = createScheduledFollowUps(
                {
                  type: detected.type,
                  timing: detected.timing,
                  count: 1,
                  reason: detected.reason,
                  context: "Auto-detected from message content",
                },
                new Date(),
                undefined,
              );
              await messagesStore.addScheduledFollowUps(thread.id, followUps);
              logger.info("[slurp-message] Auto-detected promise in thread %s: %s", thread.id, detected.reason);
            }
          } catch (error: unknown) {
            logger.warn(error, "[slurp-message] Could not auto-detect promise");
          }
        }

        await slurp
          .recordCreatorStateSignals(thread.creatorAccountId, reply.stateSignals)
          .catch((error: unknown) => logger.warn(error, "[slurp-message] Could not record creator state signals"));
        // The reply is written first and the boundary applied after it, so the fan always receives
        // the words the creator actually left them with rather than silence.
        await applyBoundary(messagesStore, thread.id, reply.latitude).catch((error: unknown) =>
          logger.warn(error, "[slurp-message] Could not apply the conversation boundary"),
        );
        if (reply.latitude === "cool_off" || reply.latitude === "close") {
          const events = createSlurpEventsStorage(db);
          const operator = creator.sourceKind === "persona" ? creator.sourceEntityId : null;
          if (operator) {
            await events.recordAndPrune({
              recipientPersonaId: operator,
              kind: "message",
              creatorAccountId: creator.id,
              subjectId: thread.id,
              actorLabel: viewer.displayName,
            });
          }
        }
      }
      return stored ? ({ status: "replied", message: stored } as const) : ({ status: "ineligible" } as const);
    });
    // The account lock is already held by another Slurp operation on this creator. Nothing was
    // generated, so the caller may simply try again rather than treat this as a failure.
    if (!locked.acquired) return { status: "busy" };
    if (locked.value.status === "replied") {
      // Recalculate typing delay with actual reply content length
      const actualReplyLength = locked.value.message.content.length;
      const recalculatedPacing = slurpReplyPacing({
        online: availability.online,
        rapport: thread.rapport,
        subscribed,
        messageLength: trigger?.content.length ?? 0,
        minutesUntilOnline: availability.minutesUntilOnline,
        mood: currentMood,
        momentum: momentumAnalysis.momentum,
        replyLength: actualReplyLength,
        talkativeness: talkativenessProfile.talkativeness,
        delays: replyDelays,
      });
      return { status: "replied", message: locked.value.message, pacing: recalculatedPacing };
    }
    return locked.value;
  } catch (error) {
    logger.error(error, "[slurp-message] Reply generation failed for thread %s", thread.id);
    return { status: "failed", error: error instanceof Error ? error.message : "Reply generation failed." };
  } finally {
    await release();
  }
}

/**
 * Act on what the creator decided.
 *
 * `normal` and `curt` are tone and need nothing done to the thread: the words already carry them.
 * The other two change the thread's state, and only `slurp-stance.ts` can produce them — which is
 * where the tone dial caps what is reachable at all.
 */
async function applyBoundary(
  messagesStore: ReturnType<typeof createSlurpMessagesStorage>,
  threadId: string,
  latitude: SlurpStanceLatitude,
): Promise<void> {
  if (latitude === "cool_off") {
    await messagesStore.beginCoolOff(threadId, SLURP_COOL_OFF_HOURS);
    return;
  }
  if (latitude === "close") await messagesStore.closeThreadByCreator(threadId);
}
