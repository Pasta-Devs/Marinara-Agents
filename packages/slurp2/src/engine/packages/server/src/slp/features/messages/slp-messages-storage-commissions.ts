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
import { applySlurpMood, type SlurpMoodShift } from "../../../services/slurp/slurp-mood.js";
import {
  applySlurpThreadNotes,
  readStoredNotes,
  type SlurpNoteOperation,
  type SlurpThreadNote,
} from "../../../services/slurp/slurp-thread-notes.js";
import {
  SLURP_THREAD_STATE_DEFAULT,
  applySlurpThreadStateSignals,
  type SlurpCreatorStateSignal,
} from "../../../services/slurp/slurp-creator-state.js";
import { activeSlurpStrikes } from "../../../services/slurp/slurp-stance.js";
import { SLURP_ONLINE_AFTER_DELIVERY_MINUTES } from "../../../services/slurp/slurp-conversation-momentum.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { createSlurpEventsStorage } from "../notifications/slp-notifications-contract.js";
import { createSlurpPopulationStorage } from "../audience/slp-audience-contract.js";
import {
  slurpFanTypeCommissionBudget,
  slurpFanTypeWeeklyBudget,
  slurpResolveFanType,
} from "../../../services/slurp/slurp-fan-types.js";
import {
  admitSlurpThread,
  readSlurpCreatorMessaging,
  slurpMessagePreview,
  SLURP_CREATOR_MESSAGING_KEY,
  SLURP_DEFAULT_CREATOR_MESSAGING,
  type SlurpCreatorMessaging,
  type SlurpMessageKind,
} from "../../../services/slurp/slurp-messaging.js";
import {
  emptySlurpRapportFacts,
  scoreSlurpRapport,
  type SlurpRapport,
  type SlurpRapportFacts,
} from "../../../services/slurp/slurp-rapport.js";
import { createSlurpReplyQueueStorage } from "./slp-reply-queue-storage.js";
import {
  SLURP_COMMISSION_MAX_HAGGLE_ROUNDS,
  slurpCreatorHaggle,
} from "../../../services/slurp/slurp-creator-pricing.js";
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

export function createMessagesStorageCommissions(context: SlurpMessagesContext) {
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
    async createCommission(
      viewerAccountId: string,
      creatorAccountId: string,
      brief: string,
    ): Promise<SlurpCommission | "open_request" | null> {
      const opened = await context.storage.openThread(viewerAccountId, creatorAccountId, "viewer");
      if (opened.status !== "ok") return null;
      const open = await context.storage.listCommissionsForThread(opened.thread.id);
      if (open.some((row) => row.state === "brief" || row.state === "quoted")) return "open_request";
      const timestamp = now();
      const row = {
        id: newId(),
        threadId: opened.thread.id,
        viewerAccountId,
        creatorAccountId,
        state: "brief",
        brief,
        price: "0",
        deliveryMessageId: null,
        counterPrice: null,
        haggleRounds: "0",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.insert(slurpCommissions).values(row);
      await context.storage.appendMessage(opened.thread.id, {
        senderAccountId: viewerAccountId,
        role: "viewer",
        kind: "commission_brief",
        content: brief,
        metadata: { commissionId: row.id },
      });
      // Somebody asking you to make something is the strongest thing the world can do, so it
      // outranks every other event kind.
      await slurp.recordCreatorEvent(creatorAccountId, "commission_requested", {
        subjectId: opened.thread.id,
        actorLabel: viewerAccountId,
      });
      return mapCommission(row);
    },
    async listCommissionsForThread(threadId: string, since?: string, limit?: number): Promise<SlurpCommission[]> {
      const where = since
        ? and(eq(slurpCommissions.threadId, threadId), gt(slurpCommissions.updatedAt, since))
        : eq(slurpCommissions.threadId, threadId);
      if (limit) {
        const newest = await db
          .select()
          .from(slurpCommissions)
          .where(where)
          .orderBy(desc(slurpCommissions.updatedAt))
          .limit(limit);
        return newest.reverse().map(mapCommission);
      }
      const rows = await db.select().from(slurpCommissions).where(where).orderBy(asc(slurpCommissions.createdAt));
      return rows.map(mapCommission);
    },
    /**
     * Commissions still waiting on the Creator: a brief with no quote, or a quote not yet
     * delivered. The world reads this to avoid piling requests onto a queue nobody answered.
     */
    async listOpenCommissionsForCreator(creatorAccountId: string): Promise<SlurpCommission[]> {
      const rows = await db
        .select()
        .from(slurpCommissions)
        .where(eq(slurpCommissions.creatorAccountId, creatorAccountId));
      return rows.map(mapCommission).filter((row) => row.state === "brief" || row.state === "accepted");
    },
    async getMessageById(id: string): Promise<SlurpMessage | null> {
      const rows = await db.select().from(slurpMessages).where(eq(slurpMessages.id, id));
      return rows[0] ? mapMessage(rows[0]) : null;
    },
    /** Replace a placeholder brief with the model's rewrite. Text only; nothing else moves. */
    async rewriteCommissionBrief(id: string, brief: string): Promise<void> {
      await db.update(slurpCommissions).set({ brief, updatedAt: now() }).where(eq(slurpCommissions.id, id));
      const rows = await db.select().from(slurpCommissions).where(eq(slurpCommissions.id, id));
      const commission = rows[0];
      if (!commission) return;
      const messages = await db.select().from(slurpMessages).where(eq(slurpMessages.threadId, commission.threadId));
      const linked = messages.find((message) => {
        try {
          return JSON.parse(String(message.metadata ?? "{}"))?.commissionId === id;
        } catch {
          return false;
        }
      });
      if (!linked) return;
      await db.update(slurpMessages).set({ content: brief }).where(eq(slurpMessages.id, linked.id));
      const latest = messages.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
      if (latest?.id === linked.id) {
        await db
          .update(slurpThreads)
          .set({ lastMessagePreview: brief.slice(0, 160), updatedAt: now() })
          .where(eq(slurpThreads.id, commission.threadId));
      }
    },
    /** Replace a placeholder message with the model's rewrite, and keep the inbox preview in step. */
    async rewriteMessageContent(id: string, content: string): Promise<void> {
      const rows = await db.select().from(slurpMessages).where(eq(slurpMessages.id, id));
      const row = rows[0];
      if (!row) return;
      await db.update(slurpMessages).set({ content }).where(eq(slurpMessages.id, id));
      const thread = await context.storage.getThreadById(String(row.threadId));
      // The inbox row caches the last message, so rewriting the message without this leaves the
      // list showing the placeholder next to a conversation that no longer contains it.
      const latest = (await context.storage.listMessages(String(row.threadId), 1))[0];
      if (thread && latest?.id === id) {
        await db
          .update(slurpThreads)
          .set({ lastMessagePreview: content.slice(0, 160), updatedAt: now() })
          .where(eq(slurpThreads.id, thread.id));
      }
    },
    async getCommission(id: string): Promise<SlurpCommission | null> {
      const rows = await db.select().from(slurpCommissions).where(eq(slurpCommissions.id, id));
      return rows[0] ? mapCommission(rows[0]) : null;
    },
    /** Every commission waiting on the fan's answer, for the world tick to settle. */
    async listQuotedCommissions(): Promise<SlurpCommission[]> {
      // Filtered in the query rather than after it: these run every world tick, and the table
      // only ever grows.
      const rows = await db.select().from(slurpCommissions).where(eq(slurpCommissions.state, "quoted"));
      return rows.map(mapCommission);
    },
    /** Briefs opened by generated audience members, which the world can quote automatically. */
    async listAudienceBriefCommissions(): Promise<SlurpCommission[]> {
      const rows = await db.select().from(slurpCommissions).where(eq(slurpCommissions.state, "brief"));
      const population = createSlurpPopulationStorage(db);
      const generated = new Map<string, boolean>();
      const commissions: SlurpCommission[] = [];
      for (const row of rows) {
        const viewerAccountId = String(row.viewerAccountId);
        if (!generated.has(viewerAccountId))
          generated.set(viewerAccountId, Boolean(await population.get(viewerAccountId)));
        if (generated.get(viewerAccountId)) commissions.push(mapCommission(row));
      }
      return commissions;
    },
    /** Briefs addressed to character-controlled Creators. Their world tick supplies the first quote. */
    async listAutomatedBriefCommissions(): Promise<SlurpCommission[]> {
      const rows = await db.select().from(slurpCommissions).where(eq(slurpCommissions.state, "brief"));
      // One read per Creator, not one per brief. A Creator with a stacked queue used to be
      // fetched once for every row in it.
      const automated = new Map<string, boolean>();
      const commissions: SlurpCommission[] = [];
      for (const row of rows) {
        const creatorAccountId = String(row.creatorAccountId);
        if (!automated.has(creatorAccountId)) {
          const creator = await slurp.getNoodlerAccountById(creatorAccountId);
          automated.set(creatorAccountId, Boolean(creator && creator.sourceKind !== "persona"));
        }
        if (automated.get(creatorAccountId)) commissions.push(mapCommission(row));
      }
      return commissions;
    },
    /**
     * Settle a quote on behalf of a fan the world invented.
     *
     * The accept route requires the commission's viewer to be the player's persona, and a
     * generated population member is not one and has no wallet. So every commission the world
     * opened — the only path by which the audience ever pays the Creator anything — sat at
     * `quoted` forever: the player named a price and nothing could ever answer.
     *
     * No wallet is debited, because there is no wallet to debit: this fan is not spending the
     * player's coins. The Creator is credited and the tie records what was paid, which is what
     * makes the funnel's paying stages reachable by anyone other than the player.
     */
    async settleAudienceCommission(id: string, decision: "accept" | "decline"): Promise<SlurpCommission | null> {
      return queueCommissionOperation(id, () => context.storage.settleAudienceCommissionUnlocked(id, decision));
    },
    async settleAudienceCommissionUnlocked(
      id: string,
      decision: "accept" | "decline",
    ): Promise<SlurpCommission | null> {
      const commission = await context.storage.getCommission(id);
      if (!commission || commission.state !== "quoted") return commission;
      const population = createSlurpPopulationStorage(db);
      const member = await population.get(commission.viewerAccountId);
      if (!member) return commission;
      if (decision === "decline") {
        await db
          .update(slurpCommissions)
          .set({ state: "declined", updatedAt: now() })
          .where(eq(slurpCommissions.id, id));
        return context.storage.getCommission(id);
      }
      const fanType = slurpResolveFanType((await slurp.getSettings()).fanTypes, member);
      const commissionBudget = slurpFanTypeCommissionBudget(fanType, member.id);
      const weeklyBudget = slurpFanTypeWeeklyBudget(fanType, member.id);
      if (
        commission.price > commissionBudget ||
        !(await population.reserveWeeklySpend(member.id, commission.creatorAccountId, commission.price, weeklyBudget))
      ) {
        await db
          .update(slurpCommissions)
          .set({ state: "declined", updatedAt: now() })
          .where(eq(slurpCommissions.id, id));
        return context.storage.getCommission(id);
      }
      await slurp.creditCreatorIncome(
        commission.creatorAccountId,
        commission.price,
        "commission",
        `commission:${id}:audience`,
      );
      await slurp.notifyCreatorIncome(
        commission.creatorAccountId,
        "commission",
        commission.price,
        commission.viewerAccountId,
        commission.id,
      );
      await slurp.advanceAudienceTie(commission.viewerAccountId, commission.creatorAccountId, {
        stage: "subscriber",
        spent: commission.price,
      });
      await db.update(slurpCommissions).set({ state: "accepted", updatedAt: now() }).where(eq(slurpCommissions.id, id));
      await context.storage.appendMessage(commission.threadId, {
        senderAccountId: commission.viewerAccountId,
        role: "viewer",
        kind: "system",
        content: `Accepted the quote and paid ${commission.price} coins.`,
        metadata: { commissionId: id },
      });
      return context.storage.getCommission(id);
    },
    async quoteCommission(id: string, price: number): Promise<SlurpCommission | null> {
      return queueCommissionOperation(id, () => context.storage.quoteCommissionUnlocked(id, price));
    },
    async quoteCommissionUnlocked(id: string, price: number): Promise<SlurpCommission | null> {
      // Re-quoting an accepted or delivered commission used to reset it to `quoted`, which made it
      // payable a second time.
      const existing = await context.storage.getCommission(id);
      if (!existing || (existing.state !== "brief" && existing.state !== "quoted")) return existing;
      const timestamp = now();
      await db
        .update(slurpCommissions)
        .set({ state: "quoted", price: String(price), counterPrice: null, updatedAt: timestamp })
        .where(eq(slurpCommissions.id, id));
      const commission = await context.storage.getCommission(id);
      if (commission) {
        await context.storage.appendMessage(commission.threadId, {
          senderAccountId: commission.creatorAccountId,
          role: "creator",
          kind: "commission_quote",
          content: `Commission quote: ${price} coins`,
          price,
          metadata: { commissionId: id },
        });
      }
      return context.storage.getCommission(id);
    },
    /** A fan offers less than the quote. Null when the quote is not open to an offer. */
    async counterCommission(id: string, price: number): Promise<SlurpCommission | null> {
      return queueCommissionOperation(id, () => context.storage.counterCommissionUnlocked(id, price));
    },
    async counterCommissionUnlocked(id: string, price: number): Promise<SlurpCommission | null> {
      const existing = await context.storage.getCommission(id);
      if (!existing || existing.state !== "quoted" || existing.counterPrice !== null) return null;
      if (existing.haggleRounds >= SLURP_COMMISSION_MAX_HAGGLE_ROUNDS || price < 1 || price >= existing.price)
        return null;
      await db
        .update(slurpCommissions)
        .set({ counterPrice: String(price), haggleRounds: String(existing.haggleRounds + 1), updatedAt: now() })
        .where(eq(slurpCommissions.id, id));
      await context.storage.appendMessage(existing.threadId, {
        senderAccountId: existing.viewerAccountId,
        role: "viewer",
        kind: "system",
        content: `Offered ${price} coins instead of ${existing.price}.`,
        metadata: { commissionId: id },
      });
      return context.storage.getCommission(id);
    },
    /** An automated Creator answers a pending counter-offer: take it, meet halfway, or hold the price. */
    async answerCommissionCounter(id: string, floor: number): Promise<SlurpCommission | null> {
      return queueCommissionOperation(id, async () => {
        const existing = await context.storage.getCommission(id);
        if (!existing || existing.state !== "quoted" || existing.counterPrice === null) return existing;
        const answer = slurpCreatorHaggle({
          quote: existing.price,
          offer: existing.counterPrice,
          floor,
          round: existing.haggleRounds,
        });
        if (answer.kind === "accept") return context.storage.quoteCommissionUnlocked(id, existing.counterPrice);
        if (answer.kind === "meet") return context.storage.quoteCommissionUnlocked(id, answer.price);
        await db
          .update(slurpCommissions)
          .set({ counterPrice: null, haggleRounds: String(SLURP_COMMISSION_MAX_HAGGLE_ROUNDS), updatedAt: now() })
          .where(eq(slurpCommissions.id, id));
        await context.storage.appendMessage(existing.threadId, {
          senderAccountId: existing.creatorAccountId,
          role: "creator",
          kind: "commission_quote",
          content: `My price stands at ${existing.price} coins.`,
          price: existing.price,
          metadata: { commissionId: id },
        });
        return context.storage.getCommission(id);
      });
    },
    async acceptCommission(id: string): Promise<SlurpCommission | null> {
      // Serialized like `unlockMessage`: the check-then-spend span is the invariant, and the
      // financial queue only serializes each individual wallet write. Two concurrent accepts both
      // read `quoted` and both paid.
      return queueCommissionOperation(id, () => context.storage.acceptCommissionUnlocked(id));
    },
    async acceptCommissionUnlocked(id: string): Promise<SlurpCommission | null> {
      const commission = await context.storage.getCommission(id);
      if (!commission || commission.state !== "quoted") return commission;
      const settings = await slurp.getSettings();
      const paymentId = `commission:${id}:accept`;
      if (settings.walletEnabled) {
        const paymentIntent = await createSlurpPaymentIntent(
          slurp,
          {
            viewerAccountId: commission.viewerAccountId,
            creatorAccountId: commission.creatorAccountId,
            price: commission.price,
            note: "commission",
            creditOperationId: `${paymentId}:credit`,
          },
          paymentId,
        );
        if (paymentIntent === "unpayable") return null;
        const charged =
          paymentIntent === "charged" || paymentIntent === "settled"
            ? true
            : await slurp.spendCoins(
                commission.viewerAccountId,
                "commission",
                commission.price,
                commission.creatorAccountId,
                paymentId,
              );
        if (!charged) {
          await resetSlurpPaymentIntentAfterInsufficientFunds(slurp, paymentId);
          return null;
        }
        await markSlurpPaymentIntentCharged(slurp, paymentId);
      }
      try {
        await slurp.creditCreatorIncome(
          commission.creatorAccountId,
          commission.price,
          "commission",
          `commission:${id}:accept:credit`,
        );
        await persistSlurpPaymentCreditedAmount(
          slurp,
          paymentId,
          commission.creatorAccountId,
          `commission:${id}:accept:credit`,
        );
        await slurp.notifyCreatorIncome(
          commission.creatorAccountId,
          "commission",
          commission.price,
          commission.viewerAccountId,
          commission.id,
        );
        await db
          .update(slurpCommissions)
          .set({ state: "accepted", updatedAt: now() })
          .where(eq(slurpCommissions.id, id));
        // Relationship progress runs once, after acceptance is durable, so a crashed or compensated
        // accept can never leave paid progress behind or count it twice on retry.
        await applyPaymentTieOnce(
          slurp,
          paymentId,
          commission.viewerAccountId,
          commission.creatorAccountId,
          commission.price,
        );
      } catch (error) {
        // Same compensation as `unlockMessageUnlocked`: a failure after the debit used to strand the
        // coins while leaving the commission payable again.
        if (settings.walletEnabled) {
          await db
            .update(slurpCommissions)
            .set({ state: "cancellation_pending", cancellationId: `commission:${id}:accept`, updatedAt: now() })
            .where(eq(slurpCommissions.id, id));
          await compensateSlurpPayment(
            slurp,
            {
              viewerAccountId: commission.viewerAccountId,
              creatorAccountId: commission.creatorAccountId,
              price: commission.price,
              note: "failed commission accept",
              creditOperationId: `commission:${id}:accept:credit`,
            },
            error,
            `commission:${id}:accept`,
          );
        }
        throw error;
      }
      if (settings.walletEnabled) await completeSlurpPaymentIntent(slurp, paymentId);
      return context.storage.getCommission(id);
    },
    /**
     * End a commission before it is paid for.
     *
     * The same call for both sides: a Creator declining a brief and a fan taking one back are the
     * same state change, and `declined` is the state the schema and the localized labels already
     * ship. Only an unpaid commission may be ended — once it is accepted the coins have moved, so
     * ending it there would need a refund path rather than a state change.
     */
    /**
     * Attach generated media to a message after it exists.
     *
     * The serving URL contains the message id, and `appendMessage` mints that id, so the image can
     * only be bound once the row is written.
     */
    async setMessageMedia(messageId: string, imageUrl: string, mediaPath: string, imagePrompt?: string): Promise<void> {
      const rows = await db.select().from(slurpMessages).where(eq(slurpMessages.id, messageId));
      const row = rows[0];
      if (!row) return;
      const metadata = {
        ...(json(row.metadata as string) ?? {}),
        noodlerMediaPath: mediaPath,
        // What the picture was drawn from, so image context can describe it without a vision call.
        ...(imagePrompt ? { imagePrompt } : {}),
      };
      await db
        .update(slurpMessages)
        .set({ imageUrl, metadata: JSON.stringify(metadata) })
        .where(eq(slurpMessages.id, messageId));
    },
    /** Keep a vision description of a message picture, tied to the picture it describes. */
    async setMessageImageDescription(messageId: string, description: string, source: string): Promise<void> {
      const row = (await db.select().from(slurpMessages).where(eq(slurpMessages.id, messageId)))[0];
      if (!row) return;
      const metadata = {
        ...(json(row.metadata as string) ?? {}),
        imageDescription: description,
        imageDescriptionSource: source,
      };
      await db
        .update(slurpMessages)
        .set({ metadata: JSON.stringify(metadata) })
        .where(eq(slurpMessages.id, messageId));
    },
    async setMessageReaction(
      messageId: string,
      viewerAccountId: string,
      reaction: string | null,
    ): Promise<SlurpMessage | null> {
      const message = await context.storage.getMessageById(messageId);
      if (!message) return null;
      const thread = await context.storage.getThreadById(message.threadId);
      if (!thread || thread.viewerAccountId !== viewerAccountId) return null;
      const metadata = { ...message.metadata, reaction: reaction === "heart" ? "heart" : null };
      await db
        .update(slurpMessages)
        .set({ metadata: JSON.stringify(metadata) })
        .where(eq(slurpMessages.id, messageId));
      return context.storage.getMessageById(messageId);
    },
    async declineCommission(id: string, by: "creator" | "viewer"): Promise<SlurpCommission | null> {
      return queueCommissionOperation(id, () => context.storage.declineCommissionUnlocked(id, by));
    },
    async declineCommissionUnlocked(id: string, by: "creator" | "viewer"): Promise<SlurpCommission | null> {
      const commission = await context.storage.getCommission(id);
      if (!commission) return commission;
      const acceptedUndelivered =
        (commission.state === "accepted" || commission.state === "cancellation_pending") &&
        by === "viewer" &&
        (!commission.deliverAt || commission.deliverAt <= new Date().toISOString());
      if (commission.state === "accepted" && by === "viewer" && !acceptedUndelivered) return commission;
      if (!acceptedUndelivered && commission.state !== "brief" && commission.state !== "quoted") return commission;
      if (acceptedUndelivered) {
        const cancellationId = `commission:${id}:settlement`;
        const claimed = await db.transaction(async (tx) => {
          const current = (await tx.select().from(slurpCommissions).where(eq(slurpCommissions.id, id)))[0];
          if (
            !current ||
            (current.state !== "accepted" && current.state !== "cancellation_pending") ||
            (current.state === "cancellation_pending" && current.cancellationId !== cancellationId) ||
            current.deliveryId ||
            (current.deliverAt && String(current.deliverAt) > new Date().toISOString())
          )
            return false;
          await tx
            .update(slurpCommissions)
            .set({ state: "cancellation_pending", cancellationId, deliverAt: null, updatedAt: now() })
            .where(eq(slurpCommissions.id, id));
          return true;
        });
        if (!claimed) {
          const pending = await context.storage.getCommission(id);
          if (pending?.state !== "cancellation_pending" || pending.cancellationId !== cancellationId) return pending;
        }
        await completeSlurpPaymentIntent(slurp, `commission:${id}:accept`);
        await compensateSlurpPayment(
          slurp,
          {
            viewerAccountId: commission.viewerAccountId,
            creatorAccountId: commission.creatorAccountId,
            price: commission.price,
            note: "cancelled commission",
            creditOperationId: `commission:${id}:accept:credit`,
          },
          new Error("Commission cancellation requires payment compensation"),
          cancellationId,
        );
        await context.storage.appendMessage(commission.threadId, {
          id: `commission:${id}:cancellation-message`,
          senderAccountId: commission.viewerAccountId,
          role: "viewer",
          kind: "system",
          content: "The fan cancelled this commission. The payment was refunded.",
          metadata: { commissionId: id },
        });
        await db
          .update(slurpCommissions)
          .set({ state: "declined", updatedAt: now() })
          .where(eq(slurpCommissions.id, id));
      } else {
        await db
          .update(slurpCommissions)
          .set({ state: "declined", updatedAt: now() })
          .where(eq(slurpCommissions.id, id));
      }
      if (!acceptedUndelivered)
        await context.storage.appendMessage(commission.threadId, {
          senderAccountId: by === "creator" ? commission.creatorAccountId : commission.viewerAccountId,
          role: by === "creator" ? "creator" : "viewer",
          kind: "system",
          content:
            by === "creator" ? "The Creator declined this commission." : "The fan withdrew this commission request.",
          metadata: { commissionId: id },
        });
      return context.storage.getCommission(id);
    },
    /**
     * Hold a finished automatic commission until its delivery is due.
     *
     * The picture is already drawn and promoted, so nothing is being waited on but the clock. The
     * path lives on the row rather than in memory: the wait has to outlive a restart, because the
     * fan has already paid for what is at the end of it.
     */
    async scheduleCommissionDelivery(
      id: string,
      input: { deliverAt: string; mediaPath: string },
    ): Promise<SlurpCommission | null> {
      const commission = await context.storage.getCommission(id);
      if (!commission || commission.state !== "accepted") return null;
      await db
        .update(slurpCommissions)
        .set({ deliverAt: input.deliverAt, mediaPath: input.mediaPath, updatedAt: now() })
        .where(eq(slurpCommissions.id, id));
      return context.storage.getCommission(id);
    },
    /**
     * Automatic commissions whose wait is over.
     *
     * `mediaPath` is returned beside the commission rather than on it, so the host path stays out
     * of everything that reaches the client.
     */
    async listDueCommissionDeliveries(
      at: string,
    ): Promise<Array<{ commission: SlurpCommission; mediaPath: string | null }>> {
      const rows = await db.select().from(slurpCommissions).where(eq(slurpCommissions.state, "accepted"));
      return rows
        .filter((row) => {
          const deliverAt = row.deliverAt as string | null;
          return Boolean(deliverAt) && String(deliverAt) <= at;
        })
        .map((row) => ({
          commission: mapCommission(row),
          mediaPath: (row.mediaPath as string | null) ?? null,
        }));
    },
    async deliverCommission(
      id: string,
      content: string,
      imageUrl: string | null = null,
    ): Promise<SlurpCommission | null> {
      const delivered = await queueCommissionOperation(id, () =>
        context.storage.deliverCommissionUnlocked(id, content, imageUrl),
      );
      // Handing a piece over is a moment the fan wants to answer, so the Creator sticks around.
      if (delivered?.state === "delivered") {
        await context.storage
          .keepOnlineFor(delivered.threadId, SLURP_ONLINE_AFTER_DELIVERY_MINUTES)
          .catch((error: unknown) => logger.warn(error, "[slurp] Could not keep %s online", delivered.threadId));
      }
      return delivered;
    },
    async deliverCommissionUnlocked(
      id: string,
      content: string,
      imageUrl: string | null = null,
    ): Promise<SlurpCommission | null> {
      const commission = await context.storage.getCommission(id);
      if (!commission || commission.state !== "accepted") return commission;
      const deliveryId = `commission:${id}:delivery`;
      const persistedBeforeClaim = await context.storage.getMessageById(deliveryId);
      if (persistedBeforeClaim) {
        await completeSlurpPaymentIntent(slurp, `commission:${id}:accept`);
        await db
          .update(slurpCommissions)
          .set({ state: "delivered", deliveryMessageId: deliveryId, deliverAt: null, updatedAt: now() })
          .where(eq(slurpCommissions.id, id));
        return context.storage.getCommission(id);
      }
      const deliveryClaimToken = newId();
      const claimed = await db.transaction(async (tx) => {
        const current = (await tx.select().from(slurpCommissions).where(eq(slurpCommissions.id, id)))[0];
        if (!current || current.state !== "accepted") return false;
        const claimedAt = Date.parse(String(current.deliveryClaimedAt ?? ""));
        if (current.deliveryId && Number.isFinite(claimedAt) && claimedAt > Date.now() - 5 * 60 * 1000) return false;
        const previousClaim = current.deliveryClaimToken
          ? eq(slurpCommissions.deliveryClaimToken, String(current.deliveryClaimToken))
          : isNull(slurpCommissions.deliveryClaimToken);
        await tx
          .update(slurpCommissions)
          .set({ deliveryId, deliveryClaimToken, deliveryClaimedAt: now(), updatedAt: now() })
          .where(and(eq(slurpCommissions.id, id), eq(slurpCommissions.state, "accepted"), previousClaim));
        const owned = (await tx.select().from(slurpCommissions).where(eq(slurpCommissions.id, id)))[0];
        return owned?.deliveryClaimToken === deliveryClaimToken;
      });
      if (!claimed) {
        const existing = await context.storage.getMessageById(deliveryId);
        if (existing) {
          await completeSlurpPaymentIntent(slurp, `commission:${id}:accept`);
          await db
            .update(slurpCommissions)
            .set({ state: "delivered", deliveryMessageId: deliveryId, deliverAt: null, updatedAt: now() })
            .where(eq(slurpCommissions.id, id));
        }
        if (existing) return context.storage.getCommission(id);
        return context.storage.getCommission(id);
      }
      await completeSlurpPaymentIntent(slurp, `commission:${id}:accept`);
      let message: SlurpMessage | null;
      try {
        message = await context.storage.sendCreatorMessage(commission.creatorAccountId, commission.viewerAccountId, {
          id: deliveryId,
          content,
          kind: "commission_delivery",
          imageUrl,
        });
      } catch (error) {
        const persisted = await context.storage.getMessageById(deliveryId);
        if (!persisted) throw error;
        await completeSlurpPaymentIntent(slurp, `commission:${id}:accept`);
        await db
          .update(slurpCommissions)
          .set({ state: "delivered", deliveryMessageId: deliveryId, deliverAt: null, updatedAt: now() })
          .where(eq(slurpCommissions.id, id));
        return context.storage.getCommission(id);
      }
      if (!message) {
        const settings = await slurp.getSettings();
        if (settings.walletEnabled) {
          const compensationId = `commission:${id}:settlement`;
          await db
            .update(slurpCommissions)
            .set({ state: "cancellation_pending", cancellationId: compensationId, deliverAt: null, updatedAt: now() })
            .where(eq(slurpCommissions.id, id));
          await completeSlurpPaymentIntent(slurp, `commission:${id}:accept`);
          await compensateSlurpPayment(
            slurp,
            {
              viewerAccountId: commission.viewerAccountId,
              creatorAccountId: commission.creatorAccountId,
              price: commission.price,
              note: "failed commission delivery",
              creditOperationId: `commission:${id}:accept:credit`,
            },
            new Error("Commission delivery failed"),
            compensationId,
          );
        }
        // Close it in the same breath as the refund. Leaving it `accepted` left a scheduled
        // delivery due in the past, which the scheduler would retry — and refund — on every poll.
        await db
          .update(slurpCommissions)
          .set({ state: "declined", deliverAt: null, updatedAt: now() })
          .where(eq(slurpCommissions.id, id));
        await context.storage.appendMessage(commission.threadId, {
          senderAccountId: commission.creatorAccountId,
          role: "creator",
          kind: "system",
          content: "This commission could not be delivered. The payment was refunded.",
          metadata: { commissionId: id },
        });
        return null;
      }
      await db
        .update(slurpCommissions)
        .set({ state: "delivered", deliveryMessageId: message.id, deliverAt: null, updatedAt: now() })
        .where(eq(slurpCommissions.id, id));
      return context.storage.getCommission(id);
    },
  };
}
