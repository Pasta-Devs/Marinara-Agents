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
import { createSlurpStorage } from "../slp-storage.js";

export type SlurpMessagesCoreFactory = (db: DB) => any;
export type SlurpMessagesContext = ReturnType<typeof createSlurpMessagesContext>;

// In-flight operations are process-wide, as they were before the storage split: every messages
// storage instance must see the same pending unlock, tip, commission, and payment claim.
const messageUnlocks = new Map<string, Promise<SlurpMessage | null>>();

const directMessageTips = new Map<string, Promise<SlurpSendResult>>();

const commissionOperations = new Map<string, Promise<SlurpCommission | null>>();

const paymentIntentClaims = new Map<string, Promise<SlurpPaymentIntentClaim>>();

const slurpDatabases = new WeakMap<object, DB>();

type SlurpPaymentIntentClaim = "claimed" | "charged" | "settled" | "unpayable";

type SlurpPayment = {
  viewerAccountId: string;
  creatorAccountId: string;
  price: number;
  note: string;
  creditOperationId: string;
};

export function createSlurpMessagesContext(db: DB, createCore: SlurpMessagesCoreFactory) {
  class SlurpCompensationError extends Error {
    constructor(
      readonly originalFailure: unknown,
      readonly compensationFailures: Array<{ operation: string; error: unknown }>,
      readonly payment: {
        viewerAccountId: string;
        creatorAccountId: string;
        price: number;
        note: string;
        creditOperationId: string;
      },
    ) {
      super(`Payment compensation failed for ${payment.note}`, { cause: originalFailure });
      this.name = "SlurpCompensationError";
    }
  }

  async function compensateSlurpPayment(
    slurp: ReturnType<SlurpMessagesCoreFactory>,
    payment: {
      viewerAccountId: string;
      creatorAccountId: string;
      price: number;
      note: string;
      creditOperationId: string;
    },
    originalFailure: unknown,
    compensationId: string,
  ): Promise<void> {
    const db = slurpDatabases.get(slurp);
    if (!db) throw new Error("Slurp compensation database is unavailable");
    const failures: Array<{ operation: string; error: unknown }> = [];
    const existing = (
      await db.select().from(slurpPaymentCompensations).where(eq(slurpPaymentCompensations.id, compensationId))
    )[0];
    if (!existing) {
      const timestamp = now();
      try {
        await db.insert(slurpPaymentCompensations).values({
          id: compensationId,
          viewerAccountId: payment.viewerAccountId,
          creatorAccountId: payment.creatorAccountId,
          amount: String(payment.price),
          creditedAmount: null,
          note: payment.note,
          creditOperationId: payment.creditOperationId,
          status: "charged",
          refundedAt: null,
          reversedAt: null,
          effectsAppliedAt: null,
          failedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      } catch (error) {
        if (!isSlurpFileUniqueConstraintError(error, "slurp2_payment_compensations", ["id"])) throw error;
      }
    }
    try {
      let current = (
        await db.select().from(slurpPaymentCompensations).where(eq(slurpPaymentCompensations.id, compensationId))
      )[0];
      if (!current) throw new Error("Payment compensation row was not persisted");
      if (!current.refundedAt) {
        await slurp.refundCoins(payment.viewerAccountId, payment.price, payment.note, `${compensationId}:refund`);
        await db
          .update(slurpPaymentCompensations)
          .set({ refundedAt: now(), status: "partial", updatedAt: now() })
          .where(eq(slurpPaymentCompensations.id, compensationId));
      }
      current = (
        await db.select().from(slurpPaymentCompensations).where(eq(slurpPaymentCompensations.id, compensationId))
      )[0];
      let reversal: number;
      if (current.creditedAmount == null) {
        const related = await db
          .select()
          .from(slurpPaymentCompensations)
          .where(eq(slurpPaymentCompensations.creditOperationId, payment.creditOperationId));
        const recordedAmount = related.find((row) => row.creditedAmount != null)?.creditedAmount;
        const creditedAmount =
          recordedAmount == null
            ? await slurp.getCreatorIncomeOperationAmount(payment.creatorAccountId, payment.creditOperationId)
            : Number(recordedAmount);
        if (creditedAmount === null) throw new Error("Matching creator income credit amount was not found");
        if (!Number.isInteger(creditedAmount) || creditedAmount < 0)
          throw new Error("Stored creator income credit amount is invalid");
        reversal = creditedAmount;
        await db
          .update(slurpPaymentCompensations)
          .set({ creditedAmount: String(creditedAmount), updatedAt: now() })
          .where(eq(slurpPaymentCompensations.id, compensationId));
      } else {
        reversal = Number(current.creditedAmount);
        if (!Number.isInteger(reversal) || reversal < 0)
          throw new Error("Stored creator income credit amount is invalid");
      }
      if (reversal > 0 && !current?.reversedAt) {
        const reversed = await slurp.reverseCreatorIncome(
          payment.creatorAccountId,
          reversal,
          payment.note,
          `${compensationId}:reverse`,
        );
        if (!reversed) throw new Error("Creator income reversal did not occur");
        await db
          .update(slurpPaymentCompensations)
          .set({ reversedAt: now(), status: "completed", updatedAt: now() })
          .where(eq(slurpPaymentCompensations.id, compensationId));
      } else if (reversal === 0) {
        await db
          .update(slurpPaymentCompensations)
          .set({ status: "completed", updatedAt: now() })
          .where(eq(slurpPaymentCompensations.id, compensationId));
      }
    } catch (error) {
      failures.push({ operation: "compensation setup", error });
    }
    if (failures.length > 0) {
      try {
        await db
          .update(slurpPaymentCompensations)
          .set({ status: "failed", failedAt: now(), updatedAt: now() })
          .where(eq(slurpPaymentCompensations.id, compensationId));
      } catch (error) {
        failures.push({ operation: "compensation state update", error });
      }
      const compensationError = new SlurpCompensationError(originalFailure, failures, payment);
      logger.error(
        { err: compensationError, payment, compensationFailures: failures },
        "[slurp] Payment compensation failed; retry state is preserved",
      );
      throw compensationError;
    }
  }

  async function persistSlurpPaymentCreditedAmount(
    slurp: ReturnType<SlurpMessagesCoreFactory>,
    compensationId: string,
    creatorAccountId: string,
    creditOperationId: string,
  ): Promise<void> {
    const db = slurpDatabases.get(slurp);
    if (!db) throw new Error("Slurp compensation database is unavailable");
    const creditedAmount = (await slurp.getCreatorIncomeOperationAmount(creatorAccountId, creditOperationId)) ?? 0;
    await db
      .update(slurpPaymentCompensations)
      .set({ creditedAmount: String(creditedAmount), updatedAt: now() })
      .where(eq(slurpPaymentCompensations.id, compensationId));
  }

  async function compensateSlurpPaymentForDatabase(
    db: DB,
    payment: SlurpPayment,
    originalFailure: unknown,
    compensationId: string,
  ): Promise<void> {
    const slurp = createCore(db);
    slurpDatabases.set(slurp, db);
    await compensateSlurpPayment(slurp, payment, originalFailure, compensationId);
  }

  async function claimSlurpPaymentIntentForDatabase(
    db: DB,
    payment: SlurpPayment,
    paymentId: string,
  ): Promise<SlurpPaymentIntentClaim> {
    const slurp = createCore(db);
    slurpDatabases.set(slurp, db);
    return createSlurpPaymentIntent(slurp, payment, paymentId);
  }

  async function resetSlurpPaymentIntentForDatabase(db: DB, paymentId: string): Promise<void> {
    const slurp = createCore(db);
    slurpDatabases.set(slurp, db);
    await resetSlurpPaymentIntentAfterInsufficientFunds(slurp, paymentId);
  }

  async function settleSlurpPaymentIntentForDatabase(
    db: DB,
    paymentId: string,
    creatorAccountId: string,
    creditOperationId: string,
  ): Promise<void> {
    const slurp = createCore(db);
    slurpDatabases.set(slurp, db);
    await persistSlurpPaymentCreditedAmount(slurp, paymentId, creatorAccountId, creditOperationId);
    await completeSlurpPaymentIntent(slurp, paymentId);
  }

  async function createSlurpPaymentIntent(
    slurp: ReturnType<SlurpMessagesCoreFactory>,
    payment: {
      viewerAccountId: string;
      creatorAccountId: string;
      price: number;
      note: string;
      creditOperationId: string;
    },
    compensationId: string,
  ): Promise<SlurpPaymentIntentClaim> {
    const previous = paymentIntentClaims.get(compensationId) ?? Promise.resolve("unpayable" as const);
    const current = previous
      .catch(() => "unpayable" as const)
      .then(async () => {
        const result = await createSlurpPaymentIntentUnlocked(slurp, payment, compensationId);
        return result;
      });
    paymentIntentClaims.set(compensationId, current);
    void current.then(
      () => {
        if (paymentIntentClaims.get(compensationId) === current) paymentIntentClaims.delete(compensationId);
      },
      () => {
        if (paymentIntentClaims.get(compensationId) === current) paymentIntentClaims.delete(compensationId);
      },
    );
    return current;
  }

  async function createSlurpPaymentIntentUnlocked(
    slurp: ReturnType<SlurpMessagesCoreFactory>,
    payment: {
      viewerAccountId: string;
      creatorAccountId: string;
      price: number;
      note: string;
      creditOperationId: string;
    },
    compensationId: string,
  ): Promise<SlurpPaymentIntentClaim> {
    const db = slurpDatabases.get(slurp);
    if (!db) throw new Error("Slurp compensation database is unavailable");
    const timestamp = now();
    try {
      await db.insert(slurpPaymentCompensations).values({
        id: compensationId,
        viewerAccountId: payment.viewerAccountId,
        creatorAccountId: payment.creatorAccountId,
        amount: String(payment.price),
        creditedAmount: null,
        note: payment.note,
        creditOperationId: payment.creditOperationId,
        status: "created",
        refundedAt: null,
        reversedAt: null,
        effectsAppliedAt: null,
        failedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    } catch (error) {
      if (!isSlurpFileUniqueConstraintError(error, "slurp2_payment_compensations", ["id"])) throw error;
    }
    const existing = (
      await db.select().from(slurpPaymentCompensations).where(eq(slurpPaymentCompensations.id, compensationId))
    )[0];
    if (!existing) throw new Error("Slurp payment intent was not persisted");
    if (
      String(existing.viewerAccountId) !== payment.viewerAccountId ||
      String(existing.creatorAccountId) !== payment.creatorAccountId ||
      int(existing.amount) !== payment.price ||
      String(existing.note ?? "") !== payment.note ||
      String(existing.creditOperationId ?? "") !== payment.creditOperationId
    )
      return "unpayable";
    if (existing.status === "charged") return "charged";
    if (existing.status === "settled") return "settled";
    let status = existing.status;
    if (existing.status === "declined") {
      await db
        .update(slurpPaymentCompensations)
        .set({ status: "created", claimToken: null, updatedAt: now() })
        .where(and(eq(slurpPaymentCompensations.id, compensationId), eq(slurpPaymentCompensations.status, "declined")));
      status = "created";
    }
    if (status !== "created") return "unpayable";
    const claimToken = newId();
    await db
      .update(slurpPaymentCompensations)
      .set({ status: "charging", claimToken, updatedAt: now() })
      .where(and(eq(slurpPaymentCompensations.id, compensationId), eq(slurpPaymentCompensations.status, "created")));
    const claimed = (
      await db
        .select()
        .from(slurpPaymentCompensations)
        .where(
          and(eq(slurpPaymentCompensations.id, compensationId), eq(slurpPaymentCompensations.claimToken, claimToken)),
        )
    )[0];
    return claimed?.status === "charging" ? "claimed" : "unpayable";
  }

  async function markSlurpPaymentIntentCharged(
    slurp: ReturnType<SlurpMessagesCoreFactory>,
    compensationId: string,
  ): Promise<void> {
    const db = slurpDatabases.get(slurp);
    if (!db) throw new Error("Slurp compensation database is unavailable");
    await db
      .update(slurpPaymentCompensations)
      .set({ status: "charged", updatedAt: now() })
      .where(eq(slurpPaymentCompensations.id, compensationId));
  }

  async function resetSlurpPaymentIntentAfterInsufficientFunds(
    slurp: ReturnType<SlurpMessagesCoreFactory>,
    compensationId: string,
  ): Promise<void> {
    const db = slurpDatabases.get(slurp);
    if (!db) throw new Error("Slurp compensation database is unavailable");
    await db
      .update(slurpPaymentCompensations)
      .set({ status: "created", claimToken: null, updatedAt: now() })
      .where(and(eq(slurpPaymentCompensations.id, compensationId), eq(slurpPaymentCompensations.status, "charging")));
  }

  async function recoverChargingSlurpPayment(
    slurp: ReturnType<SlurpMessagesCoreFactory>,
    row: typeof slurpPaymentCompensations.$inferSelect,
  ): Promise<void> {
    const db = slurpDatabases.get(slurp);
    if (!db) throw new Error("Slurp compensation database is unavailable");
    const stale = Date.parse(String(row.updatedAt)) <= Date.now() - 5 * 60 * 1000;
    if (!stale) return;
    // The payment intent ID is also the spend operation ID in both payment paths. Querying that
    // stable ledger key proves a debit without calling spendCoins again after a restart.
    const spendOperationId = String(row.id);
    const provenCharged = await slurp.hasWalletSpendOperation(String(row.viewerAccountId), spendOperationId);
    if (!provenCharged) {
      // A missing ledger row cannot prove a debit, so make the intent retryable without refunding.
      await db
        .update(slurpPaymentCompensations)
        .set({ status: "created", claimToken: null, updatedAt: now() })
        .where(
          and(
            eq(slurpPaymentCompensations.id, row.id),
            eq(slurpPaymentCompensations.status, "charging"),
            eq(slurpPaymentCompensations.claimToken, row.claimToken),
          ),
        );
      logger.warn("[slurp] Stale charging payment has no debit proof; reset for retry: %s", row.id);
      return;
    }
    await db
      .update(slurpPaymentCompensations)
      .set({ status: "charged", updatedAt: now() })
      .where(and(eq(slurpPaymentCompensations.id, row.id), eq(slurpPaymentCompensations.status, "charging")));
  }

  async function completeSlurpPaymentIntent(
    slurp: ReturnType<SlurpMessagesCoreFactory>,
    compensationId: string,
  ): Promise<void> {
    const db = slurpDatabases.get(slurp);
    if (!db) throw new Error("Slurp compensation database is unavailable");
    await db
      .update(slurpPaymentCompensations)
      .set({ status: "settled", updatedAt: now() })
      // A compensated intent stays compensated. Settling it again after recovery refunded the fan
      // counted the payment as both refunded and paid.
      .where(
        and(
          eq(slurpPaymentCompensations.id, compensationId),
          inArray(slurpPaymentCompensations.status, ["created", "charging", "charged", "settled"]),
        ),
      );
  }

  async function applySlurpTipEffects(slurp: ReturnType<SlurpMessagesCoreFactory>, paymentId: string): Promise<void> {
    const db = slurpDatabases.get(slurp);
    if (!db) throw new Error("Slurp compensation database is unavailable");
    const payment = (
      await db.select().from(slurpPaymentCompensations).where(eq(slurpPaymentCompensations.id, paymentId))
    )[0];
    if (!payment || payment.effectsAppliedAt || payment.status !== "settled") return;
    const note = String(payment.note ?? "");
    if (note !== "profile tip" && note !== "direct-message tip") return;
    const creator = await slurp.getNoodlerAccountById(String(payment.creatorAccountId));
    if (!creator) throw new Error("Tip Creator was not found while applying durable effects");
    await db.transaction(async (tx) => {
      const current = (
        await tx.select().from(slurpPaymentCompensations).where(eq(slurpPaymentCompensations.id, paymentId))
      )[0];
      if (!current || current.effectsAppliedAt || current.status !== "settled") return;
      const amount = int(current.amount as string);
      if (creator.sourceKind === "persona" && creator.sourceEntityId) {
        await createSlurpEventsStorage(tx).recordAndPrune({
          recipientPersonaId: creator.sourceEntityId,
          kind: "tip",
          creatorAccountId: creator.id,
          actorLabel: String(current.viewerAccountId),
          operationId: `${paymentId}:event`,
          amount,
        });
      }
      await createSlurpPopulationStorage(tx).advanceTie(String(current.viewerAccountId), creator.id, {
        stage: "regular",
        spent: amount,
        tipped: amount,
      });
      await tx
        .update(slurpPaymentCompensations)
        .set({ effectsAppliedAt: now(), updatedAt: now() })
        .where(and(eq(slurpPaymentCompensations.id, paymentId), isNull(slurpPaymentCompensations.effectsAppliedAt)));
    });
  }

  async function applyPaymentTieOnce(
    slurp: ReturnType<SlurpMessagesCoreFactory>,
    paymentId: string,
    viewerAccountId: string,
    creatorAccountId: string,
    spent: number,
  ): Promise<void> {
    const db = slurpDatabases.get(slurp);
    if (!db) throw new Error("Slurp compensation database is unavailable");
    await db.transaction(async (tx) => {
      const current = (
        await tx.select().from(slurpPaymentCompensations).where(eq(slurpPaymentCompensations.id, paymentId))
      )[0];
      if (!current || current.effectsAppliedAt) return;
      await createSlurpPopulationStorage(tx).advanceTie(viewerAccountId, creatorAccountId, {
        stage: "regular",
        spent,
      });
      await tx
        .update(slurpPaymentCompensations)
        .set({ effectsAppliedAt: now(), updatedAt: now() })
        .where(and(eq(slurpPaymentCompensations.id, paymentId), isNull(slurpPaymentCompensations.effectsAppliedAt)));
    });
  }

  async function applySlurpTipEffectsForDatabase(db: DB, paymentId: string): Promise<void> {
    const slurp = createCore(db);
    slurpDatabases.set(slurp, db);
    await applySlurpTipEffects(slurp, paymentId);
  }

  async function hasCompletedSlurpPaymentOperation(
    db: DB,
    slurp: ReturnType<SlurpMessagesCoreFactory>,
    row: typeof slurpPaymentCompensations.$inferSelect,
  ): Promise<boolean> {
    const paymentId = String(row.id);
    const note = String(row.note ?? "");
    if (note === "message request" && paymentId === `message-request:${row.viewerAccountId}:${row.creatorAccountId}`) {
      return (
        (
          await db
            .select()
            .from(slurpThreads)
            .where(
              and(
                eq(slurpThreads.viewerAccountId, String(row.viewerAccountId)),
                eq(slurpThreads.creatorAccountId, String(row.creatorAccountId)),
              ),
            )
        ).length > 0
      );
    }
    if (note === "PPV unlock" && paymentId.startsWith("ppv:")) {
      const message = (
        await db
          .select()
          .from(slurpMessages)
          .where(eq(slurpMessages.id, paymentId.slice(4)))
      )[0];
      return Boolean(message?.unlockedAt);
    }
    if (note === "commission" && paymentId.startsWith("commission:") && paymentId.endsWith(":accept")) {
      const commissionId = paymentId.slice("commission:".length, -":accept".length);
      const commission = (await db.select().from(slurpCommissions).where(eq(slurpCommissions.id, commissionId)))[0];
      if (commission?.state === "accepted" || commission?.state === "delivered") return true;
      return (
        (commission?.state === "cancellation_pending" || commission?.state === "declined") &&
        commission.cancellationId === `commission:${commissionId}:settlement`
      );
    }
    if (note === "profile tip" && paymentId.startsWith("profile-tip:")) {
      if (row.creditedAmount != null) return true;
      if (!row.creditOperationId) return false;
      return (
        (await slurp.getCreatorIncomeOperationAmount(String(row.creatorAccountId), row.creditOperationId)) !== null
      );
    }
    if (note === "direct-message tip" && paymentId.startsWith("dm:") && paymentId.endsWith(":credit")) {
      const messageId = `${paymentId.slice(0, -":credit".length)}:tip`;
      return Boolean((await db.select().from(slurpMessages).where(eq(slurpMessages.id, messageId)))[0]);
    }
    return false;
  }

  function queueCommissionOperation(
    id: string,
    operation: () => Promise<SlurpCommission | null>,
  ): Promise<SlurpCommission | null> {
    const previous = commissionOperations.get(id) ?? Promise.resolve(null);
    const current = previous.catch(() => null).then(operation);
    commissionOperations.set(id, current);
    void current.then(
      () => {
        if (commissionOperations.get(id) === current) commissionOperations.delete(id);
      },
      () => {
        if (commissionOperations.get(id) === current) commissionOperations.delete(id);
      },
    );
    return current;
  }

  void SLURP_DEFAULT_CREATOR_MESSAGING;

  const slurp = createCore(db);

  slurpDatabases.set(slurp, db);

  const settingsStore = createAppSettingsStorage(db);

  const readMessagingBlob = async (): Promise<Record<string, unknown>> =>
    json(await settingsStore.get(SLURP_CREATOR_MESSAGING_KEY));

  /** Where a creator nobody has configured by hand starts. Settings owns it, not a constant. */
  const messagingDefaults = async (): Promise<SlurpCreatorMessaging> => {
    const settings = await slurp.getSettings();
    return {
      ...SLURP_DEFAULT_CREATOR_MESSAGING,
      dmPolicy: settings.messagesDefaultDmPolicy as SlurpCreatorMessaging["dmPolicy"],
      requestFee: settings.messagesDefaultRequestFee,
      ppvPrice: settings.messagesDefaultPpvPrice,
      commissionBase: settings.simulationTuning.economy.audienceCommissionPrice,
    };
  };
  return {
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
    compensateSlurpPaymentForDatabase,
    claimSlurpPaymentIntentForDatabase,
    resetSlurpPaymentIntentForDatabase,
    settleSlurpPaymentIntentForDatabase,
    applySlurpTipEffectsForDatabase,
    storage: {},
  };
}

// The profile tip route settles payments outside a messages storage instance. These run on the
// full Slurp storage, exactly as the pre-split module-level helpers did.
const paymentHelpers = (db: DB) => createSlurpMessagesContext(db, createSlurpStorage);

export const compensateSlurpPaymentForDatabase: SlurpMessagesContext["compensateSlurpPaymentForDatabase"] = (
  db,
  ...rest
) => paymentHelpers(db).compensateSlurpPaymentForDatabase(db, ...rest);

export const claimSlurpPaymentIntentForDatabase: SlurpMessagesContext["claimSlurpPaymentIntentForDatabase"] = (
  db,
  ...rest
) => paymentHelpers(db).claimSlurpPaymentIntentForDatabase(db, ...rest);

export const resetSlurpPaymentIntentForDatabase: SlurpMessagesContext["resetSlurpPaymentIntentForDatabase"] = (
  db,
  ...rest
) => paymentHelpers(db).resetSlurpPaymentIntentForDatabase(db, ...rest);

export const settleSlurpPaymentIntentForDatabase: SlurpMessagesContext["settleSlurpPaymentIntentForDatabase"] = (
  db,
  ...rest
) => paymentHelpers(db).settleSlurpPaymentIntentForDatabase(db, ...rest);

export const applySlurpTipEffectsForDatabase: SlurpMessagesContext["applySlurpTipEffectsForDatabase"] = (db, ...rest) =>
  paymentHelpers(db).applySlurpTipEffectsForDatabase(db, ...rest);
