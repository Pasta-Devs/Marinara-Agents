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
 * to unlock means nothing — the daily stipend floor is 60 coins and an unlock costs 3. Earnings
 * must be **large and growing**, or running a Creator never feels like it worked. One number
 * cannot do both. With a real audience the point becomes sharp: a few hundred subscribers at 12
 * coins a week would end every spending decision in the game.
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

export type SlurpEarningsEntryKind =
  | "unlock"
  | "subscribe"
  | "renew"
  | "tip"
  | "messageRequest"
  | "ppv"
  | "commission"
  /** Moved out to spending money. Negative, and it must not touch `lifetime`. */
  | "payout"
  /** A failed charge being undone. Negative. */
  | "reversal";

export type SlurpEarningsEntry = {
  kind: SlurpEarningsEntryKind;
  /** Signed: positive earns, negative payouts and reversals. */
  amount: number;
  at: string;
  /** Free text for the Creator home, such as a fan handle or a post title. */
  note?: string;
};

export type SlurpEarnings = {
  /** Balance available to a future payout. */
  coins: number;
  /** Total ever earned. Never falls. This is the number the Creator home shows as the score. */
  lifetime: number;
  /** Newest first, capped. An activity list, not an audit log. */
  ledger: SlurpEarningsEntry[];
  /** UTC day `paidOutToday` belongs to. A different day resets it. */
  payoutOn: string | null;
  /** Coins already withdrawn today, against the daily allowance. */
  paidOutToday: number;
};

/**
 * The daily withdrawal ceiling.
 *
 * This is what protects the whole point of separating the two balances. Earnings are meant to be
 * large; spending money is meant to be scarce, because a purchase you can always afford is not a
 * choice. If a successful Creator could move their entire balance across, the fan economy would
 * end the moment the first audience arrived.
 *
 * The floor sits at the daily stipend, so withdrawing is never worse than not bothering, and the
 * ceiling is a few multiples of it. A big Creator meaningfully improves their spending power —
 * roughly four times — rather than escaping the economy.
 */
const PAYOUT_FLOOR = 60;
const PAYOUT_CEILING = 260;

/** Lifetime earnings at which the allowance reaches its ceiling. */
const PAYOUT_REFERENCE = 20_000;

/**
 * How much this Creator may still withdraw today.
 *
 * Grows on a square-root curve, so early success is felt immediately and later success keeps
 * mattering without ever running away.
 */
export function slurpPayoutAllowance(earnings: SlurpEarnings, at: Date): number {
  const lifetime = Number.isFinite(earnings.lifetime) ? Math.max(0, earnings.lifetime) : 0;
  const scale = Math.min(1, Math.sqrt(lifetime / PAYOUT_REFERENCE));
  const daily = Math.round(PAYOUT_FLOOR + (PAYOUT_CEILING - PAYOUT_FLOOR) * scale);
  const takenToday = earnings.payoutOn === dayKey(at) ? Math.max(0, earnings.paidOutToday) : 0;
  return Math.max(0, Math.min(daily - takenToday, earnings.coins));
}

const dayKey = (at: Date) => at.toISOString().slice(0, 10);

const LEDGER_LIMIT = 60;

const EARNINGS_ENTRY_KINDS = new Set<SlurpEarningsEntryKind>([
  "unlock",
  "subscribe",
  "renew",
  "tip",
  "messageRequest",
  "ppv",
  "commission",
  "payout",
  "reversal",
]);

/** Storage key for one Creator's earnings. Mirrors the `slurp.viewer.<id>.wallet` key shape. */
export const slurpEarningsKey = (creatorAccountId: string) => `slurp.creator.${creatorAccountId}.earnings`;

const intOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;

export function emptySlurpEarnings(): SlurpEarnings {
  return { coins: 0, lifetime: 0, ledger: [], payoutOn: null, paidOutToday: 0 };
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
  return {
    payoutOn: typeof value.payoutOn === "string" ? value.payoutOn : null,
    paidOutToday: paidOutToday !== null && paidOutToday >= 0 ? paidOutToday : 0,
    coins: coins !== null && coins >= 0 ? coins : 0,
    // Lifetime can never be below the current balance: every coin held was earned at some point.
    lifetime: Math.max(lifetime !== null && lifetime >= 0 ? lifetime : 0, coins !== null && coins >= 0 ? coins : 0),
    ledger,
  };
}

function record(earnings: SlurpEarnings, entry: SlurpEarningsEntry): SlurpEarnings {
  return { ...earnings, ledger: [entry, ...earnings.ledger].slice(0, LEDGER_LIMIT) };
}

/** Credit income. Raises both the balance and the lifetime score. */
export function earn(
  earnings: SlurpEarnings,
  kind: Exclude<SlurpEarningsEntryKind, "payout" | "reversal">,
  amount: number,
  at: Date,
  note?: string,
): SlurpEarnings {
  if (!Number.isInteger(amount) || amount <= 0) return earnings;
  return record(
    { ...earnings, coins: earnings.coins + amount, lifetime: earnings.lifetime + amount },
    { kind, amount, at: at.toISOString(), ...(note && { note }) },
  );
}

/**
 * Undo a credit whose charge failed.
 *
 * Lifetime falls here, unlike a payout, because the money was never really earned. It is floored
 * at zero so a reversal larger than the recorded history cannot drive the score negative.
 */
export function reverse(earnings: SlurpEarnings, amount: number, at: Date, note?: string): SlurpEarnings {
  if (!Number.isInteger(amount) || amount <= 0 || earnings.coins < amount) return earnings;
  return record(
    {
      ...earnings,
      coins: earnings.coins - amount,
      lifetime: Math.max(0, earnings.lifetime - amount),
    },
    { kind: "reversal", amount: -amount, at: at.toISOString(), ...(note && { note }) },
  );
}

/**
 * Move earnings out to spending money.
 *
 * Returns `null` when the balance cannot cover it, so the caller must handle refusal rather than
 * assume success. `lifetime` is deliberately untouched: withdrawing what you earned does not mean
 * you earned less.
 *

 */
export function payout(earnings: SlurpEarnings, amount: number, at: Date): SlurpEarnings | null {
  if (!Number.isInteger(amount) || amount <= 0 || earnings.coins < amount) return null;
  // Refused rather than clamped. A caller that asked for more than the day allows has misread the
  // state, and silently paying out less would leave the player believing they moved more.
  if (amount > slurpPayoutAllowance(earnings, at)) return null;
  const today = dayKey(at);
  const takenToday = earnings.payoutOn === today ? Math.max(0, earnings.paidOutToday) : 0;
  return record(
    { ...earnings, coins: earnings.coins - amount, payoutOn: today, paidOutToday: takenToday + amount },
    { kind: "payout", amount: -amount, at: at.toISOString() },
  );
}
