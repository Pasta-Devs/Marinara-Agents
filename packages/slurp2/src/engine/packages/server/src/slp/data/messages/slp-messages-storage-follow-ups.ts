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

export function createMessagesStorageFollowUps(context: SlurpMessagesContext) {
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
     * Add scheduled follow-ups to a thread.
     */
    async addScheduledFollowUps(
      threadId: string,
      followUps: Array<{
        id: string;
        scheduledAt: string;
        type: string;
        reason: string;
        context: string;
        relatedNoteId?: string;
        sequenceNumber?: number;
        totalInSequence?: number;
        recurringPattern?: string;
      }>,
    ): Promise<void> {
      const thread = await db.select().from(slurpThreads).where(eq(slurpThreads.id, threadId)).get();
      if (!thread) return;
      const timestamp = now();
      for (const followUp of followUps) {
        await db.insert(slurpFollowUps).values({
          ...followUp,
          threadId,
          viewerAccountId: String(thread.viewerAccountId),
          creatorAccountId: String(thread.creatorAccountId),
          sequenceNumber: followUp.sequenceNumber == null ? null : String(followUp.sequenceNumber),
          totalInSequence: followUp.totalInSequence == null ? null : String(followUp.totalInSequence),
          status: "pending",
          claimedAt: null,
          sentAt: null,
          cancelledAt: null,
          failedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    },
    /**
     * Remove a specific follow-up by ID.
     */
    async removeScheduledFollowUp(threadId: string, followUpId: string): Promise<void> {
      await context.storage.cancelScheduledFollowUp(threadId, followUpId);
    },
    async claimScheduledFollowUp(followUpId: string): Promise<boolean> {
      const timestamp = now();
      const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
      return db.transaction(async (tx) => {
        const current = (
          await tx
            .select({ status: slurpFollowUps.status, claimedAt: slurpFollowUps.claimedAt })
            .from(slurpFollowUps)
            .where(eq(slurpFollowUps.id, followUpId))
        )[0];
        if (
          !current ||
          (current.status !== "pending" &&
            !(current.status === "claimed" && current.claimedAt && current.claimedAt <= staleBefore))
        )
          return false;
        await tx
          .update(slurpFollowUps)
          .set({ status: "claimed", claimedAt: timestamp, updatedAt: timestamp })
          .where(
            and(
              eq(slurpFollowUps.id, followUpId),
              or(
                eq(slurpFollowUps.status, "pending"),
                and(eq(slurpFollowUps.status, "claimed"), lte(slurpFollowUps.claimedAt, staleBefore)),
              ),
            ),
          );
        const after = (
          await tx
            .select({ status: slurpFollowUps.status, claimedAt: slurpFollowUps.claimedAt })
            .from(slurpFollowUps)
            .where(eq(slurpFollowUps.id, followUpId))
        )[0];
        return after?.status === "claimed" && after.claimedAt === timestamp;
      });
    },
    async isScheduledFollowUpClaimed(followUpId: string): Promise<boolean> {
      const rows = await db
        .select({ status: slurpFollowUps.status })
        .from(slurpFollowUps)
        .where(eq(slurpFollowUps.id, followUpId));
      return rows[0]?.status === "claimed";
    },
    async completeScheduledFollowUp(threadId: string, followUpId: string): Promise<void> {
      const timestamp = now();
      await db
        .update(slurpFollowUps)
        .set({ status: "sent", sentAt: timestamp, updatedAt: timestamp })
        .where(
          and(
            eq(slurpFollowUps.id, followUpId),
            eq(slurpFollowUps.threadId, threadId),
            eq(slurpFollowUps.status, "claimed"),
          ),
        );
    },
    async cancelScheduledFollowUp(threadId: string, followUpId: string): Promise<void> {
      const timestamp = now();
      await db
        .update(slurpFollowUps)
        .set({ status: "cancelled", cancelledAt: timestamp, updatedAt: timestamp })
        .where(
          and(
            eq(slurpFollowUps.id, followUpId),
            eq(slurpFollowUps.threadId, threadId),
            inArray(slurpFollowUps.status, ["pending", "claimed"]),
          ),
        );
    },
    /** Put a claimed follow-up back in the queue at a later time: cool-off, night quiet, offline. */
    async postponeScheduledFollowUp(threadId: string, followUpId: string, scheduledAt: string): Promise<void> {
      const timestamp = now();
      await db
        .update(slurpFollowUps)
        .set({ status: "pending", claimedAt: null, scheduledAt, updatedAt: timestamp })
        .where(
          and(
            eq(slurpFollowUps.id, followUpId),
            eq(slurpFollowUps.threadId, threadId),
            eq(slurpFollowUps.status, "claimed"),
          ),
        );
    },
    async failScheduledFollowUp(threadId: string, followUpId: string): Promise<void> {
      const timestamp = now();
      await db
        .update(slurpFollowUps)
        .set({ status: "pending", claimedAt: null, failedAt: timestamp, updatedAt: timestamp })
        .where(
          and(
            eq(slurpFollowUps.id, followUpId),
            eq(slurpFollowUps.threadId, threadId),
            eq(slurpFollowUps.status, "claimed"),
          ),
        );
    },
    /**
     * Get all threads with pending follow-ups that are due.
     */
    async getThreadsWithDueFollowUps(now: string = new Date().toISOString()): Promise<
      Array<{
        id: string;
        viewerAccountId: string;
        creatorAccountId: string;
        dueFollowUp: {
          id: string;
          scheduledAt: string;
          type: string;
          reason: string;
          context: string;
          relatedNoteId?: string;
          sequenceNumber?: number;
          totalInSequence?: number;
          recurringPattern?: string;
        };
      }>
    > {
      const rows = await db
        .select({
          id: slurpFollowUps.id,
          threadId: slurpFollowUps.threadId,
          viewerAccountId: slurpFollowUps.viewerAccountId,
          creatorAccountId: slurpFollowUps.creatorAccountId,
          scheduledAt: slurpFollowUps.scheduledAt,
          type: slurpFollowUps.type,
          reason: slurpFollowUps.reason,
          context: slurpFollowUps.context,
          relatedNoteId: slurpFollowUps.relatedNoteId,
          sequenceNumber: slurpFollowUps.sequenceNumber,
          totalInSequence: slurpFollowUps.totalInSequence,
          recurringPattern: slurpFollowUps.recurringPattern,
        })
        .from(slurpFollowUps)
        .where(
          and(
            lte(slurpFollowUps.scheduledAt, now),
            or(
              eq(slurpFollowUps.status, "pending"),
              and(
                eq(slurpFollowUps.status, "claimed"),
                lte(slurpFollowUps.claimedAt, new Date(Date.now() - 10 * 60_000).toISOString()),
              ),
            ),
          ),
        );
      return rows.map((row) => ({
        id: row.threadId,
        viewerAccountId: row.viewerAccountId,
        creatorAccountId: row.creatorAccountId,
        dueFollowUp: {
          id: row.id,
          scheduledAt: row.scheduledAt,
          type: row.type,
          reason: row.reason,
          context: row.context,
          relatedNoteId: row.relatedNoteId ?? undefined,
          sequenceNumber: row.sequenceNumber == null ? undefined : Number(row.sequenceNumber),
          totalInSequence: row.totalInSequence == null ? undefined : Number(row.totalInSequence),
          recurringPattern: row.recurringPattern ?? undefined,
        },
      }));
    },
    /**
     * Get follow-up analytics for a creator.
     */
    async getFollowUpAnalytics(creatorAccountId: string): Promise<{
      totalScheduled: number;
      totalSent: number;
      totalCancelled: number;
      byType: Record<string, { scheduled: number; sent: number }>;
      avgResponseRate: number;
    }> {
      const followUps = await db
        .select()
        .from(slurpFollowUps)
        .where(eq(slurpFollowUps.creatorAccountId, creatorAccountId));

      const totalScheduled = followUps.filter(
        (followUp) => followUp.status === "pending" || followUp.status === "claimed",
      ).length;
      const totalCancelled = followUps.filter((followUp) => followUp.status === "cancelled").length;
      const byType: Record<string, { scheduled: number; sent: number }> = {};
      for (const followUp of followUps) {
        if (!byType[followUp.type]) byType[followUp.type] = { scheduled: 0, sent: 0 };
        if (followUp.status === "pending" || followUp.status === "claimed") byType[followUp.type].scheduled += 1;
      }

      // Count sent follow-ups from message metadata
      const messages = await db
        .select({
          metadata: slurpMessages.metadata,
          threadId: slurpMessages.threadId,
          createdAt: slurpMessages.createdAt,
        })
        .from(slurpMessages)
        .where(
          and(
            eq(slurpMessages.role, "creator"),
            eq(slurpMessages.senderAccountId, creatorAccountId),
            isNotNull(slurpMessages.metadata),
          ),
        );

      let totalSent = 0;
      let responsesReceived = 0;

      for (const msg of messages) {
        try {
          const metadata = JSON.parse(msg.metadata ?? "{}");
          if (metadata.followUp === true) {
            totalSent += 1;
            const type = metadata.followUpType ?? "unknown";
            if (!byType[type]) {
              byType[type] = { scheduled: 0, sent: 0 };
            }
            byType[type].sent += 1;

            // Check if viewer responded after this follow-up
            const nextMessages = await db
              .select({ role: slurpMessages.role })
              .from(slurpMessages)
              .where(
                and(
                  eq(slurpMessages.threadId, msg.threadId),
                  eq(slurpMessages.role, "viewer"),
                  gt(slurpMessages.createdAt, msg.createdAt),
                ),
              )
              .limit(1);

            if (nextMessages.length > 0) {
              responsesReceived += 1;
            }
          }
        } catch {
          // Invalid JSON, skip
        }
      }

      const avgResponseRate = totalSent > 0 ? responsesReceived / totalSent : 0;

      return {
        totalScheduled,
        totalSent,
        totalCancelled,
        byType,
        avgResponseRate,
      };
    },
    /**
     * Wipe the conversation and leave the pair where they started.
     *
     * Everything derived from the messages goes with them: the queued bubbles, the reply claim,
     * the unread counts, the mood and the per-fan state.
     *
     * Memory stays. A clear is the player tidying a chat window, not the creator being made to
     * forget a person they know, and wiping the notes made every clear cost the relationship its
     * whole history. What money bought stays too: spend, unlocks and commissions are ledgered
     * outside this thread and rapport is computed from them.
     *
     * An unfinished commission is closed instead, because nobody is left to deliver against a
     * brief whose conversation is gone, and `clearedAt` hides every commission the chat already
     * showed. The rows remain readable from the commissions panel.
     */
    async resetThread(threadId: string): Promise<void> {
      const timestamp = now();
      await db.transaction(async (tx) => {
        const [thread] = await tx.select().from(slurpThreads).where(eq(slurpThreads.id, threadId)).limit(1);
        if (!thread) return;
        await tx.delete(slurpReplyBubbles).where(eq(slurpReplyBubbles.threadId, threadId));
        await tx.delete(slurpMessageClaims).where(eq(slurpMessageClaims.threadId, threadId));
        await tx.delete(slurpMessages).where(eq(slurpMessages.threadId, threadId));
        await tx.delete(slurpFollowUps).where(eq(slurpFollowUps.threadId, threadId));
        for (const row of await tx.select().from(slurpCommissions).where(eq(slurpCommissions.threadId, threadId))) {
          if (row.state !== "brief" && row.state !== "quoted") continue;
          await tx
            .update(slurpCommissions)
            .set({ state: "declined", updatedAt: timestamp })
            .where(eq(slurpCommissions.id, String(row.id)));
        }
        await tx
          .update(slurpThreads)
          .set({
            lastMessageAt: timestamp,
            lastMessagePreview: "",
            viewerUnread: "0",
            creatorUnread: "0",
            needsReply: "false",
            generationEpoch: String(Number(thread.generationEpoch ?? 0) + 1),
            replyNotBeforeAt: null,
            mood: "0",
            moodUpdatedAt: null,
            coolUntil: null,
            clearedAt: timestamp,
            threadState: "{}",
            strikes: "0",
            lastStrikeAt: null,
            updatedAt: timestamp,
          })
          .where(eq(slurpThreads.id, threadId));
      });
    },
    /**
     * Replace what the creator remembers about this fan.
     *
     * The list is normalized and capped by `readStoredNotes`, the same door the model's own
     * memory writes go through, so a hand-edited memory cannot be longer, more numerous or
     * shaped differently than one the creator wrote herself.
     */
    async setThreadNotes(threadId: string, notes: unknown): Promise<SlurpThreadNote[]> {
      const next = readStoredNotes(notes);
      await db
        .update(slurpThreads)
        .set({ notes: JSON.stringify(next), updatedAt: now() })
        .where(eq(slurpThreads.id, threadId));
      return next;
    },
    /** Clear one side's unread count and stamp the messages the other side sent. */
    async markRead(threadId: string, side: "viewer" | "creator"): Promise<void> {
      const timestamp = now();
      await db
        .update(slurpThreads)
        .set(
          side === "viewer"
            ? { viewerUnread: "0", updatedAt: timestamp }
            : { creatorUnread: "0", updatedAt: timestamp },
        )
        .where(eq(slurpThreads.id, threadId));
      const unread = await db
        .select()
        .from(slurpMessages)
        .where(
          and(eq(slurpMessages.threadId, threadId), eq(slurpMessages.role, side === "viewer" ? "creator" : "viewer")),
        )
        .orderBy(asc(slurpMessages.createdAt));
      for (const row of unread) {
        if (row.readAt) continue;
        await db.update(slurpMessages).set({ readAt: timestamp }).where(eq(slurpMessages.id, row.id));
      }
    },
  };
}
