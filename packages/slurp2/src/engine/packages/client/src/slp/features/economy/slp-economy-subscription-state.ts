import type { SlurpWallet } from "./slp-economy-contract";
/**
 * Where this viewer stands with a Creator's subscription (design step 3): renewing, cancelled but
 * still paid (it can be resumed at no charge until `until`), ended (the wallet remembers a subscribe
 * or renew to this Creator, or a cancelled period ran out before the wallet was read again), or never.
 */
export type SlpProfileSubscriptionState =
  | { kind: "active"; until: string; price: number }
  | { kind: "cancelled"; until: string; price: number }
  | { kind: "ended" }
  | { kind: "none" };

export function slpProfileSubscriptionState({
  creatorId,
  subscribed,
  wallet,
  at = new Date(),
}: {
  creatorId: string;
  subscribed: boolean;
  wallet: Pick<SlurpWallet, "subscriptions" | "ledger"> | null | undefined;
  at?: Date;
}): SlpProfileSubscriptionState {
  const paid = wallet?.subscriptions[creatorId];
  if (subscribed && paid) {
    // Past its end the server charges a new period instead of resuming, so the page must not offer Resume.
    if (paid.cancelled && !(Date.parse(paid.paidThroughAt) > at.getTime())) return { kind: "ended" };
    return { kind: paid.cancelled ? "cancelled" : "active", until: paid.paidThroughAt, price: paid.price };
  }
  if (subscribed || !wallet) return { kind: "none" };
  const before = wallet.ledger.some(
    (entry) => (entry.kind === "subscribe" || entry.kind === "renew") && entry.binding?.creatorAccountId === creatorId,
  );
  return before ? { kind: "ended" } : { kind: "none" };
}
