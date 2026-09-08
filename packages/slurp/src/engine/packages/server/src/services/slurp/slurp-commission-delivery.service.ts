/**
 * Hand a finished automatic commission over.
 *
 * Shared by the accept route and the message scheduler, because the same three things have to
 * happen in the same order wherever the delivery is triggered from: write the message, bind the
 * picture that was drawn and kept at accept time, and queue the note to be rewritten in the
 * Creator's voice. Doing it in two places is how the two paths drift apart.
 */
import type { DB } from "../../db/connection.js";
import { createSlurpMessagesStorage } from "../storage/slurp-messages.storage.js";
import type { SlurpCommission } from "../storage/slurp-messages.storage.js";
import { enqueueSlurpPendingText } from "./slurp-pending-text.service.js";
import { slurpMessageMediaUrl } from "./slurp-media.js";
import { slurpCommissionDeliveryNote } from "./slurp-world-copy.js";

export type SlurpCommissionDeliveryOutcome =
  | { status: "delivered"; commission: SlurpCommission }
  /** The delivery message could not be written. `deliverCommission` refunded the fan. */
  | { status: "refunded" }
  /** Somebody else delivered or ended it first. Nothing was charged and nothing was refunded. */
  | { status: "stale"; commission: SlurpCommission | null };

export async function deliverAutomaticSlurpCommission(
  db: DB,
  commission: SlurpCommission,
  mediaPath: string | null,
): Promise<SlurpCommissionDeliveryOutcome> {
  const messages = createSlurpMessagesStorage(db);
  // From the copy bank, seeded on the commission, so the same piece always arrives with the same
  // note and every Creator does not say one identical hardcoded sentence.
  const delivered = await messages.deliverCommission(commission.id, slurpCommissionDeliveryNote(commission.id), null);
  if (!delivered) return { status: "refunded" };
  if (delivered.state !== "delivered" || !delivered.deliveryMessageId)
    return { status: "stale", commission: delivered };

  if (mediaPath) {
    await messages.setMessageMedia(
      delivered.deliveryMessageId,
      slurpMessageMediaUrl(delivered.deliveryMessageId),
      mediaPath,
    );
  }
  // The note is deliberately vague, like the briefs the world writes. This is where that is paid
  // back: the next time the player reads, it is rewritten as this Creator handing over this piece.
  await enqueueSlurpPendingText(db, {
    kind: "delivery",
    subjectId: delivered.deliveryMessageId,
    creatorAccountId: commission.creatorAccountId,
    actorLabel: commission.viewerAccountId,
  });
  return { status: "delivered", commission: delivered };
}

/**
 * Deliver every automatic commission whose wait is over.
 *
 * Returns how many landed. Called from the message scheduler's poll, beside the queued replies:
 * both are the same idea, which is the world moving while nobody is looking at it.
 */
export async function deliverDueSlurpCommissions(db: DB): Promise<number> {
  const messages = createSlurpMessagesStorage(db);
  const due = await messages.listDueCommissionDeliveries(new Date().toISOString());
  let delivered = 0;
  for (const { commission, mediaPath } of due) {
    const outcome = await deliverAutomaticSlurpCommission(db, commission, mediaPath);
    if (outcome.status === "delivered") delivered += 1;
  }
  return delivered;
}
