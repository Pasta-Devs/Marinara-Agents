/**
 * The Slurp coin economy: balance, ledger, prices, and earning caps.
 *
 * Pure by design. Nothing here touches the DB, so the rules can be unit-tested without an
 * Engine checkout — the same reason `slurp-prices.ts` stands alone.
 *
 * The state lives under its own app-settings key rather than in `NoodleAccountSettings.wallet`,
 * because that shape (`{ coins }`, defaulting to 999_999) is defined in the vendored Engine
 * shared schema and cannot grow a ledger from this repository. `wallet.coins` is still mirrored
 * on write so existing balance UI keeps reading the number it already knows.
 */

/** Storage key for a viewer's wallet. Mirrors the `slurp.viewer.<id>.ads` key shape. */
export const slurpWalletKey = (viewerAccountId: string) => `slurp.viewer.${viewerAccountId}.wallet`;

export type SlurpEconomy = {
  /** Balance a brand-new wallet opens with. */
  startingCoins: number;
  /** Default price to unlock one locked post, when the post carries no price of its own. */
  unlockCost: number;
  /** Default weekly subscription price, when a creator sets none. */
  subscriptionCost: number;
  /** Length of one subscription period, in days. */
  subscriptionDays: number;
  /**
   * The daily stipend tops the balance *up to* this floor rather than adding to it. A spender
   * is never stranded, and a hoarder is never paid for hoarding, so there is nothing to farm.
   */
  stipendFloor: number;
  /** Paid once per acted-on ad, up to `adDailyCap` coins per day. */
  adReward: number;
  adDailyCap: number;
  /** Paid for a comment, post, or vote, up to `engagementDailyCap` coins per day. */
  engagementReward: number;
  engagementDailyCap: number;
  /** Share of a fan's payment that reaches your own creator's wallet, as a percentage. */
  creatorRevenueSharePercent: number;
};

/**
 * Tuned so a normal session pays for itself and a heavy one does not. The stipend alone
 * (60/day) covers 20 unlocks or 5 weekly subs, which is more than a session reads; earning
 * caps add at most 24/day on top. Nothing here compounds, so no amount of clicking outruns it.
 */
export const SLURP_DEFAULT_ECONOMY: SlurpEconomy = {
  startingCoins: 200,
  unlockCost: 3,
  subscriptionCost: 12,
  subscriptionDays: 7,
  stipendFloor: 60,
  adReward: 2,
  adDailyCap: 12,
  engagementReward: 1,
  engagementDailyCap: 12,
  creatorRevenueSharePercent: 100,
};

export type SlurpWalletEntryKind =
  "unlock" | "subscribe" | "renew" | "tip" | "topUp" | "stipend" | "ad" | "engagement" | "income";

/** One ledger line. `amount` is signed: negative spends, positive earns. */
export type SlurpWalletEntry = {
  kind: SlurpWalletEntryKind;
  amount: number;
  at: string;
  /** Free text for the wallet page, such as a creator handle or a post title. */
  note?: string;
};

export type SlurpWalletSubscription = {
  /** Instant the current paid period ends. Renewal is attempted on the first read after it. */
  paidThroughAt: string;
  /** Price locked in at subscribe time, so a creator's price change never surprises a renewal. */
  price: number;
};

export type SlurpWallet = {
  coins: number;
  /** Newest first, capped at `LEDGER_LIMIT`. It is an activity feed, not an audit log. */
  ledger: SlurpWalletEntry[];
  /** UTC day the `earnedToday` counters belong to. A different day resets them. */
  earnedOn: string;
  earnedToday: { ad: number; engagement: number };
  /** Last day a stipend was paid, so it pays once per day without a timer. */
  stipendOn: string | null;
  subscriptions: Record<string, SlurpWalletSubscription>;
};

/** Kept short: the wallet page shows recent activity, and the blob is rewritten on every write. */
const LEDGER_LIMIT = 60;

const dayKey = (at: Date) => at.toISOString().slice(0, 10);

const intOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;

export function emptySlurpWallet(economy: SlurpEconomy = SLURP_DEFAULT_ECONOMY): SlurpWallet {
  return {
    coins: economy.startingCoins,
    ledger: [],
    earnedOn: dayKey(new Date(0)),
    earnedToday: { ad: 0, engagement: 0 },
    stipendOn: null,
    subscriptions: {},
  };
}

/**
 * Read stored JSON back into a wallet. Hand-edited or imported state can carry anything, so every
 * field falls back rather than throwing — a corrupt blob costs the ledger, never the session.
 */
export function readSlurpWallet(raw: string | null, economy: SlurpEconomy = SLURP_DEFAULT_ECONOMY): SlurpWallet {
  const empty = emptySlurpWallet(economy);
  let value: Record<string, unknown>;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return empty;
    value = parsed as Record<string, unknown>;
  } catch {
    return empty;
  }
  const earned = (value.earnedToday ?? {}) as Record<string, unknown>;
  const coins = intOrNull(value.coins);
  return {
    coins: coins !== null && coins >= 0 ? coins : empty.coins,
    ledger: Array.isArray(value.ledger) ? (value.ledger as SlurpWalletEntry[]).slice(0, LEDGER_LIMIT) : [],
    earnedOn: typeof value.earnedOn === "string" ? value.earnedOn : empty.earnedOn,
    earnedToday: {
      ad: Math.max(0, intOrNull(earned.ad) ?? 0),
      engagement: Math.max(0, intOrNull(earned.engagement) ?? 0),
    },
    stipendOn: typeof value.stipendOn === "string" ? value.stipendOn : null,
    subscriptions: readSubscriptions(value.subscriptions),
  };
}

function readSubscriptions(value: unknown): Record<string, SlurpWalletSubscription> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, SlurpWalletSubscription> = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const price = intOrNull(entry.price);
    if (typeof entry.paidThroughAt !== "string" || price === null || price < 0) continue;
    out[id] = { paidThroughAt: entry.paidThroughAt, price };
  }
  return out;
}

function record(wallet: SlurpWallet, entry: SlurpWalletEntry): SlurpWallet {
  return { ...wallet, ledger: [entry, ...wallet.ledger].slice(0, LEDGER_LIMIT) };
}

/**
 * Pay the daily stipend if it is owed. It tops up *to* the floor, so it pays nothing to a wallet
 * that is already comfortable. Call it on wallet read: no scheduler is needed, and a viewer who
 * was away for a month gets one stipend, not thirty.
 */
export function applyStipend(
  wallet: SlurpWallet,
  at: Date,
  economy: SlurpEconomy = SLURP_DEFAULT_ECONOMY,
): SlurpWallet {
  const today = dayKey(at);
  if (wallet.stipendOn === today) return wallet;
  const owed = economy.stipendFloor - wallet.coins;
  const paid = { ...wallet, stipendOn: today };
  if (owed <= 0) return paid;
  return record({ ...paid, coins: wallet.coins + owed }, { kind: "stipend", amount: owed, at: at.toISOString() });
}

/** Reset the daily earning counters when the UTC day rolls over. */
function rollDay(wallet: SlurpWallet, at: Date): SlurpWallet {
  const today = dayKey(at);
  if (wallet.earnedOn === today) return wallet;
  return { ...wallet, earnedOn: today, earnedToday: { ad: 0, engagement: 0 } };
}

/**
 * Credit capped earnings. The amount is clipped to whatever the daily cap still allows, so a
 * caller never has to check the cap itself and a capped-out day quietly pays zero.
 */
export function earn(
  wallet: SlurpWallet,
  kind: "ad" | "engagement",
  at: Date,
  note?: string,
  economy: SlurpEconomy = SLURP_DEFAULT_ECONOMY,
): SlurpWallet {
  const rolled = rollDay(wallet, at);
  const cap = kind === "ad" ? economy.adDailyCap : economy.engagementDailyCap;
  const reward = kind === "ad" ? economy.adReward : economy.engagementReward;
  const amount = Math.max(0, Math.min(reward, cap - rolled.earnedToday[kind]));
  if (amount === 0) return rolled;
  return record(
    {
      ...rolled,
      coins: rolled.coins + amount,
      earnedToday: { ...rolled.earnedToday, [kind]: rolled.earnedToday[kind] + amount },
    },
    { kind, amount, at: at.toISOString(), ...(note && { note }) },
  );
}

/** Credit an uncapped amount: a top-up, or income a viewer's own creator was paid. */
export function credit(
  wallet: SlurpWallet,
  kind: "topUp" | "income",
  amount: number,
  at: Date,
  note?: string,
): SlurpWallet {
  if (!Number.isInteger(amount) || amount <= 0) return wallet;
  return record(
    { ...wallet, coins: wallet.coins + amount },
    { kind, amount, at: at.toISOString(), ...(note && { note }) },
  );
}

/**
 * Debit the wallet, or return `null` when the funds are not there. `null` is the caller's signal
 * to refuse the unlock or the subscription — it is the whole point of a real balance, and it is
 * why every caller must handle it rather than assuming success.
 */
export function spend(
  wallet: SlurpWallet,
  kind: "unlock" | "subscribe" | "renew" | "tip",
  amount: number,
  at: Date,
  note?: string,
): SlurpWallet | null {
  if (!Number.isInteger(amount) || amount < 0) return null;
  if (wallet.coins < amount) return null;
  return record(
    { ...wallet, coins: wallet.coins - amount },
    { kind, amount: -amount, at: at.toISOString(), ...(note && { note }) },
  );
}

/** Instant one paid subscription period ends, counted from `at`. */
export function subscriptionPaidThrough(at: Date, economy: SlurpEconomy = SLURP_DEFAULT_ECONOMY): string {
  return new Date(at.getTime() + economy.subscriptionDays * 86_400_000).toISOString();
}

export type SlurpRenewalResult = {
  wallet: SlurpWallet;
  /** Creators whose period was extended, and what each was charged. */
  renewed: { creatorAccountId: string; price: number }[];
  /** Creators the viewer could not pay for. The caller must unsubscribe these. */
  lapsed: string[];
};

/**
 * Charge every subscription whose period has ended. Run on read rather than on a timer: a
 * subscription that nobody looked at did not need to bill, and there is no cron to keep alive.
 *
 * ponytail: a viewer away for a month is charged one period, not four. Bill every missed period
 * only if back-billing ever turns out to matter.
 */
export function renewSubscriptions(wallet: SlurpWallet, at: Date): SlurpRenewalResult {
  let next = wallet;
  const renewed: { creatorAccountId: string; price: number }[] = [];
  const lapsed: string[] = [];
  for (const [creatorAccountId, subscription] of Object.entries(wallet.subscriptions)) {
    if (Date.parse(subscription.paidThroughAt) > at.getTime()) continue;
    const charged = spend(next, "renew", subscription.price, at, creatorAccountId);
    if (!charged) {
      lapsed.push(creatorAccountId);
      const remaining = { ...next.subscriptions };
      delete remaining[creatorAccountId];
      next = { ...next, subscriptions: remaining };
      continue;
    }
    renewed.push({ creatorAccountId, price: subscription.price });
    next = {
      ...charged,
      subscriptions: {
        ...charged.subscriptions,
        [creatorAccountId]: { ...subscription, paidThroughAt: subscriptionPaidThrough(at) },
      },
    };
  }
  return { wallet: next, renewed, lapsed };
}
