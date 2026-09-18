// ──────────────────────────────────────────────
// Storage: Slurp direct messages
// ──────────────────────────────────────────────
//
// Its own module rather than more of `slurp.storage.ts`, which is already past five thousand
// lines. It composes that storage for accounts, subscriptions, and the wallet instead of
// reimplementing them, so a DM tip and a profile tip move coins through exactly one code path.
import { tolerateMissingTables } from "../../base/host/slp-host-tables.js";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, or } from "../../../db/file-query.js";
import { newId } from "../../../utils/id-generator.js";
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import {
  slurpCommissions,
  slurpPaymentCompensations,
  slurpMessageClaims,
  slurpMessages,
  slurpReplyBubbles,
  slurpFollowUps,
  slurpThreads,
} from "../../../db/schema/slurp.js";
import { isSlurpFileUniqueConstraintError } from "../../base/host/slp-file-errors.js";
import { applySlurpMood, type SlurpMoodShift } from "../../modules/world/slp-mood.js";
import {
  applySlurpThreadNotes,
  readStoredNotes,
  type SlurpNoteOperation,
  type SlurpThreadNote,
} from "../../modules/messages/slp-thread-notes.js";
import {
  SLURP_THREAD_STATE_DEFAULT,
  applySlurpThreadStateSignals,
  type SlurpCreatorStateSignal,
} from "../../modules/creators/slp-creator-state.js";
import { activeSlurpStrikes } from "../../modules/world/slp-stance.js";
import { SLURP_ONLINE_AFTER_DELIVERY_MINUTES } from "../../modules/messages/slp-conversation-momentum.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { createSlurpEventsStorage } from "../notifications/slp-notification-storage.js";
import { createSlurpPopulationStorage } from "../audience/slp-audience-storage-funnel.js";
import {
  slurpFanTypeCommissionBudget,
  slurpFanTypeWeeklyBudget,
  slurpResolveFanType,
} from "../../modules/audience/slp-fan-types.js";
import {
  admitSlurpThread,
  readSlurpCreatorMessaging,
  slurpMessagePreview,
  SLURP_CREATOR_MESSAGING_KEY,
  SLURP_DEFAULT_CREATOR_MESSAGING,
  type SlurpCreatorMessaging,
  type SlurpMessageKind,
} from "../../modules/messages/slp-messaging.js";
import {
  emptySlurpRapportFacts,
  scoreSlurpRapport,
  type SlurpRapport,
  type SlurpRapportFacts,
} from "../../modules/messages/slp-rapport.js";
import { createSlurpReplyQueueStorage } from "./slp-reply-queue-storage.js";
import { SLURP_COMMISSION_MAX_HAGGLE_ROUNDS, slurpCreatorHaggle } from "../../modules/economy/slp-creator-pricing.js";
import { DAY, int, json, mapCommission, mapMessage, mapThread, now } from "./slp-messages-storage-helpers.js";
import type {
  SlurpCommission,
  SlurpMessage,
  SlurpSendResult,
  SlurpThread,
  SlurpThreadView,
} from "./slp-messages-storage-types.js";
import { createSlurpReplyMethods } from "./slp-reply-storage-methods.js";
import type { SlurpMessagesContext } from "./slp-messages-storage-context.js";

export function createMessagesStorageActions(context: SlurpMessagesContext) {
  const {
    db,
    slurp,
    settingsStore,
    readMessagingBlob,
    messagingDefaults,
    messageUnlocks,
    directMessageTips,
    commissionOperations,
    paymentIntentClaims,
    slurpDatabases,
    compensateSlurpPayment,
    persistSlurpPaymentCreditedAmount,
    createSlurpPaymentIntent,
    resetSlurpPaymentIntentAfterInsufficientFunds,
    markSlurpPaymentIntentCharged,
    recoverChargingSlurpPayment,
    completeSlurpPaymentIntent,
    applySlurpTipEffects,
    applyPaymentTieOnce,
    hasCompletedSlurpPaymentOperation,
    queueCommissionOperation,
  } = context;
  return {
    /**
     * Send as the viewer. Opens the thread when there is none, so the caller never has to know
     * whether this is a first contact or the fortieth message.
     */
    async sendViewerMessage(
      viewerAccountId: string,
      creatorAccountId: string,
      content: string,
      requestId?: string,
    ): Promise<SlurpSendResult> {
      const opened = await context.storage.openThread(viewerAccountId, creatorAccountId, "viewer");
      if (opened.status !== "ok") return opened;
      if (requestId) {
        const existing = (await context.storage.listMessages(opened.thread.id)).find(
          (message) => message.role === "viewer" && message.metadata.requestId === requestId,
        );
        if (existing) return { status: "sent", thread: opened.thread, message: existing };
      }
      const message = await context.storage.appendMessage(opened.thread.id, {
        id: requestId ? `dm:${requestId}:message` : undefined,
        senderAccountId: viewerAccountId,
        role: "viewer",
        content,
        metadata: requestId ? { requestId } : undefined,
      });
      if (!message) return { status: "not_found" };
      await slurp.recordCreatorEvent(creatorAccountId, "message", {
        subjectId: opened.thread.id,
        actorLabel: viewerAccountId,
      });
      // Writing to somebody is engagement, and it reached the funnel nowhere. Every other action
      // advanced the tie, so a fan who wrote daily kept a `lastSeenAt` that never moved and was
      // marked `cooling`, then `burnout`, for doing the most engaged thing available.
      await slurp.advanceAudienceTie(viewerAccountId, creatorAccountId, { stage: "viewer", interactions: 1 });
      const thread = await context.storage.getThreadById(opened.thread.id);
      return { status: "sent", thread: thread ?? opened.thread, message };
    },
    /**
     * Tip inside a thread. The coins move through the same `tipCreator` the profile page uses,
     * so a DM tip lands in the ledger and in rapport identically to one sent from a profile.
     */
    async tipInThread(
      viewerAccountId: string,
      creatorAccountId: string,
      amount: number,
      note: string,
      requestId?: string,
    ): Promise<SlurpSendResult> {
      if (requestId) {
        const key = `${viewerAccountId}:${creatorAccountId}:${requestId}`;
        const previous = directMessageTips.get(key) ?? Promise.resolve(null);
        const current = previous
          .catch(() => null)
          .then(() => context.storage.tipInThreadUnlocked(viewerAccountId, creatorAccountId, amount, note, requestId));
        directMessageTips.set(key, current);
        try {
          return await current;
        } finally {
          if (directMessageTips.get(key) === current) directMessageTips.delete(key);
        }
      }
      return context.storage.tipInThreadUnlocked(viewerAccountId, creatorAccountId, amount, note);
    },
    async tipInThreadUnlocked(
      viewerAccountId: string,
      creatorAccountId: string,
      amount: number,
      note: string,
      requestId?: string,
    ): Promise<SlurpSendResult> {
      const opened = await context.storage.openThread(viewerAccountId, creatorAccountId, "viewer");
      if (opened.status !== "ok") return opened;
      const settings = await slurp.getSettings();
      const tipId = requestId ?? newId();
      const tipOperationId = `dm:${tipId}:credit`;
      if (requestId) {
        const existing = (await context.storage.listMessages(opened.thread.id)).find(
          (message) => message.kind === "tip" && message.metadata.requestId === requestId,
        );
        if (existing) {
          if (settings.walletEnabled) {
            await completeSlurpPaymentIntent(slurp, tipOperationId);
            await applySlurpTipEffects(slurp, tipOperationId).catch((error) =>
              console.error("[slurp] tip effects failed", error),
            );
          }
          return { status: "sent", thread: opened.thread, message: existing };
        }
      }
      let message: SlurpMessage | null;
      let charged = false;
      if (settings.walletEnabled) {
        const paymentIntent = await createSlurpPaymentIntent(
          slurp,
          {
            viewerAccountId,
            creatorAccountId,
            price: amount,
            note: "direct-message tip",
            creditOperationId: tipOperationId,
          },
          tipOperationId,
        );
        if (paymentIntent === "settled") {
          const existing = await context.storage.getMessageById(`dm:${tipId}:tip`);
          if (existing) {
            await applySlurpTipEffects(slurp, tipOperationId).catch((error) =>
              console.error("[slurp] tip effects failed", error),
            );
            return { status: "sent", thread: opened.thread, message: existing };
          }
        }
        if (paymentIntent !== "claimed") return { status: "not_found" };
      }
      try {
        if (settings.walletEnabled) {
          const wallet = await slurp.tipCreator(viewerAccountId, creatorAccountId, amount, tipOperationId);
          if (!wallet) {
            await resetSlurpPaymentIntentAfterInsufficientFunds(slurp, tipOperationId);
            return { status: "insufficient_funds", required: amount };
          }
          await markSlurpPaymentIntentCharged(slurp, tipOperationId);
          await persistSlurpPaymentCreditedAmount(slurp, tipOperationId, creatorAccountId, tipOperationId);
          charged = true;
        }
        message = await context.storage.appendMessage(opened.thread.id, {
          id: `dm:${tipId}:tip`,
          senderAccountId: viewerAccountId,
          role: "viewer",
          kind: "tip",
          content: note,
          price: amount,
          metadata: { ...(requestId ? { requestId } : {}), tipId },
        });
      } catch (error) {
        if (
          settings.walletEnabled &&
          (charged || (await slurp.hasWalletSpendOperation(viewerAccountId, tipOperationId)))
        ) {
          await compensateSlurpPayment(
            slurp,
            {
              viewerAccountId,
              creatorAccountId,
              price: amount,
              note: "failed direct-message tip",
              creditOperationId: tipOperationId,
            },
            error,
            tipOperationId,
          );
        } else if (settings.walletEnabled) {
          await resetSlurpPaymentIntentAfterInsufficientFunds(slurp, tipOperationId);
        }
        throw error;
      }
      if (!message) {
        if (settings.walletEnabled) {
          await compensateSlurpPayment(
            slurp,
            {
              viewerAccountId,
              creatorAccountId,
              price: amount,
              note: "failed direct-message tip",
              creditOperationId: tipOperationId,
            },
            new Error("Direct-message tip message was not persisted"),
            tipOperationId,
          );
        }
        return { status: "not_found" };
      }
      if (settings.walletEnabled) await completeSlurpPaymentIntent(slurp, tipOperationId);
      if (settings.walletEnabled)
        await applySlurpTipEffects(slurp, tipOperationId).catch((error) =>
          console.error("[slurp] tip effects failed", error),
        );
      const thread = await context.storage.getThreadById(opened.thread.id);
      return { status: "sent", thread: thread ?? opened.thread, message };
    },
    /** Accept or decline a pending request. Only the creator side calls this. */
    async resolveRequest(threadId: string, decision: "accept" | "decline"): Promise<SlurpThread | null> {
      const thread = await context.storage.getThreadById(threadId);
      if (!thread || thread.state !== "request") return thread;
      await db
        .update(slurpThreads)
        .set({ state: decision === "accept" ? "active" : "declined", updatedAt: now() })
        .where(eq(slurpThreads.id, threadId));
      const resolved = await context.storage.getThreadById(threadId);
      return resolved;
    },
    /**
     * Record what one generated reply did to the conversation.
     *
     * Mood and notes are written together because they arrive together, on the reply that already
     * ran. Neither costs an extra model call, and neither may fail the reply: a message with good
     * words and no mood is still the thing the fan asked for.
     */
    async recordReplyOutcome(
      threadId: string,
      input: { moodShift: SlurpMoodShift; remember: SlurpNoteOperation[]; stateSignals?: SlurpCreatorStateSignal[] },
    ): Promise<void> {
      const thread = await context.storage.getThreadById(threadId);
      if (!thread) return;
      const timestamp = now();
      const minutesSinceUpdate = thread.moodUpdatedAt
        ? Math.max(0, (Date.parse(timestamp) - Date.parse(thread.moodUpdatedAt)) / 60_000)
        : 0;
      const mood = applySlurpMood({
        mood: thread.mood,
        shift: input.moodShift,
        rapportScore: thread.rapport.score,
        minutesSinceUpdate,
      });
      await db
        .update(slurpThreads)
        .set({
          mood: String(mood),
          moodUpdatedAt: timestamp,
          notes: JSON.stringify(applySlurpThreadNotes(thread.notes, input.remember)),
          threadState: JSON.stringify(
            applySlurpThreadStateSignals(thread.threadState, input.stateSignals ?? [], timestamp),
          ),
          updatedAt: timestamp,
        })
        .where(eq(slurpThreads.id, threadId));
    },
    /** Coins this fan has put into this Creator: tips, unlocks and commissions together. */
    async spentWithCreator(viewerAccountId: string, creatorAccountId: string): Promise<number> {
      const facts = await context.storage.rapportFactsFor(viewerAccountId, creatorAccountId);
      return Math.max(0, Math.round(facts.tippedCoins + facts.unlockedCoins));
    },
    /**
     * The thread as the fan is allowed to see it.
     *
     * `slurp-rapport.ts` states the rule this keeps: "The score is never shown in a thread." A
     * number turns a person into a progress bar and teaches the player to farm it. The mood is the
     * same hazard and worse, because it moves fast enough to be tested against.
     *
     * So the fan's copy carries neither, nor the notes, nor the strike count. Stripping it here
     * rather than in the client is what stops the next endpoint leaking it by default.
     */
    forViewer(thread: SlurpThread): SlurpThread {
      return {
        ...thread,
        mood: 0,
        moodUpdatedAt: null,
        strikes: 0,
        lastStrikeAt: null,
        notes: [],
        threadState: { ...SLURP_THREAD_STATE_DEFAULT, updatedAt: thread.updatedAt },
        rapport: { ...thread.rapport, score: 0, contributions: [] },
      };
    },
    /**
     * Carry what happened in public into the conversation.
     *
     * A creator who forgave in the comments what she would not forgive in a direct message would
     * not read as one person, so a comment moves the same number a DM does.
     *
     * ponytail: only lands when a thread already exists. Being rude to somebody you have never
     * written to is dropped; carry it on the audience tie if that gap starts to matter.
     */
    async applyExternalMoodShift(
      viewerAccountId: string,
      creatorAccountId: string,
      shift: SlurpMoodShift,
    ): Promise<void> {
      if (shift === "same") return;
      const thread = await context.storage.getThread(viewerAccountId, creatorAccountId);
      if (!thread) return;
      await context.storage.recordReplyOutcome(thread.id, { moodShift: shift, remember: [] });
    },
    /**
     * The creator steps away from this conversation.
     *
     * A strike is recorded at the same time. Two inside `SLURP_STRIKE_WINDOW_DAYS` is what closes
     * the thread for good, so the count and the clock have to move together or a pattern could
     * never be told apart from a bad afternoon.
     */
    async beginCoolOff(threadId: string, hours: number): Promise<void> {
      const thread = await context.storage.getThreadById(threadId);
      if (!thread) return;
      const timestamp = now();
      await db
        .update(slurpThreads)
        .set({
          coolUntil: new Date(Date.now() + hours * 3_600_000).toISOString(),
          strikes: String(activeSlurpStrikes(thread.strikes, thread.lastStrikeAt) + 1),
          lastStrikeAt: timestamp,
          updatedAt: timestamp,
        })
        .where(eq(slurpThreads.id, threadId));
      await createSlurpReplyQueueStorage(db).removeForThread(threadId);
    },
    /**
     * The creator ends the conversation.
     *
     * `declined` is the state the schema, the localized labels and `admitSlurpThread` already
     * ship, and that guard already refuses to reopen a declined thread even if the fan subscribes.
     * So the hard part was built long before anything could reach it.
     */
    async closeThreadByCreator(threadId: string): Promise<void> {
      const timestamp = now();
      await db
        .update(slurpThreads)
        .set({
          state: "declined",
          coolUntil: null,
          needsReply: "false",
          generationEpoch: String(Number((await context.storage.getThreadById(threadId))?.generationEpoch ?? 0) + 1),
          updatedAt: timestamp,
        })
        .where(eq(slurpThreads.id, threadId));
      await createSlurpReplyQueueStorage(db).removeForThread(threadId);
    },
    /**
     * Set extended online availability for a thread (hot conversation keeps Creator online).
     */

    /** Keep the Creator online in this thread for at least `minutes` more. Never shortens a longer window. */
    async keepOnlineFor(threadId: string, minutes: number): Promise<void> {
      const until = new Date(Date.now() + minutes * 60_000).toISOString();
      const current = (await context.storage.getThreadById(threadId))?.extendedOnlineUntil ?? null;
      if (current && current >= until) return;
      await context.storage.setExtendedOnline(threadId, until);
    },
    async adjustCheatState(threadId: string, input: { mood?: number; rapport?: number }): Promise<SlurpThread | null> {
      const thread = await context.storage.getThreadById(threadId);
      if (!thread) return null;
      const timestamp = now();
      const mood = input.mood == null ? thread.mood : Math.max(-100, Math.min(100, thread.mood + input.mood));
      const rapportScore =
        input.rapport == null ? thread.rapport.score : Math.max(0, Math.min(100, thread.rapport.score + input.rapport));
      const rapport = input.rapport == null ? thread.rapport : { ...thread.rapport, score: rapportScore };
      await db
        .update(slurpThreads)
        .set({
          mood: String(mood),
          ...(input.mood == null ? {} : { moodUpdatedAt: timestamp }),
          rapport: JSON.stringify(rapport),
          updatedAt: timestamp,
        })
        .where(eq(slurpThreads.id, threadId));
      return context.storage.getThreadById(threadId);
    },
  };
}
