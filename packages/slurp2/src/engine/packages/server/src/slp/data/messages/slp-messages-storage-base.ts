// ──────────────────────────────────────────────
// Storage: Slurp direct messages
// ──────────────────────────────────────────────
//
// Its own module rather than more of `slurp.storage.ts`, which is already past five thousand
// lines. It composes that storage for accounts, subscriptions, and the wallet instead of
// reimplementing them, so a DM tip and a profile tip move coins through exactly one code path.
import { tolerateMissingTables } from "../../base/host/slp-host-tables.js";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, or } from "../../../db/file-query.js";
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
} from "../../../../../shared/src/slp/slp-fan-types.js";
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
import { countSlurpUnreadThreads } from "../../modules/messages/slp-unread-count.js";

export function createMessagesStorageBase(context: SlurpMessagesContext) {
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
    ...createSlurpReplyMethods(db),
    /** Per-creator messaging settings, falling back to the defaults Settings holds. */
    async getCreatorMessaging(creatorAccountId: string): Promise<SlurpCreatorMessaging> {
      return readSlurpCreatorMessaging((await readMessagingBlob())[creatorAccountId], await messagingDefaults());
    },
    async setCreatorMessaging(
      creatorAccountId: string,
      patch: Partial<SlurpCreatorMessaging>,
    ): Promise<SlurpCreatorMessaging> {
      const blob = await readMessagingBlob();
      const defaults = await messagingDefaults();
      const stored = blob[creatorAccountId] as Record<string, unknown> | undefined;
      // Remember when the player set auto-quote on purpose, so it survives the default changing.
      const autoQuoteChosen = "autoQuote" in patch || stored?.autoQuoteChosen === true;
      const marker = autoQuoteChosen ? { autoQuoteChosen: true } : {};
      const next = readSlurpCreatorMessaging(
        { ...readSlurpCreatorMessaging(stored, defaults), ...patch, ...marker },
        defaults,
      );
      await settingsStore.set(
        SLURP_CREATOR_MESSAGING_KEY,
        JSON.stringify({ ...blob, [creatorAccountId]: { ...next, ...marker } }),
      );
      return next;
    },
    async getThreadById(threadId: string): Promise<SlurpThread | null> {
      const rows = await db.select().from(slurpThreads).where(eq(slurpThreads.id, threadId));
      return rows[0] ? context.storage.withFollowUps(mapThread(rows[0])) : null;
    },
    async withFollowUps(thread: SlurpThread): Promise<SlurpThread> {
      const rows = await db.select().from(slurpFollowUps).where(eq(slurpFollowUps.threadId, thread.id));
      if (rows.length === 0 && thread.scheduledFollowUps.length > 0) {
        await context.storage.addScheduledFollowUps(thread.id, thread.scheduledFollowUps);
        return { ...thread, scheduledFollowUps: thread.scheduledFollowUps };
      }
      return {
        ...thread,
        scheduledFollowUps: rows
          .filter((row) => row.status === "pending")
          .map((row) => ({
            id: row.id,
            scheduledAt: row.scheduledAt,
            type: row.type,
            reason: row.reason,
            context: row.context,
            ...(row.relatedNoteId ? { relatedNoteId: row.relatedNoteId } : {}),
            ...(row.sequenceNumber == null ? {} : { sequenceNumber: Number(row.sequenceNumber) }),
            ...(row.totalInSequence == null ? {} : { totalInSequence: Number(row.totalInSequence) }),
            ...(row.recurringPattern ? { recurringPattern: row.recurringPattern } : {}),
          })),
      };
    },
    /** Retry compensation and cancellation rows that survived a process restart. */
    async recoverPendingPayments(): Promise<void> {
      const rows = await db
        .select()
        .from(slurpPaymentCompensations)
        .where(
          or(
            eq(slurpPaymentCompensations.status, "charging"),
            eq(slurpPaymentCompensations.status, "charged"),
            eq(slurpPaymentCompensations.status, "failed"),
            eq(slurpPaymentCompensations.status, "settled"),
          ),
        );
      for (let row of rows) {
        // A fresh `charged` row is a payment still between debit and its message write. Compensating
        // it refunded the fan while the tip or unlock went on to land anyway.
        if (row.status === "charged" && Date.parse(String(row.updatedAt)) > Date.now() - 5 * 60 * 1000) continue;
        if (row.status === "settled") {
          await applySlurpTipEffects(slurp, String(row.id)).catch((error) =>
            logger.warn(error, "[slurp] Durable tip-effect recovery failed for %s", row.id),
          );
          continue;
        }
        if (row.status === "charging") {
          await recoverChargingSlurpPayment(slurp, row).catch((error) =>
            logger.warn(error, "[slurp] Charging payment recovery failed for %s", row.id),
          );
          const recovered = (
            await db.select().from(slurpPaymentCompensations).where(eq(slurpPaymentCompensations.id, row.id))
          )[0];
          if (!recovered || recovered.status !== "charged") continue;
          row = recovered;
        }
        if (row.status === "charged" && (await hasCompletedSlurpPaymentOperation(db, slurp, row))) {
          await completeSlurpPaymentIntent(slurp, String(row.id));
          await applySlurpTipEffects(slurp, String(row.id));
          continue;
        }
        if (!row.creditOperationId) {
          logger.warn("[slurp] Skipping payment recovery without a credit operation ID for %s", row.id);
          continue;
        }
        await compensateSlurpPayment(
          slurp,
          {
            viewerAccountId: String(row.viewerAccountId),
            creatorAccountId: String(row.creatorAccountId),
            price: int(row.amount as string),
            note: String(row.note ?? "payment compensation"),
            creditOperationId: String(row.creditOperationId),
          },
          new Error("Retrying durable payment compensation"),
          String(row.id),
        ).catch((error) => logger.warn(error, "[slurp] Durable payment recovery failed for %s", row.id));
      }
      const cancellations = await db
        .select()
        .from(slurpCommissions)
        .where(eq(slurpCommissions.state, "cancellation_pending"));
      for (const row of cancellations) {
        const commission = mapCommission(row);
        if (!commission.cancellationId) continue;
        try {
          await compensateSlurpPayment(
            slurp,
            {
              viewerAccountId: commission.viewerAccountId,
              creatorAccountId: commission.creatorAccountId,
              price: commission.price,
              note: "cancelled commission",
              creditOperationId: `commission:${commission.id}:accept:credit`,
            },
            new Error("Retrying pending commission cancellation"),
            commission.cancellationId,
          );
          await context.storage.appendMessage(commission.threadId, {
            id: `commission:${commission.id}:cancellation-message`,
            senderAccountId: commission.viewerAccountId,
            role: "viewer",
            kind: "system",
            // `:accept` marks a payment that failed during accept, not a fan who changed their mind.
            content: commission.cancellationId.endsWith(":accept")
              ? "The payment for this commission failed and was refunded."
              : "The fan cancelled this commission. The payment was refunded.",
            metadata: { commissionId: commission.id },
          });
          await db
            .update(slurpCommissions)
            .set({ state: "declined", updatedAt: now() })
            .where(eq(slurpCommissions.id, commission.id));
        } catch (error) {
          logger.warn(error, "[slurp] Durable cancellation recovery failed for %s", commission.id);
        }
      }
    },
    async getThread(viewerAccountId: string, creatorAccountId: string): Promise<SlurpThread | null> {
      const rows = await db
        .select()
        .from(slurpThreads)
        .where(
          and(eq(slurpThreads.viewerAccountId, viewerAccountId), eq(slurpThreads.creatorAccountId, creatorAccountId)),
        );
      return rows[0] ? context.storage.withFollowUps(mapThread(rows[0])) : null;
    },
    async listMessages(threadId: string, limit = 120): Promise<SlurpMessage[]> {
      const rows = await db
        .select()
        .from(slurpMessages)
        .where(eq(slurpMessages.threadId, threadId))
        .orderBy(desc(slurpMessages.createdAt))
        .limit(limit);
      return rows.map(mapMessage).reverse();
    },
    async listMessagePage(
      threadId: string,
      limit = 120,
      cursor?: { createdAt: string; id: string } | null,
    ): Promise<{ messages: SlurpMessage[]; nextCursor: { createdAt: string; id: string } | null }> {
      const bounded = Math.max(1, Math.min(120, Math.trunc(limit)));
      const rows = await db
        .select()
        .from(slurpMessages)
        .where(
          and(
            eq(slurpMessages.threadId, threadId),
            cursor
              ? or(
                  lt(slurpMessages.createdAt, cursor.createdAt),
                  and(eq(slurpMessages.createdAt, cursor.createdAt), lt(slurpMessages.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(slurpMessages.createdAt), desc(slurpMessages.id))
        .limit(bounded + 1);
      const page = rows.slice(0, bounded);
      const oldest = page[page.length - 1];
      return {
        messages: page.map(mapMessage).reverse(),
        nextCursor:
          rows.length > bounded && oldest ? { createdAt: String(oldest.createdAt), id: String(oldest.id) } : null,
      };
    },
    /**
     * One thread with its creator and the viewer's subscription state joined in.
     *
     * Every route that hands a thread to the client goes through here. The inbox and the open
     * conversation must agree about whether the viewer is subscribed — when only the inbox knew,
     * an open chat told a paying subscriber their message was going to the request tray.
     */
    async viewThread(thread: SlurpThread): Promise<SlurpThreadView | null> {
      const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
      if (!creator) return null;
      const subscriptions = await slurp.listSubscriptionsForViewer(thread.viewerAccountId);
      return {
        ...thread,
        creatorHandle: creator.handle,
        creatorDisplayName: creator.displayName,
        creatorAvatarUrl: creator.avatarUrl ?? null,
        subscribed: subscriptions.some((entry) => entry.creatorAccountId === thread.creatorAccountId),
      };
    },
    /**
     * Every thread addressed **to** one of these Creators, newest first.
     *
     * Without this the inbox only ever showed threads the player opened, so a fan who wrote to
     * your Creator — or a commission the world opened on their behalf — created a thread nobody
     * could ever reach. The obligation layer produced obligations that were invisible.
     */
    async listThreadsForCreators(creatorAccountIds: readonly string[]): Promise<SlurpThreadView[]> {
      if (creatorAccountIds.length === 0) return [];
      const wanted = new Set(creatorAccountIds);
      const rows = await db.select().from(slurpThreads).orderBy(desc(slurpThreads.lastMessageAt));
      const out: SlurpThreadView[] = [];
      for (const row of rows) {
        const thread = await context.storage.withFollowUps(mapThread(row));
        if (!wanted.has(thread.creatorAccountId)) continue;
        // A thread the player opened with their own Creator would otherwise appear on both sides.
        if (wanted.has(thread.viewerAccountId)) continue;
        const view = await context.storage.viewThread(thread);
        if (view) out.push(view);
      }
      return out;
    },
    /**
     * Every thread this viewer has, newest first, with the creator joined in.
     *
     * A thread whose creator is gone is dropped rather than rendered blank: a deleted source
     * already pauses its Slurp profile, and a nameless row in the inbox is only confusing.
     */
    async listThreadsForViewer(viewerAccountId: string): Promise<SlurpThreadView[]> {
      const rows = await db
        .select()
        .from(slurpThreads)
        .where(eq(slurpThreads.viewerAccountId, viewerAccountId))
        .orderBy(desc(slurpThreads.lastMessageAt));
      const subscribed = new Set(
        (await slurp.listSubscriptionsForViewer(viewerAccountId)).map((entry) => entry.creatorAccountId),
      );
      const views: SlurpThreadView[] = [];
      for (const row of rows) {
        const thread = await context.storage.withFollowUps(mapThread(row));
        const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
        if (!creator) continue;
        views.push({
          ...thread,
          creatorHandle: creator.handle,
          creatorDisplayName: creator.displayName,
          creatorAvatarUrl: creator.avatarUrl ?? null,
          subscribed: subscribed.has(thread.creatorAccountId),
        });
      }
      return views;
    },
    /** Badge counts avoid the joins and follow-up hydration the full inbox needs. */
    async countUnread(
      viewerAccountId: string,
      operatedCreatorAccountIds: readonly string[],
      availableCreatorAccountIds: readonly string[],
    ) {
      const creatorScope = operatedCreatorAccountIds.length
        ? or(
            eq(slurpThreads.viewerAccountId, viewerAccountId),
            inArray(slurpThreads.creatorAccountId, [...operatedCreatorAccountIds]),
          )
        : eq(slurpThreads.viewerAccountId, viewerAccountId);
      const rows = await db
        .select({
          viewerAccountId: slurpThreads.viewerAccountId,
          creatorAccountId: slurpThreads.creatorAccountId,
          state: slurpThreads.state,
          viewerUnread: slurpThreads.viewerUnread,
          creatorUnread: slurpThreads.creatorUnread,
        })
        .from(slurpThreads)
        .where(and(creatorScope, ne(slurpThreads.state, "declined")));
      const existingCreatorIds = new Set(availableCreatorAccountIds);
      return countSlurpUnreadThreads(
        rows.map((row) => ({ ...row, creatorExists: existingCreatorIds.has(String(row.creatorAccountId)) })),
        viewerAccountId,
        operatedCreatorAccountIds,
      );
    },
    /**
     * Rebuild the rapport for one pair from the audience tie and the thread itself.
     *
     * Computed rather than incremented: a counter that drifts is a counter nobody can debug, and
     * the inputs are all small reads the send path already pays for.
     */
    async rapportFor(viewerAccountId: string, creatorAccountId: string): Promise<SlurpRapport> {
      const messaging = await context.storage.getCreatorMessaging(creatorAccountId);
      const facts = await context.storage.rapportFactsFor(viewerAccountId, creatorAccountId);
      // Apply subscriber boost: subscribers gain rapport 1.5x faster from conversation and effort
      // Arc stat effects on fan loyalty scale here, the one place rapport is scored.
      const gain = await slurp.arcEffectMultiplier(creatorAccountId, "loyalty");
      return scoreSlurpRapport(facts, messaging.rapportWeights, { subscriberBoost: true, gain });
    },
    /**
     * The facts behind one pair's rapport.
     *
     * Money comes from the audience tie, which is per pair and keeps a lifetime total. It used to
     * come from the wallet ledger, which was wrong three ways at once: the ledger is capped at 60
     * entries across every creator, so a whale's history aged out of their own score; entries were
     * matched by `note.includes(handle)`, so a creator named `mia` collected every tip sent to
     * `miamoon`; and a tip sent inside a thread was counted twice, once from the ledger and once
     * from the message row it also wrote.
     */
    async rapportFactsFor(viewerAccountId: string, creatorAccountId: string): Promise<SlurpRapportFacts> {
      const facts = emptySlurpRapportFacts();
      const wallet = await slurp.getWallet(viewerAccountId);
      const subscription = wallet.subscriptions[creatorAccountId];
      const subscriptions = await slurp.listSubscriptionsForViewer(viewerAccountId);
      const active = subscriptions.find((entry) => entry.creatorAccountId === creatorAccountId);
      facts.subscribed = Boolean(active);
      facts.subscribedDays = active ? Math.max(0, (Date.now() - Date.parse(active.createdAt)) / DAY) : 0;

      const tie = (await createSlurpPopulationStorage(db).listTiesForCreator(creatorAccountId)).find(
        (entry) => entry.memberId === viewerAccountId,
      );
      if (tie) {
        facts.tippedCoins = tie.tipped;
        facts.unlockedCoins = tie.unlocked;
      }

      const thread = await context.storage.getThread(viewerAccountId, creatorAccountId);
      if (thread) {
        const messages = await context.storage.listMessages(thread.id, 500);
        // Payment markers and shared post cards are not things the fan wrote; counting them inflated
        // rapport and double-counted unlocks that are already scored above.
        const fromViewer = messages.filter(
          (message) =>
            message.role === "viewer" &&
            message.kind !== "tip" &&
            message.kind !== "post_preview" &&
            !message.metadata?.paymentReaction,
        );
        facts.viewerMessages = fromViewer.length;
        // A broadcast went to everybody, so counting it here let a mass send buy the reciprocity
        // score, which exists to measure whether this creator answers *you*.
        facts.creatorMessages = messages.filter(
          (message) => message.role === "creator" && message.kind !== "broadcast",
        ).length;
        facts.averageViewerMessageLength =
          fromViewer.length === 0
            ? 0
            : fromViewer.reduce((sum, message) => sum + message.content.length, 0) / fromViewer.length;
        const last = fromViewer[fromViewer.length - 1];
        facts.daysSinceViewerMessage = last ? Math.max(0, (Date.now() - Date.parse(last.createdAt)) / DAY) : null;
        facts.commissionsDelivered = messages.filter((message) => message.kind === "commission_delivery").length;
      }
      // Paid through a period that has ended, with no live subscription row, is a lapse.
      facts.lapsed = !facts.subscribed && subscription !== undefined;
      return facts;
    },
    /**
     * Open a thread if the creator's policy allows it, charging the request fee first.
     *
     * The fee is taken before the row exists so a refused payment leaves no half-open thread.
     */
    async openThread(
      viewerAccountId: string,
      creatorAccountId: string,
      openedBy: "viewer" | "creator" = "viewer",
    ): Promise<
      | { status: "ok"; thread: SlurpThread }
      | { status: "closed" }
      | { status: "insufficient_funds"; required: number }
      | { status: "not_found" }
    > {
      const creator = await slurp.getNoodlerAccountById(creatorAccountId);
      if (!creator) return { status: "not_found" };
      // The viewer id is a persona id, so comparing it with the account id never matched. Checking the
      // account's source persona is what keeps a persona from messaging or tipping its own Creator.
      if (creator.sourceKind === "persona" && creator.sourceEntityId === viewerAccountId)
        return { status: "not_found" };
      const existing = await context.storage.getThread(viewerAccountId, creatorAccountId);
      // A creator writing first always gets through: it is their own inbox, and a welcome message
      // that the creator's own policy blocked would be an absurdity.
      if (existing && (openedBy === "creator" || existing.state !== "request")) {
        if (existing.state === "declined" && openedBy !== "creator") return { status: "closed" };
        return { status: "ok", thread: existing };
      }
      if (existing) return { status: "ok", thread: existing };

      const messaging = await context.storage.getCreatorMessaging(creatorAccountId);
      const subscriptions = await slurp.listSubscriptionsForViewer(viewerAccountId);
      const subscribed = subscriptions.some((entry) => entry.creatorAccountId === creatorAccountId);
      const admission =
        openedBy === "creator"
          ? ({ allowed: true, state: "active", fee: 0 } as const)
          : admitSlurpThread(messaging, { subscribed, existingState: null });
      if (!admission.allowed) return { status: "closed" };

      const settings = await slurp.getSettings();
      let feePaid = 0;
      let chargedByThisCall = false;
      const messageRequestId = `message-request:${viewerAccountId}:${creatorAccountId}`;
      const messageRequestCreditId = `${messageRequestId}:credit`;
      if (settings.walletEnabled && admission.fee > 0) {
        const paymentIntent = await createSlurpPaymentIntent(
          slurp,
          {
            viewerAccountId,
            creatorAccountId,
            price: admission.fee,
            note: "message request",
            creditOperationId: messageRequestCreditId,
          },
          messageRequestId,
        );
        if (paymentIntent === "unpayable") return { status: "insufficient_funds", required: admission.fee };
        const charged =
          paymentIntent === "charged" || paymentIntent === "settled"
            ? true
            : await slurp.spendCoins(
                viewerAccountId,
                "messageRequest",
                admission.fee,
                creator.handle,
                messageRequestId,
              );
        if (!charged) {
          await resetSlurpPaymentIntentAfterInsufficientFunds(slurp, messageRequestId);
          return { status: "insufficient_funds", required: admission.fee };
        }
        feePaid = admission.fee;
        chargedByThisCall = paymentIntent === "claimed";
        await markSlurpPaymentIntentCharged(slurp, messageRequestId);
        try {
          await slurp.creditCreatorIncome(creatorAccountId, feePaid, "messageRequest", messageRequestCreditId);
          await persistSlurpPaymentCreditedAmount(slurp, messageRequestId, creatorAccountId, messageRequestCreditId);
          await slurp.notifyCreatorIncome(creatorAccountId, "messageRequest", feePaid, viewerAccountId);
        } catch (error) {
          await compensateSlurpPayment(
            slurp,
            {
              viewerAccountId,
              creatorAccountId,
              price: feePaid,
              note: "failed message request",
              creditOperationId: messageRequestCreditId,
            },
            error,
            messageRequestId,
          );
          throw error;
        }
      }

      const timestamp = now();
      const row = {
        id: newId(),
        viewerAccountId,
        creatorAccountId,
        state: admission.state,
        openedBy,
        requestFeePaid: String(feePaid),
        lastMessageAt: timestamp,
        lastMessagePreview: "",
        viewerUnread: "0",
        creatorUnread: "0",
        needsReply: "false",
        generationEpoch: "0",
        replyNotBeforeAt: null,
        rapport: "{}",
        threadState: "{}",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      try {
        await db.insert(slurpThreads).values(row);
      } catch (error) {
        if (!isSlurpFileUniqueConstraintError(error, "slurp2_threads", ["viewerAccountId", "creatorAccountId"])) {
          if (feePaid > 0) {
            await compensateSlurpPayment(
              slurp,
              {
                viewerAccountId,
                creatorAccountId,
                price: feePaid,
                note: "failed message request",
                creditOperationId: messageRequestCreditId,
              },
              error,
              `message-request:${viewerAccountId}:${creatorAccountId}`,
            );
          }
          throw error;
        }
        const raced = await context.storage.getThread(viewerAccountId, creatorAccountId);
        const paymentIntent =
          feePaid > 0
            ? (
                await db
                  .select()
                  .from(slurpPaymentCompensations)
                  .where(eq(slurpPaymentCompensations.id, messageRequestId))
              )[0]
            : undefined;
        if (raced && (paymentIntent?.status === "charged" || paymentIntent?.status === "settled")) {
          return { status: "ok", thread: raced };
        }
        if (feePaid > 0 && chargedByThisCall && !raced) {
          await compensateSlurpPayment(
            slurp,
            {
              viewerAccountId,
              creatorAccountId,
              price: feePaid,
              note: "duplicate message request",
              creditOperationId: messageRequestCreditId,
            },
            error,
            messageRequestId,
          );
        }
        return raced ? { status: "ok", thread: raced } : { status: "not_found" };
      }
      const thread = await context.storage.getThread(viewerAccountId, creatorAccountId);
      if (feePaid > 0) await completeSlurpPaymentIntent(slurp, messageRequestId);
      return thread ? { status: "ok", thread } : { status: "not_found" };
    },
  };
}
