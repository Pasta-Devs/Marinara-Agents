import type { DB } from "../../../db/connection.js";
import { slpLiveApplyPrivate } from "../../../../../shared/src/slp/slp-live-private.js";
import { slpLiveApplyTip, slpLivePrivateOn } from "../../../../../shared/src/slp/slp-live.js";
import {
  claimSlurpPaymentIntentForDatabase,
  compensateSlurpPaymentForDatabase,
  resetSlurpPaymentIntentForDatabase,
  settleSlurpPaymentIntentForDatabase,
} from "../../data/messages/slp-messages-storage-context.js";
import { createSlurpLiveStorage } from "../../data/live/slp-live-storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { withSlurpLiveShow } from "./slp-live-lock.js";

export type SlurpLiveTipResult = "booked" | "ended" | "missing" | "processing" | "broke" | "taken" | "hosting";

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
    /** Buys (or extends) a private block at `settings.live.privatePrice` instead of a tip. */
    private?: boolean;
  },
  at = new Date(),
): Promise<SlurpLiveTipResult> {
  const storage = createSlurpLiveStorage(db);
  const show = await storage.get(input.showId);
  if (!show) return "missing";
  if (show.endedAt || at.getTime() >= Date.parse(show.endsAt)) return "ended";
  // The host does not tip or book themselves on their own show.
  if (show.hostKind === "player") return "hosting";
  const noodle = createSlurpStorage(db);
  const settings = await noodle.getSettings();
  const by = `persona:${input.personaId}`;
  const elapsed = Math.max(0, at.getTime() - Date.parse(show.startedAt));
  // A private buy checks, pays and books under one lock, so two first buys cannot both pay for one block.
  const run = async (): Promise<SlurpLiveTipResult> => {
    const current = input.private ? await storage.get(show.id) : show;
    if (!current) return "missing";
    // Somebody else's private block: the room waits outside, no coins move.
    if (slpLivePrivateOn(current.state, elapsed) && current.state.private!.by !== by) return "taken";
    const operationId = `${input.private ? "live-private" : "live-tip"}:${input.requestId}`;
    const wallets = settings.walletEnabled;
    const payment = {
      viewerAccountId: input.viewer.id,
      creatorAccountId: show.hostId,
      price: input.amount,
      note: input.private ? "live private show" : "live tip",
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
    const book = async () => {
      const fresh = await storage.get(show.id);
      if (!fresh) return;
      const tip = {
        by,
        name: input.viewer.displayName,
        amount: input.amount,
        ...(input.itemId ? { itemId: input.itemId } : {}),
      };
      const booked = input.private
        ? slpLiveApplyPrivate(
            fresh.state,
            { by, name: input.viewer.displayName, price: input.amount, minutes: settings.live.privateMinutes },
            elapsed,
            input.requestId,
          )
        : slpLiveApplyTip(fresh.state, tip, elapsed, input.requestId);
      if (booked) {
        await storage.save(show.id, { state: fresh.state });
      }
    };
    await (input.private ? book() : withSlurpLiveShow(show.id, book));
    return "booked";
  };
  return input.private ? withSlurpLiveShow(show.id, run) : run();
}
