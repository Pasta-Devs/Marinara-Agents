/**
 * How much one event is worth reading.
 *
 * Pure, like the other Slurp rule modules beside it.
 *
 * The maintainer set the volume at "a readable handful": ten to twenty notable events a day,
 * across every Creator, each one worth reading. A feed that cannot be cleared is a chore, so this
 * is a curation rule and not a log level. Weight decides three things: what surfaces at all, what
 * groups into a single line, and what order the rest appears in.
 *
 * Money is weighted above attention on purpose. A like is the cheapest thing a person can do; a
 * commission is somebody asking you to make something. Between two events the player has time to
 * read, the one that cost the other person more is the one worth showing.
 */

export type SlurpEventKind =
  /** Somebody started paying. */
  | "subscribed"
  /** A subscription lapsed or was cancelled. */
  | "lapsed"
  | "tip"
  | "unlock"
  | "ppv_unlock"
  | "commission_requested"
  | "commission_accepted"
  | "comment"
  | "message"
  /** A follower milestone was crossed. */
  | "milestone"
  /** Somebody's relationship with a Creator changed direction: rising, or burning out. */
  | "arc"
  /** Somebody who had drifted away came back. */
  | "returned";

/**
 * Base weights. The gaps matter more than the numbers: anything at or above `SLURP_EVENT_NOTABLE`
 * is worth a line of its own, and everything below is grouped or dropped.
 */
const BASE: Record<SlurpEventKind, number> = {
  commission_requested: 90,
  commission_accepted: 85,
  subscribed: 80,
  milestone: 75,
  message: 70,
  ppv_unlock: 55,
  lapsed: 50,
  tip: 45,
  unlock: 30,
  comment: 25,
  // A person changing direction outranks a routine reaction and sits below money. Somebody coming
  // back is the better story of the two, so it is weighted above a change of direction.
  returned: 65,
  arc: 48,
};

/**
 * Coins at which a payment starts to feel large. Below it a payment barely lifts its event; above
 * it the lift grows, but only logarithmically.
 */
const MONEY_REFERENCE = 10;

/** At or above this, an event earns its own line. Below it, group or hide. */
export const SLURP_EVENT_NOTABLE = 40;

/**
 * Weight one event.
 *
 * `amount` lifts the money kinds, because a 500-coin tip is not the same news as a 5-coin one, but
 * it lifts them on a log curve so one large payment cannot crowd out a whole day of everything
 * else. A tip can outrank a subscription; no tip can outrank every subscription.
 */
export function slurpEventWeight(kind: SlurpEventKind, amount = 0): number {
  const base = BASE[kind] ?? 0;
  // Math.max(0, NaN) is NaN, which would poison the sort key and the notable threshold. Weight is
  // read on every notification, so a single bad amount must not be able to break the whole feed.
  const value = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const moneyKind = kind === "tip" || kind === "ppv_unlock" || kind === "unlock" || kind === "commission_accepted";
  if (!moneyKind || value <= 0) return base;
  // Divided by the reference before the log, so ordinary payments barely move and only genuinely
  // large ones promote. A first attempt used log2(1 + coins) * 6, which gave a 3-coin unlock a
  // +12 boost and pushed every routine unlock over the notable line — the exact flood the
  // readable-handful rule exists to prevent.
  //
  // 3 coins adds ~3, 50 adds ~21, 500 adds ~45.
  return Math.round(base + Math.log2(1 + value / MONEY_REFERENCE) * 8);
}

export type SlurpEventLike = {
  id: string;
  kind: SlurpEventKind;
  amount: number;
  weight: number;
  createdAt: string;
};

export type SlurpEventGroup =
  | { type: "single"; event: SlurpEventLike }
  | { type: "group"; kind: SlurpEventKind; count: number; total: number; latestAt: string; ids: string[] };

/**
 * Collapse a list into what a person can actually read.
 *
 * Notable events keep their own line, newest first. Everything else is folded into one line per
 * kind — "14 people liked this" — so a busy day stays a handful of rows instead of a wall.
 *
 * Input is expected newest-first; the order of notable events is preserved rather than re-sorted,
 * because a feed that reorders itself by importance is hard to follow when you already read the top.
 */
export function groupSlurpEvents(events: readonly SlurpEventLike[]): SlurpEventGroup[] {
  const out: SlurpEventGroup[] = [];
  const grouped = new Map<SlurpEventKind, { count: number; total: number; latestAt: string; ids: string[] }>();
  for (const event of events) {
    if (event.weight >= SLURP_EVENT_NOTABLE) {
      out.push({ type: "single", event });
      continue;
    }
    const existing = grouped.get(event.kind);
    if (existing) {
      existing.count += 1;
      existing.total += Number.isFinite(event.amount) ? Math.max(0, event.amount) : 0;
      existing.ids.push(event.id);
      if (event.createdAt > existing.latestAt) existing.latestAt = event.createdAt;
    } else {
      grouped.set(event.kind, {
        count: 1,
        total: Number.isFinite(event.amount) ? Math.max(0, event.amount) : 0,
        latestAt: event.createdAt,
        ids: [event.id],
      });
    }
  }
  for (const [kind, value] of grouped) {
    out.push({ type: "group", kind, ...value });
  }
  return out;
}
