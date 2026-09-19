import { and, like, or } from "../../../db/file-query.js";
import { credit, slurpWalletKey, SlurpWallet } from "../../modules/economy/slp-wallet.js";
import { createSlurpEventsStorage } from "../notifications/slp-notification-storage.js";
import { createSlurpPopulationStorage } from "../audience/slp-audience-storage-funnel.js";
import type { SlurpFunnelStage } from "../../../../../shared/src/slp/slp-population.js";
import type { SlurpEventKind } from "../../modules/notifications/slp-event-weight.js";
import { payout as payoutEarnings, SlurpEarnings } from "../../modules/economy/slp-earnings.js";
import { logger } from "../../../lib/logger.js";
import { NOODLER_FAN_IDENTITY_PREFIX } from "../../modules/audience/slp-fan-identity-provider.js";
import { slurpViewerSettingsKey } from "../host/slp-storage-constants.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export function createEconomyStorage3(context: SlurpStorageContext) {
  const {
    db,
    settingsStore,
    characters,
    readProjectEntries,
    isProjectEntry,
    loadProjects,
    writeProjects,
    readCreatorPrices,
    economyFrom,
    compensate,
    writeWallet,
    restoreSetting,
    restoreWallet,
    enqueueFinancial,
    writeEarnings,
    mutateCreatorStateNow,
    creditEarningsNow,
    getWalletNow,
    pruneFinishedRefreshRuns,
    reconcilePublicHandles,
    insertInteraction,
    normalizeLegacyNoodlerToggleInteraction,
    upsertPollVote,
    deleteInteractionChildren,
    deleteStoredInteraction,
  } = context;
  const storage = {
    /**
     * Notify the operator that money arrived.
     *
     * Separate from `creditCreatorIncome` on purpose: that one returns early when the wallet is
     * off or the revenue share is zero, and a Creator with the economy disabled should still be
     * told that somebody subscribed.
     */
    async notifyCreatorIncome(
      creatorAccountId: string,
      reason: "unlock" | "subscribe" | "renew" | "tip" | "messageRequest" | "ppv" | "commission",
      amount: number,
      actorLabel?: string | null,
      subjectId?: string | null,
    ): Promise<void> {
      const kind: SlurpEventKind =
        reason === "tip"
          ? "tip"
          : reason === "subscribe" || reason === "renew"
            ? "subscribed"
            : reason === "ppv"
              ? "ppv_unlock"
              : reason === "messageRequest"
                ? "message"
                : reason === "commission"
                  ? "commission_accepted"
                  : "unlock";
      await this.recordCreatorEvent(creatorAccountId, kind, { amount, actorLabel, subjectId });
    },
    /**
     * Move somebody along a Creator's funnel.
     *
     * The funnel is what a follower count will eventually be counted from, so it has to record
     * real actions and not only the world tick's. Wrapped like `recordCreatorEvent`: a funnel
     * write must never roll back the payment that caused it.
     */
    async advanceAudienceTie(
      memberId: string,
      creatorAccountId: string,
      input: {
        stage?: SlurpFunnelStage;
        spent?: number;
        tipped?: number;
        unlocked?: number;
        interactions?: number;
        hasSubscription?: boolean;
      },
    ): Promise<void> {
      // A legacy `noodler-fan:` id names an archetype slot, not a person, and persisted day plans
      // written before the population existed still carry them. A tie for one is a follower who
      // can never be resolved or shown, inflating reach with somebody who does not exist.
      if (memberId.startsWith(NOODLER_FAN_IDENTITY_PREFIX)) return;
      try {
        await createSlurpPopulationStorage(db).advanceTie(memberId, creatorAccountId, input);
      } catch (error) {
        logger.warn(error, "[slurp-population] Could not advance the tie for %s", memberId);
      }
    },
    /**
     * Record one notification against whoever operates this Creator.
     *
     * A character-backed Creator has no operator, so it silently records nothing — that is the
     * correct answer, not a failure. Never lets a notification failure break the action that
     * caused it: a subscription that succeeded must not be rolled back because a feed row could
     * not be written.
     */
    async recordCreatorEvent(
      creatorAccountId: string,
      kind: SlurpEventKind,
      detail: { subjectId?: string | null; actorLabel?: string | null; amount?: number; note?: string | null } = {},
    ): Promise<void> {
      try {
        const creator = await this.getNoodlerAccountById(creatorAccountId);
        if (!creator || creator.sourceKind !== "persona" || !creator.sourceEntityId) return;
        await createSlurpEventsStorage(db).recordAndPrune({
          recipientPersonaId: creator.sourceEntityId,
          kind,
          creatorAccountId,
          ...detail,
        });
      } catch (error) {
        logger.warn(error, "[slurp-events] Could not record a %s event for %s", kind, creatorAccountId);
      }
    },
    /**
     * Move earnings into the operating persona's spending money.
     *
     * This is what closes the circuit: a Creator who does well funds your habit as a fan. Only a
     * persona-backed Creator can pay out, because a character-backed one has nobody to pay.
     *
     * The two writes are ordered earnings-first: if the wallet write fails the coins are put back,
     * and a crash between them costs the player money they can see rather than minting money they
     * cannot account for.
     */
    async payOutEarnings(
      creatorAccountId: string,
      amount: number,
    ): Promise<{ status: "paid"; earnings: SlurpEarnings; wallet: SlurpWallet } | { status: "refused" }> {
      const creator = await this.getNoodlerAccountById(creatorAccountId);
      if (!creator || creator.sourceKind !== "persona" || !creator.sourceEntityId) return { status: "refused" };
      const recipientId = creator.sourceEntityId;
      const run = enqueueFinancial(async () => {
        const current = await this.getEarnings(creatorAccountId);
        const next = payoutEarnings(current, amount, new Date());
        if (!next) return { status: "refused" as const };
        const previousWalletValue = await settingsStore.get(slurpWalletKey(recipientId));
        const previousViewerSettingsValue = await settingsStore.get(slurpViewerSettingsKey(recipientId));
        await writeEarnings(creatorAccountId, next);
        try {
          const wallet = await getWalletNow(recipientId);
          const credited = await writeWallet(
            recipientId,
            credit(wallet, "topUp", amount, new Date(), `payout: ${creator.handle}`),
          );
          return { status: "paid" as const, earnings: next, wallet: credited };
        } catch (error) {
          await compensate(
            error,
            [
              () => restoreWallet(recipientId, previousWalletValue, previousViewerSettingsValue),
              () => writeEarnings(creatorAccountId, current),
            ],
            "payout",
          );
          throw error;
        }
      });
      return run;
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
