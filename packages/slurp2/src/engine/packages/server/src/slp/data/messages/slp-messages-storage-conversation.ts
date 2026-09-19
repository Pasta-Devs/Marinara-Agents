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

export function createMessagesStorageConversation(context: SlurpMessagesContext) {
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
    /** Append one message and roll the thread's preview, unread counts, and cached rapport. */
    async appendMessage(
      threadId: string,
      input: {
        id?: string;
        senderAccountId: string;
        role: "viewer" | "creator";
        kind?: SlurpMessageKind;
        content?: string;
        imageUrl?: string | null;
        price?: number;
        unlockedAt?: string | null;
        metadata?: Record<string, unknown>;
        createdAt?: string;
        replyObligationCreatedAt?: string;
        preserveReplyObligation?: boolean;
        scheduledFollowUpId?: string;
      },
    ): Promise<SlurpMessage | null> {
      const thread = await context.storage.getThreadById(threadId);
      if (!thread) return null;
      const kind = input.kind ?? "text";
      const content = input.content ?? "";
      const price = Math.max(0, Math.trunc(input.price ?? 0));
      const timestamp = now();
      if (input.role === "creator" && thread.state === "declined") return null;
      const sender =
        input.role === "creator"
          ? await slurp.getNoodlerAccountById(input.senderAccountId)
          : ((await slurp.getViewer(input.senderAccountId).catch(() => null)) ??
            (await slurp.getNoodlerAccountById(input.senderAccountId)));
      const message = {
        id: input.id ?? newId(),
        threadId,
        senderAccountId: input.senderAccountId,
        role: input.role,
        kind,
        content,
        imageUrl: input.imageUrl ?? null,
        imagePrompt: null,
        imageClaimToken: null,
        imageClaimLeaseUntil: null,
        price: String(price),
        unlockedAt: input.unlockedAt ?? null,
        readAt: null,
        metadata: JSON.stringify(input.metadata ?? {}),
        senderSnapshot: JSON.stringify(
          sender ? { displayName: sender.displayName, handle: sender.handle, avatarUrl: sender.avatarUrl ?? null } : {},
        ),
        createdAt: input.createdAt ?? timestamp,
      };
      const rapport = await context.storage.rapportFor(thread.viewerAccountId, thread.creatorAccountId);
      let stored = false;
      try {
        await db.transaction(async (tx) => {
          const currentRows = await tx.select().from(slurpThreads).where(eq(slurpThreads.id, threadId));
          const current = currentRows[0];
          if (!current) return;
          if (input.role === "creator" && current.state === "declined") return;
          if (input.scheduledFollowUpId) {
            const followUp = await tx
              .select({ status: slurpFollowUps.status })
              .from(slurpFollowUps)
              .where(and(eq(slurpFollowUps.id, input.scheduledFollowUpId), eq(slurpFollowUps.threadId, threadId)))
              .get();
            if (followUp?.status !== "claimed") return;
          }
          await tx.insert(slurpMessages).values(message);
          const newerViewer =
            input.role === "creator" && input.preserveReplyObligation
              ? current.needsReply === "true"
              : input.role === "creator" && input.replyObligationCreatedAt
                ? (
                    await tx
                      .select()
                      .from(slurpMessages)
                      .where(
                        and(
                          eq(slurpMessages.threadId, threadId),
                          eq(slurpMessages.role, "viewer"),
                          gt(slurpMessages.createdAt, input.replyObligationCreatedAt),
                        ),
                      )
                      .limit(1)
                  ).length > 0
                : false;
          await tx
            .update(slurpThreads)
            .set({
              state: input.role === "creator" && current.state === "request" ? "active" : current.state,
              lastMessageAt: message.createdAt > current.lastMessageAt ? message.createdAt : current.lastMessageAt,
              lastMessagePreview:
                message.createdAt >= current.lastMessageAt
                  ? slurpMessagePreview(kind, content, price)
                  : current.lastMessagePreview,
              viewerUnread: input.role === "creator" ? String(Number(current.viewerUnread) + 1) : current.viewerUnread,
              creatorUnread:
                input.role === "viewer"
                  ? String(Number(current.creatorUnread) + 1)
                  : newerViewer
                    ? current.creatorUnread
                    : "0",
              needsReply: input.role === "viewer" || newerViewer ? "true" : "false",
              replyNotBeforeAt: input.role === "creator" && !newerViewer ? null : current.replyNotBeforeAt,
              rapport: JSON.stringify(rapport),
              updatedAt: timestamp,
            })
            .where(eq(slurpThreads.id, threadId));
          if (input.scheduledFollowUpId) {
            await tx
              .update(slurpFollowUps)
              .set({ status: "sent", sentAt: timestamp, updatedAt: timestamp })
              .where(eq(slurpFollowUps.id, input.scheduledFollowUpId));
          }
          stored = true;
        });
      } catch (error) {
        if (input.id && isSlurpFileUniqueConstraintError(error, "slurp2_messages", ["id"]))
          return context.storage.getMessageById(input.id);
        throw error;
      }
      return stored ? mapMessage(message) : null;
    },
    /** Persist the visible bubble and its delayed siblings as one recoverable unit. */
    async appendReplyBatch(
      threadId: string,
      input: {
        first: { id?: string; senderAccountId: string; content: string };
        delayed: Array<{
          id: string;
          batchId: string;
          sequence: number;
          senderAccountId: string;
          content: string;
          deliverAt: string;
          generationEpoch: number;
          createdAt: string;
        }>;
      },
    ): Promise<SlurpMessage | null> {
      const thread = await context.storage.getThreadById(threadId);
      if (!thread) return null;
      const rapport = await context.storage.rapportFor(thread.viewerAccountId, thread.creatorAccountId);
      const timestamp = now();
      const creator = await slurp.getNoodlerAccountById(input.first.senderAccountId);
      const first = {
        id: input.first.id ?? newId(),
        threadId,
        senderAccountId: input.first.senderAccountId,
        role: "creator" as const,
        kind: "text" as const,
        content: input.first.content,
        imageUrl: null,
        imagePrompt: null,
        imageClaimToken: null,
        imageClaimLeaseUntil: null,
        price: "0",
        unlockedAt: null,
        readAt: null,
        metadata: "{}",
        senderSnapshot: JSON.stringify(
          creator
            ? { displayName: creator.displayName, handle: creator.handle, avatarUrl: creator.avatarUrl ?? null }
            : {},
        ),
        createdAt: timestamp,
      };
      const rows = input.delayed.map((bubble) => ({
        id: bubble.id,
        batchId: bubble.batchId,
        sequence: String(bubble.sequence),
        threadId,
        senderAccountId: bubble.senderAccountId,
        messageId: bubble.id,
        content: bubble.content,
        deliverAt: bubble.deliverAt,
        generationEpoch: String(bubble.generationEpoch),
        createdAt: bubble.createdAt,
      }));
      let stored = false;
      await db.transaction(async (tx) => {
        const currentRows = await tx.select().from(slurpThreads).where(eq(slurpThreads.id, threadId));
        const current = currentRows[0];
        if (!current) return;
        const claimRows = await tx
          .select()
          .from(slurpMessageClaims)
          .where(eq(slurpMessageClaims.id, input.first.id ?? "__missing_claim__"));
        const claim = claimRows[0];
        if (
          !claim ||
          String(claim.threadId) !== threadId ||
          String(claim.generationEpoch ?? "0") !== String(current.generationEpoch ?? "0") ||
          (current.state !== "active" && current.state !== "request")
        )
          return;
        // The fan's newest message, not the thread's: a delayed bubble stored after the fan spoke
        // must not void the answer that fan is still owed.
        const latestRows = await tx
          .select()
          .from(slurpMessages)
          .where(and(eq(slurpMessages.threadId, threadId), eq(slurpMessages.role, "viewer")))
          .orderBy(desc(slurpMessages.createdAt), desc(slurpMessages.id))
          .limit(1);
        if (latestRows[0]?.id !== claim.triggerMessageId) return;
        const newerViewerMessage = false;
        await tx.insert(slurpMessages).values(first);
        if (rows.length > 0) await tx.insert(slurpReplyBubbles).values(rows);
        // Answering is reading. Nothing cleared this before, so `listThreadsAwaitingReply` kept
        // handing the same answered message back to the queued-reply scheduler and the creator
        // re-answered it once a minute, forever, until the fan spoke again. A message that landed
        // while this reply was being written is a fresh obligation and stays unread.
        if (!newerViewerMessage) {
          for (const row of await tx
            .select()
            .from(slurpMessages)
            .where(and(eq(slurpMessages.threadId, threadId), eq(slurpMessages.role, "viewer")))) {
            if (row.readAt) continue;
            await tx.update(slurpMessages).set({ readAt: timestamp }).where(eq(slurpMessages.id, row.id));
          }
        }
        await tx
          .update(slurpMessageClaims)
          .set({ replyMessageId: first.id })
          .where(eq(slurpMessageClaims.id, input.first.id ?? "__missing_claim__"));
        await tx
          .update(slurpThreads)
          .set({
            state: current.state === "request" ? "active" : current.state,
            lastMessageAt: timestamp,
            lastMessagePreview: slurpMessagePreview("text", first.content, 0),
            viewerUnread: String(Number(current.viewerUnread) + 1),
            creatorUnread: newerViewerMessage ? current.creatorUnread : "0",
            needsReply: newerViewerMessage ? "true" : "false",
            replyNotBeforeAt: newerViewerMessage ? current.replyNotBeforeAt : null,
            rapport: JSON.stringify(rapport),
            updatedAt: timestamp,
          })
          .where(eq(slurpThreads.id, threadId));
        stored = true;
      });
      return stored ? mapMessage(first) : null;
    },
    async unlockMessage(viewerAccountId: string, messageId: string): Promise<SlurpMessage | null> {
      const previous = messageUnlocks.get(messageId) ?? Promise.resolve(null);
      const current = previous
        .catch(() => null)
        .then(() => context.storage.unlockMessageUnlocked(viewerAccountId, messageId));
      messageUnlocks.set(messageId, current);
      try {
        return await current;
      } finally {
        if (messageUnlocks.get(messageId) === current) messageUnlocks.delete(messageId);
      }
    },
    async unlockMessageUnlocked(viewerAccountId: string, messageId: string): Promise<SlurpMessage | null> {
      const rows = await db.select().from(slurpMessages).where(eq(slurpMessages.id, messageId));
      const row = rows[0];
      if (!row) return null;
      const thread = await context.storage.getThreadById(String(row.threadId));
      // Only a PPV message is content-locked. Without the kind check a tip or a commission quote —
      // both stored with a price and no `unlockedAt` — could be "unlocked" and charged a second time.
      if (String(row.kind) !== "ppv") return null;
      if (!thread || thread.viewerAccountId !== viewerAccountId || Number(row.price ?? 0) <= 0) return null;
      if (row.unlockedAt) return mapMessage(row);
      const price = int(row.price as string);
      const settings = await slurp.getSettings();
      if (settings.walletEnabled) {
        const paymentId = `ppv:${messageId}`;
        const creditOperationId = `message:${messageId}:ppv`;
        const paymentIntent = await createSlurpPaymentIntent(
          slurp,
          { viewerAccountId, creatorAccountId: thread.creatorAccountId, price, note: "PPV unlock", creditOperationId },
          paymentId,
        );
        if (paymentIntent === "unpayable") return null;
        const charged =
          paymentIntent === "charged" || paymentIntent === "settled"
            ? true
            : await slurp.spendCoins(viewerAccountId, "ppv", price, thread.creatorAccountId, paymentId);
        if (!charged) {
          await resetSlurpPaymentIntentAfterInsufficientFunds(slurp, paymentId);
          return null;
        }
        await markSlurpPaymentIntentCharged(slurp, paymentId);
        try {
          await slurp.creditCreatorIncome(thread.creatorAccountId, price, "ppv", `message:${messageId}:ppv`);
          await persistSlurpPaymentCreditedAmount(slurp, paymentId, thread.creatorAccountId, creditOperationId);
          await slurp.notifyCreatorIncome(thread.creatorAccountId, "ppv", price, viewerAccountId, messageId);
          // Paying to see something is the strongest signal in a thread, and it reached the funnel
          // nowhere: only profile unlocks did, so the same coins counted or not by where they were spent.
          await slurp.advanceAudienceTie(viewerAccountId, thread.creatorAccountId, {
            stage: "regular",
            spent: price,
            unlocked: price,
          });
          const unlockedAt = now();
          await db.update(slurpMessages).set({ unlockedAt }).where(eq(slurpMessages.id, messageId));
          return mapMessage({ ...row, unlockedAt });
        } catch (error) {
          await compensateSlurpPayment(
            slurp,
            {
              viewerAccountId,
              creatorAccountId: thread.creatorAccountId,
              price,
              note: "failed PPV unlock",
              creditOperationId,
            },
            error,
            paymentId,
          );
          throw error;
        }
      }
      const unlockedAt = now();
      await db.update(slurpMessages).set({ unlockedAt }).where(eq(slurpMessages.id, messageId));
      return mapMessage({ ...row, unlockedAt });
    },
    async sendCreatorMessage(
      creatorAccountId: string,
      viewerAccountId: string,
      input: {
        id?: string;
        content: string;
        kind?: SlurpMessageKind;
        price?: number;
        unlockedAt?: string | null;
        imageUrl?: string | null;
        metadata?: Record<string, unknown>;
      },
    ): Promise<SlurpMessage | null> {
      // A counterpart is a persona, an ambient Slurp account, or a generated population member.
      // Gating on personas alone meant a fan the world sent could write to a Creator and never be
      // answered — an obligation with no way to discharge it.
      const counterpartExists =
        Boolean(await slurp.getViewer(viewerAccountId).catch(() => null)) ||
        Boolean(await slurp.getNoodlerAccountById(viewerAccountId)) ||
        Boolean(await createSlurpPopulationStorage(db).get(viewerAccountId));
      if (!counterpartExists) return null;
      const opened = await context.storage.openThread(viewerAccountId, creatorAccountId, "creator");
      if (opened.status !== "ok") return null;
      return context.storage.appendMessage(opened.thread.id, {
        id: input.id,
        senderAccountId: creatorAccountId,
        role: "creator",
        content: input.content,
        kind: input.kind,
        price: input.price,
        unlockedAt: input.unlockedAt,
        imageUrl: input.imageUrl ?? null,
        metadata: input.metadata,
      });
    },
  };
}
