/**
 * Synthetic platform reach: the numbers that make Slurp read as a platform rather than a demo.
 *
 * Pure by design. Nothing here touches the DB, so the curves can be unit-tested without an Engine
 * checkout — the same reason `slurp-wallet.ts` and `slurp-prices.ts` stand alone.
 *
 * Slurp's real background cast is twelve accounts, so every count derived from real interaction
 * rows is tiny, and a creator with four followers cannot feel like a creator. Reach fills the gap
 * the cheapest way there is: a number costs nothing to generate and does most of the work of
 * feeling big. Only the handful of named, readable interactions still come from real rows.
 *
 * Two rules hold everything together:
 *
 * 1. **Deterministic.** Every value derives from stable inputs — an id, a creation time, a clock.
 *    The same post shows the same number on every read, in every session, forever. Nothing draws
 *    a random number at read time.
 * 2. **Stable under a fixed audience.** For a given `realFollowers`, growth depends on age through
 *    a saturating curve, and age only increases, so the synthetic part never falls between reads.
 *
 *    The total *can* fall, and that is deliberate. An earlier version of this module made
 *    monotonicity a rule, which was a design error stated as a principle: a number that cannot
 *    fall has no stakes, so raising it means nothing. What breaks the illusion is jitter — a value
 *    that differs between two reads of the same page — not decline the player earned by going
 *    quiet and losing subscribers. Real followers come from the funnel, and people leave it.
 *
 * Reach is presentation only. It never reaches the wallet, the ledger, a payout, or a subscriber
 * list. See `slurp-wallet.ts` for the numbers that must stay exact.
 */

import { SLURP_REALISTIC_TUNING, type SlurpSimulationTuning } from "./slurp-tuning.js";

/*
 * Creator reach numbers live in Simulation Tuning (`reach`): `floor` is the smallest audience a
 * creator is born with, `ceiling` the largest before real signal (log-spread), `growthDays` the
 * days to reach ~63% of it, and `realFollowerWeight` what one real follower counts for.
 */

/** Days for a post to collect roughly 63% of the impressions it will ever get. */
const POST_SETTLE_DAYS = 2.5;

const DAY_MS = 86_400_000;

/**
 * FNV-1a followed by a murmur3 finalizer. Not a security hash, and nothing here needs one.
 *
 * The finalizer is load-bearing, not decoration. Plain FNV-1a barely avalanches its last byte: two
 * ids differing only in the final character hash to almost the same value. Slurp mints ids
 * sequentially, so without the mix every post created in one batch drew nearly the same share and
 * a whole page of posts landed on the same like count — exactly the sameness this module exists to
 * remove.
 */
function hash(value: string): number {
  let out = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  out ^= out >>> 16;
  out = Math.imul(out, 0x85ebca6b);
  out ^= out >>> 13;
  out = Math.imul(out, 0xc2b2ae35);
  out ^= out >>> 16;
  return out >>> 0;
}

/** A stable number in [0, 1) for one id and one purpose. */
function unitFor(id: string, salt: string): number {
  return hash(`${salt}:${id}`) / 0x100000000;
}

/** Saturating growth in [0, 1). Monotonic in `days`, which is what keeps counts from ever falling. */
function settle(days: number, scale: number): number {
  if (days <= 0) return 0;
  return 1 - Math.exp(-days / scale);
}

function ageInDays(since: string, at: Date): number {
  const start = Date.parse(since);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, (at.getTime() - start) / DAY_MS);
}

/**
 * The algorithm: what the platform did with one Creator in one week.
 *
 * Growth used to be a smooth curve, and a smooth curve reads as a spreadsheet. Some weeks the
 * platform features a Creator, some weeks it buries them, and now and then a week goes viral. It
 * is keyed on the Creator and the calendar week, so it is as deterministic as everything else here:
 * the same week always had the same luck, on every read.
 */
export type SlurpReachWeek = "normal" | "featured" | "buried" | "viral";

const WEEK_MS = 7 * DAY_MS;
const weekIndex = (time: number) => Math.floor(time / WEEK_MS);

export function slurpReachWeek(accountId: string, at: Date | string): SlurpReachWeek {
  const time = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (!Number.isFinite(time)) return "normal";
  const roll = unitFor(`${accountId}:${weekIndex(time)}`, "algorithm");
  if (roll < 0.03) return "viral";
  if (roll < 0.12) return "featured";
  if (roll >= 0.9) return "buried";
  return "normal";
}

/** Whether this post is the one that blew up. Only a post from a viral week can be. */
export function slurpPostWentViral(input: { accountId: string; postId: string; createdAt: string }): boolean {
  return slurpReachWeek(input.accountId, input.createdAt) === "viral" && unitFor(input.postId, "viral") < 0.4;
}

/** How the week a post was made in changes its reach. */
function postReachMultiplier(input: { accountId?: string; postId: string; createdAt: string }): number {
  if (!input.accountId) return 1;
  switch (slurpReachWeek(input.accountId, input.createdAt)) {
    case "viral":
      return slurpPostWentViral({ ...input, accountId: input.accountId })
        ? 6 + unitFor(input.postId, "spike") * 6
        : 1.3;
    case "featured":
      return 1.6;
    case "buried":
      return 0.55;
    default:
      return 1;
  }
}

/**
 * The rush of new followers each viral week brought. Each rush settles over a couple of days from
 * the start of its week, so it arrives as a spike and then stays, like a real one.
 */
function viralFollowerRush(accountId: string, createdAt: string, ceiling: number, at: Date): number {
  const start = Date.parse(createdAt);
  if (!Number.isFinite(start)) return 0;
  let rush = 0;
  // ponytail: walks every week since creation; fine for years of history, cache if it ever is not.
  for (let week = weekIndex(start); week <= weekIndex(at.getTime()); week += 1) {
    const weekStart = week * WEEK_MS;
    if (slurpReachWeek(accountId, new Date(Math.max(weekStart, start))) !== "viral") continue;
    const size = 0.1 + unitFor(`${accountId}:${week}`, "rush") * 0.3;
    rush += ceiling * size * settle((at.getTime() - Math.max(weekStart, start)) / DAY_MS, 1.5);
  }
  return rush;
}

/**
 * How many followers a creator appears to have.
 *
 * The ceiling is log-spread across the id, so the roster gets a believable mix: a few large
 * accounts, many small ones, rather than everyone landing near the average. Real followers are
 * added on top at a heavy weight, so a creator the player actually builds an audience for
 * outgrows the synthetic floor instead of being drowned by it.
 */
export function slurpCreatorReach(
  input: {
    accountId: string;
    createdAt: string;
    realFollowers: number;
    /**
     * Platform scale. Multiplies the invented audience only — real followers are a count of things
     * that actually happened, and scaling them would be a lie rather than a setting.
     */
    scale?: number;
  },
  at: Date = new Date(),
  tuning: SlurpSimulationTuning["reach"] = SLURP_REALISTIC_TUNING.reach,
): number {
  const spread = unitFor(input.accountId, "reach");
  const scale = Number.isFinite(input.scale) && (input.scale ?? 1) > 0 ? input.scale! : 1;
  const floor = Math.max(1, tuning.floor);
  const ceiling = floor * Math.pow(Math.max(floor, tuning.ceiling) / floor, spread);
  const grown =
    ceiling * settle(ageInDays(input.createdAt, at), tuning.growthDays) +
    viralFollowerRush(input.accountId, input.createdAt, ceiling, at);
  return Math.round((floor + grown) * scale + Math.max(0, input.realFollowers) * tuning.realFollowerWeight);
}

/**
 * Impressions one post appears to have collected.
 *
 * Not every follower sees every post, and a post keeps picking up views for a couple of days
 * before it settles. The per-post share is stable, so an old post never loses reach.
 */
export function slurpPostImpressions(
  /** `accountId` lets the algorithm week apply. Without it the post gets its plain share. */
  input: { postId: string; createdAt: string; creatorReach: number; accountId?: string },
  at: Date = new Date(),
): number {
  // Between 18% and 70% of the audience: the spread is what stops every post looking identical.
  const share = 0.18 + unitFor(input.postId, "impressions") * 0.52;
  return Math.round(
    input.creatorReach * share * postReachMultiplier(input) * settle(ageInDays(input.createdAt, at), POST_SETTLE_DAYS),
  );
}

/**
 * Likes shown on a post: the real ones the player can open and read, plus the silent crowd.
 *
 * Real interactions are never replaced. A reader who expands the list sees exactly the named
 * accounts that acted; the synthetic remainder is the part nobody can click.
 */
export function slurpPostLikeCount(
  input: { postId: string; createdAt: string; creatorReach: number; realLikes: number; accountId?: string },
  at: Date = new Date(),
): number {
  // 4%–14% of impressions like a post. Anything higher reads as fake.
  const rate = 0.04 + unitFor(input.postId, "likes") * 0.1;
  return Math.max(0, input.realLikes) + Math.round(slurpPostImpressions(input, at) * rate);
}

/**
 * Replies shown on a post. Kept far below likes: a feed where every post has hundreds of comments
 * and six readable ones looks broken, not busy.
 */
export function slurpPostReplyCount(
  input: { postId: string; createdAt: string; creatorReach: number; realReplies: number; accountId?: string },
  at: Date = new Date(),
): number {
  const rate = 0.002 + unitFor(input.postId, "replies") * 0.006;
  return Math.max(0, input.realReplies) + Math.round(slurpPostImpressions(input, at) * rate);
}

/**
 * How many people appear to have paid to unlock a locked post.
 *
 * This is social proof on the paywall, and it is the number most likely to be disbelieved, so the
 * rate is deliberately low.
 */
export function slurpPostUnlockCount(
  input: { postId: string; createdAt: string; creatorReach: number; accountId?: string },
  at: Date = new Date(),
): number {
  const rate = 0.004 + unitFor(input.postId, "unlocks") * 0.012;
  return Math.round(slurpPostImpressions(input, at) * rate);
}
