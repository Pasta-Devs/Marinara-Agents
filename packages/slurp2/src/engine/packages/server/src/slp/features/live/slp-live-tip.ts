import type { DB } from "../../../db/connection.js";
import { slpLiveApplyTip } from "../../../../../shared/src/slp/slp-live.js";
import {
  claimSlurpPaymentIntentForDatabase,
  compensateSlurpPaymentForDatabase,
  resetSlurpPaymentIntentForDatabase,
  settleSlurpPaymentIntentForDatabase,
} from "../../data/messages/slp-messages-storage-context.js";
import { createSlurpLiveStorage } from "../../data/live/slp-live-storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { withSlurpLiveShow } from "./slp-live-lock.js";

export type SlurpLiveTipResult = "booked" | "ended" | "missing" | "processing" | "broke";

/**
 * The player tips a live show (optionally for a menu item). The coins move like a profile tip, through a
 * payment intent keyed by `requestId`; the show books the tip once per request id, so a retry is safe.
 */
export async function tipSlurpLiveShow(
  db: DB,
  input: {
    showId: string;
    viewer: { id: string; displayName: string };
    personaId: string;
    amount: number;
    itemId?: string;
    requestId: string;
  },
  at = new Date(),
): Promise<SlurpLiveTipResult> {
  const storage = createSlurpLiveStorage(db);
  const show = await storage.get(input.showId);
  if (!show) return "missing";
  if (show.endedAt || at.getTime() >= Date.parse(show.endsAt)) return "ended";
  const noodle = createSlurpStorage(db);
  const settings = await noodle.getSettings();
  const operationId = `live-tip:${input.requestId}`;
  const wallets = settings.walletEnabled;
  const payment = {
    viewerAccountId: input.viewer.id,
    creatorAccountId: show.hostId,
    price: input.amount,
    note: "live tip",
    creditOperationId: operationId,
  };
  const intent = wallets ? await claimSlurpPaymentIntentForDatabase(db, payment, operationId) : "claimed";
  if (intent !== "settled") {
    if (intent !== "claimed") return "processing";
    // Same steps as a profile tip (slp-wallet-routes.ts): undo the claim when the coins never moved.
    const wallet = await noodle
      .tipCreator(input.viewer.id, show.hostId, input.amount, operationId)
      .catch(async (error: unknown) => {
        if (wallets && (await noodle.hasWalletSpendOperation(input.viewer.id, operationId))) {
          await compensateSlurpPaymentForDatabase(db, payment, error, operationId);
        } else if (wallets) await resetSlurpPaymentIntentForDatabase(db, operationId);
        throw error;
      });
    if (!wallet) {
      if (wallets) await resetSlurpPaymentIntentForDatabase(db, operationId);
      return "broke";
    }
    if (wallets) await settleSlurpPaymentIntentForDatabase(db, operationId, show.hostId, operationId);
  }
  await withSlurpLiveShow(show.id, async () => {
    const fresh = await storage.get(show.id);
    if (!fresh) return;
    const tip = {
      by: `persona:${input.personaId}`,
      name: input.viewer.displayName,
      amount: input.amount,
      ...(input.itemId ? { itemId: input.itemId } : {}),
    };
    if (slpLiveApplyTip(fresh.state, tip, Math.max(0, at.getTime() - Date.parse(fresh.startedAt)), input.requestId)) {
      await storage.save(show.id, { state: fresh.state });
    }
  });
  return "booked";
}
