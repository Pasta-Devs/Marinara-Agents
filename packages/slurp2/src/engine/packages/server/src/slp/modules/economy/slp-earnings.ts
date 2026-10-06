/**
 * What a Creator has earned. Separate from what the player can spend.
 *
 * Pure by design, like `slurp-wallet.ts` beside it: nothing here touches the DB, so the rules are
 * unit-testable without an Engine checkout.
 *
 * ## Why this is not the wallet
 *
 * Income used to land in the operating persona's own spending wallet:
 *
 *     recipientId = creator.sourceKind === "persona" ? creator.sourceEntityId : creator.id
 *
 * The two balances want opposite properties. Spending money must be **scarce**, or choosing what
 * to unlock means nothing — the daily refill is 15 coins and an unlock costs 3. Earnings must be
 * **large and growing**, or running a Creator never feels like it worked. One number cannot do both.
 *
 * So they are two layers (0.3.7). Earnings are platform money, shown as dollars: one real paying fan
 * stands for `crowdWeight` people on the platform (the same weight the shown subscriber count uses),
 * and Slurp keeps its fee. The wallet is coins. A payout converts at `crowdWeight` dollars per coin,
 * so a real fan's payment is worth what it always was in coins, less the fee.
 *
 * So earnings are keyed by **creator account**, not by persona. That is also the only correct
 * answer for a character-backed Creator, which has no operating persona to credit at all.
 *
 * `coins` is the balance a payout may later move into spending money. `lifetime` only ever rises;
 * it is the score, and a payout must not reduce it.
 *
 * Existing installs keep whatever income already reached their persona wallets. Nothing is
 * migrated, because that money is already spent or already counted.
 */
import { slurpDayKey } from "./slp-wallet.js";

export type SlurpEarningsEntryKind =
  | "unlock"
  | "subscribe"
  | "renew"
  | "tip"
  | "messageRequest"
  | "ppv"
  | "commission"
  /** A brand paid for a sponsored post. See `slp-brand-deals.ts`. */
  | "sponsor"
  /** Moved out to spending money. Negative, and it must not touch `lifetime`. */
  | "payout"
  /** A failed charge being undone. Negative. */
  | "reversal";

export type SlurpEarningsEntry = {
  id?: string;
  kind: SlurpEarningsEntryKind;
  /** Signed: positive earns, negative payouts and reversals. */
  amount: number;
  at: string;
  /** Free text for the Creator home, such as a fan handle or a post title. */
  note?: string;
};

/** Durable idempotency evidence, separate from the capped activity feed. */
export type SlurpEarningsReceipt = Pick<SlurpEarningsEntry, "kind" | "amount">;

export type SlurpEarnings = {
  /** Balance available to a future payout. */
  coins: number;
  /** Total ever earned. Never falls. This is the number the Creator home shows as the score. */
  lifetime: number;
  /** Newest first, capped. An activity list, not an audit log. */
  ledger: SlurpEarningsEntry[];
  /** Operation receipts are not display history and therefore are never truncated with the ledger. */
  receipts: Record<string, SlurpEarningsReceipt>;
  /** UTC day `paidOutToday` belongs to. A different day resets it. */
  payoutOn: string | null;
  /** Coins already withdrawn today, against the daily allowance (coins, so a weight change keeps the cap). */
  paidOutToday: number;
  /** Stored in platform dollars (0.3.7). A record without it holds the older coin amounts. */
  platform?: true;
};

/** Slurp's cut of every fan payment, in percent, like the real platform's 20%. */
export const SLURP_PLATFORM_FEE_PERCENT = 20;

/**
 * The crowd weight older records were converted at: a balance held in coins before 0.3.7 becomes
 * dollars at the default weight, so it pays out the same coins it would have.
 */
export const SLURP_EARNINGS_LEGACY_SCALE = 5;

/** A real fan payment as platform earnings: the crowd it stands for, less Slurp's fee. */
export const slurpPlatformEarnings = (amount: number, crowdWeight: number): number =>
  Math.floor((amount * crowdWeight * (100 - SLURP_PLATFORM_FEE_PERCENT)) / 100);

/**
 * The daily withdrawal ceiling.
 *
 * This is what protects the whole point of separating the two balances. Earnings are meant to be
 * large; spending money is meant to be scarce, because a purchase you can always afford is not a
 * choice. If a successful Creator could move their entire balance across, the fan economy would
 * end the moment the first audience arrived.
 *
 * Counted in coins and shared by every Creator one persona runs, so a second page does not double
 * it. The floor is the daily refill (15), so withdrawing is never worse than not bothering; the
 * ceiling is four times that. A big Creator about doubles what a fan earns in a week, rather than
 * escaping the economy (a viewer earns at most about 270 coins a week).
 */
const PAYOUT_FLOOR_COINS = 15;
const PAYOUT_CEILING_COINS = 60;

/** Lifetime earnings (dollars) at which the allowance reaches its ceiling. */
const PAYOUT_REFERENCE = 80_000;

/** Coins a payout of this many dollars brings. */
export const slurpPayoutCoins = (dollars: number, crowdWeight: number): number =>
  Math.floor(Math.max(0, dollars) / Math.max(1, crowdWeight));

/**
 * How many dollars this Creator may still withdraw today: always whole coins' worth.
 *
 * Grows on a square-root curve, so early success is felt immediately and later success keeps
 * mattering without ever running away. `othersToday` is what the persona's other Creators already
 * withdrew today, in coins. `dailyLimit` false (Settings › Fans & money, R5) lets every whole coin
 * of the balance through.
 */
export function slurpPayoutAllowance(
  earnings: SlurpEarnings,
  at: Date,
  crowdWeight: number,
  othersToday = 0,
  dailyLimit = true,
): number {
  const weight = Math.max(1, crowdWeight);
  if (!dailyLimit) return slurpPayoutCoins(earnings.coins, weight) * weight;
  const lifetime = Number.isFinite(earnings.lifetime) ? Math.max(0, earnings.lifetime) : 0;
  const scale = Math.min(1, Math.sqrt(lifetime / PAYOUT_REFERENCE));
  const dailyCoins = Math.round(PAYOUT_FLOOR_COINS + (PAYOUT_CEILING_COINS - PAYOUT_FLOOR_COINS) * scale);
  const leftCoins = dailyCoins - slurpPaidOutToday(earnings, at) - Math.max(0, othersToday);
  return Math.max(0, Math.min(leftCoins, slurpPayoutCoins(earnings.coins, weight))) * weight;
}

/** Coins this Creator already withdrew today. */
export const slurpPaidOutToday = (earnings: SlurpEarnings, at: Date): number =>
  earnings.payoutOn === dayKey(at) ? Math.max(0, earnings.paidOutToday) : 0;

// The Slurp day, like the wallet's refill (starts 08:00 host time), not the UTC day (R1-087).
// ponytail: the default start hour; pass walletDayStartHour through if players move it.
const dayKey = (at: Date) => slurpDayKey(at);

const LEDGER_LIMIT = 60;

const EARNINGS_ENTRY_KINDS = new Set<SlurpEarningsEntryKind>([
  "unlock",
  "subscribe",
  "renew",
  "tip",
  "messageRequest",
  "ppv",
  "commission",
  "sponsor",
  "payout",
  "reversal",
]);

/** Storage key for one Creator's earnings. Mirrors the `slurp2.viewer.<id>.wallet` key shape. */
export const slurpEarningsKey = (creatorAccountId: string) => `slurp2.creator.${creatorAccountId}.earnings`;

/** Apply the configured share rule to a charge, including its required floor. */
export const slurpCreatorRevenueShare = (price: number, percent: number): number =>
  Math.max(0, Math.floor((price * percent) / 100));

const intOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;

export function emptySlurpEarnings(): SlurpEarnings {
  return { coins: 0, lifetime: 0, ledger: [], receipts: {}, payoutOn: null, paidOutToday: 0, platform: true };
}

/**
 * Keep only the ledger lines the Creator home can render.
 *
 * The wallet shipped with its ledger cast straight from JSON, so a hand-edited or imported blob
 * put entries with a missing kind or no timestamp in front of a UI that reads both
 * unconditionally. Same validation here, for the same reason.
 */
function readLedger(value: unknown): SlurpEarningsEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: SlurpEarningsEntry[] = [];
  for (const raw of value) {
    if (entries.length >= LEDGER_LIMIT) break;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const entry = raw as Record<string, unknown>;
    const amount = intOrNull(entry.amount);
    if (!EARNINGS_ENTRY_KINDS.has(entry.kind as SlurpEarningsEntryKind)) continue;
    if (amount === null || typeof entry.at !== "string" || Number.isNaN(Date.parse(entry.at))) continue;
    entries.push({
      ...(typeof entry.id === "string" ? { id: entry.id } : {}),
      kind: entry.kind as SlurpEarningsEntryKind,
      amount,
      at: entry.at,
      ...(typeof entry.note === "string" ? { note: entry.note } : {}),
    });
  }
  return entries;
}

/** Read stored JSON back into earnings. Every field falls back rather than throwing. */
export function readSlurpEarnings(raw: string | null): SlurpEarnings {
  const empty = emptySlurpEarnings();
  let value: Record<string, unknown>;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return empty;
    value = parsed as Record<string, unknown>;
  } catch {
    return empty;
  }
  const coins = intOrNull(value.coins);
  const lifetime = intOrNull(value.lifetime);
  const ledger = readLedger(value.ledger);
  const paidOutToday = intOrNull(value.paidOutToday);
  const earnings: SlurpEarnings = {
    payoutOn: typeof value.payoutOn === "string" ? value.payoutOn : null,
    paidOutToday: paidOutToday !== null && paidOutToday >= 0 ? paidOutToday : 0,
    coins: coins !== null && coins >= 0 ? coins : 0,
    // Lifetime can never be below the current balance: every coin held was earned at some point.
    lifetime: Math.max(lifetime !== null && lifetime >= 0 ? lifetime : 0, coins !== null && coins >= 0 ? coins : 0),
    ledger,
    receipts: readReceipts(value.receipts, ledger),
    platform: true,
  };
  return value.platform === true ? earnings : scaleLegacyEarnings(earnings);
}

/** A pre-0.3.7 record, in coins, as platform dollars. Receipts too, so a later reversal matches its credit. */
function scaleLegacyEarnings(earnings: SlurpEarnings): SlurpEarnings {
  const x = (amount: number) => amount * SLURP_EARNINGS_LEGACY_SCALE;
  return {
    ...earnings,
    coins: x(earnings.coins),
    lifetime: x(earnings.lifetime),
    ledger: earnings.ledger.map((entry) => ({ ...entry, amount: x(entry.amount) })),
    receipts: Object.fromEntries(
      Object.entries(earnings.receipts).map(([id, receipt]) => [id, { ...receipt, amount: x(receipt.amount) }]),
    ),
  };
}

function readReceipts(value: unknown, legacyLedger: SlurpEarningsEntry[]): Record<string, SlurpEarningsReceipt> {
  const receipts: Record<string, SlurpEarningsReceipt> = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const receipt = raw as Record<string, unknown>;
      const amount = intOrNull(receipt.amount);
      if (amount === null || !EARNINGS_ENTRY_KINDS.has(receipt.kind as SlurpEarningsEntryKind)) continue;
      receipts[id] = { kind: receipt.kind as SlurpEarningsEntryKind, amount };
    }
  }
  for (const entry of legacyLedger) {
    if (entry.id && !receipts[entry.id]) receipts[entry.id] = { kind: entry.kind, amount: entry.amount };
  }
  return receipts;
}

function record(earnings: SlurpEarnings, entry: SlurpEarningsEntry): SlurpEarnings {
  return {
    ...earnings,
    ledger: [entry, ...earnings.ledger].slice(0, LEDGER_LIMIT),
    receipts: entry.id
      ? { ...earnings.receipts, [entry.id]: { kind: entry.kind, amount: entry.amount } }
      : earnings.receipts,
  };
}

/** Credit income. Raises both the balance and the lifetime score. */
export function earn(
  earnings: SlurpEarnings,
  kind: Exclude<SlurpEarningsEntryKind, "payout" | "reversal">,
  amount: number,
  at: Date,
  note?: string,
  id?: string,
): SlurpEarnings {
  if (id && earnings.receipts[id]) return earnings;
  if (!Number.isInteger(amount) || amount <= 0) return earnings;
  return record(
    { ...earnings, coins: earnings.coins + amount, lifetime: earnings.lifetime + amount },
    { id, kind, amount, at: at.toISOString(), ...(note && { note }) },
  );
}

/**
 * Undo a credit whose charge failed.
 *
 * Lifetime falls here, unlike a payout, because the money was never really earned. It is floored
 * at zero so a reversal larger than the recorded history cannot drive the score negative.
 */
export function reverse(earnings: SlurpEarnings, amount: number, at: Date, note?: string, id?: string): SlurpEarnings {
  if (id && earnings.receipts[id]) return earnings;
  if (!Number.isInteger(amount) || amount <= 0 || earnings.coins < amount) return earnings;
  return record(
    {
      ...earnings,
      coins: earnings.coins - amount,
      lifetime: Math.max(0, earnings.lifetime - amount),
    },
    { id, kind: "reversal", amount: -amount, at: at.toISOString(), ...(note && { note }) },
  );
}

/**
 * Move earnings out to spending money.
 *
 * Returns `null` when the balance cannot cover it, so the caller must handle refusal rather than
 * assume success. `lifetime` is deliberately untouched: withdrawing what you earned does not mean
 * you earned less. `amount` is in dollars and must be whole coins' worth (a multiple of the weight).
 */
export function payout(
  earnings: SlurpEarnings,
  amount: number,
  at: Date,
  crowdWeight: number,
  othersToday = 0,
  dailyLimit = true,
): SlurpEarnings | null {
  const weight = Math.max(1, crowdWeight);
  if (!Number.isInteger(amount) || amount <= 0 || amount % weight !== 0 || earnings.coins < amount) return null;
  // Refused rather than clamped. A caller that asked for more than the day allows has misread the
  // state, and silently paying out less would leave the player believing they moved more.
  if (amount > slurpPayoutAllowance(earnings, at, weight, othersToday, dailyLimit)) return null;
  return record(
    {
      ...earnings,
      coins: earnings.coins - amount,
      payoutOn: dayKey(at),
      paidOutToday: slurpPaidOutToday(earnings, at) + amount / weight,
    },
    { kind: "payout", amount: -amount, at: at.toISOString() },
  );
}
