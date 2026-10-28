import type { DB } from "../../../db/connection.js";
import { eq, or } from "../../../db/file-query.js";
import { slurpCommissions, slurpPaymentCompensations } from "../../../db/schema/slurp.js";
import { mapCommission } from "./slp-messages-storage-helpers.js";
import type { SlurpMessagesContext } from "./slp-messages-storage-context.js";

/**
 * Did accepting this commission take coins from a player wallet? An audience commission and one
 * accepted with the wallet off charged nobody. Reading the current wallet setting instead
 * refunded coins nobody paid, and an audience refund had no credit to reverse and retried forever.
 */
export async function slurpCommissionWasCharged(db: DB, id: string): Promise<boolean> {
  const [intent] = await db
    .select()
    .from(slurpPaymentCompensations)
    .where(eq(slurpPaymentCompensations.id, `commission:${id}:accept`));
  return intent?.status === "charged" || intent?.status === "settled";
}

export function createMessagesStorageRefunds(context: SlurpMessagesContext) {
  const { db, slurp, compensateSlurpPayment, completeSlurpPaymentIntent, queueCommissionOperation } = context;
  return {
    /**
     * Before "Start over, keep Creators" deletes every commission: refund each one that was paid
     * and not delivered, through the same compensation as a cancel, so the kept wallet is whole.
     */
    async refundOpenCommissions(): Promise<void> {
      const open = await db
        .select()
        .from(slurpCommissions)
        .where(or(eq(slurpCommissions.state, "accepted"), eq(slurpCommissions.state, "cancellation_pending")));
      for (const row of open) {
        const commission = mapCommission(row);
        await queueCommissionOperation(commission.id, async () => {
          if (!(await slurpCommissionWasCharged(db, commission.id))) return;
          await completeSlurpPaymentIntent(slurp, `commission:${commission.id}:accept`);
          await compensateSlurpPayment(
            slurp,
            {
              viewerAccountId: commission.viewerAccountId,
              creatorAccountId: commission.creatorAccountId,
              price: commission.price,
              note: "cancelled commission",
              creditOperationId: `commission:${commission.id}:accept:credit`,
            },
            new Error("Start over refunds an undelivered commission"),
            commission.cancellationId ?? `commission:${commission.id}:settlement`,
          );
        });
      }
    },
  };
}
