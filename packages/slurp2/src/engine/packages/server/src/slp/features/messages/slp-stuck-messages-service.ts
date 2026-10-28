/**
 * The world tick's message upkeep: what nobody else is going to finish (7c review).
 *
 * - A paid commission of an automatic Creator always ends in a delivery (M-005). The player's accept
 *   route draws and schedules its own; a quote an AI fan accepted on the tick, or an accept whose
 *   scheduling failed, sat paid and silent. The message scheduler hands over what gets a time here.
 * - A message request no automatic Creator will answer expires after five days (M-009): declined
 *   and read, so the Creator's open requests stop growing and new fans can write again.
 *
 * No model calls.
 */
import type { DB } from "../../../db/connection.js";
import { createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { slurpExpiredRequestIds, slurpUnscheduledCommissionDeliveries } from "../../modules/messages/slp-messaging.js";

export async function settleSlurpStuckMessages(
  db: DB,
  automaticCreatorIds: ReadonlySet<string>,
  now: Date,
): Promise<void> {
  const messages = createSlurpMessagesStorage(db);
  // ponytail: text-only delivery (the Creator's note, no picture); drawing it needs an image budget
  // row for audience commissions.
  for (const repair of slurpUnscheduledCommissionDeliveries(
    await messages.listAcceptedCommissions(),
    automaticCreatorIds,
    now,
  ))
    await messages.scheduleCommissionDelivery(repair.id, { deliverAt: repair.deliverAt, mediaPath: null });
  for (const id of slurpExpiredRequestIds(
    await messages.listThreadsForCreators([...automaticCreatorIds]),
    automaticCreatorIds,
    now,
  )) {
    await messages.resolveRequest(id, "decline");
    await messages.markRead(id, "creator");
  }
}
