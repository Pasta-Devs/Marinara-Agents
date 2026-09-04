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
 * 2. **Monotonic.** Growth depends on age through a saturating curve, and age only increases, so
 *    a count never goes down between reads. A follower number that dropped would break the
 *    illusion faster than a small one ever could.
 *
 * Reach is presentation only. It never reaches the wallet, the ledger, a payout, or a subscriber
 * list. See `slurp-wallet.ts` for the numbers that must stay exact.
 */

/** Smallest audience a creator can be born with. Below this a profile reads as abandoned. */
const MIN_BASE_REACH = 240;

/** Largest audience before real signal is added. Log-spread, so most creators sit well under it. */
const MAX_BASE_REACH = 34_000;

/** Days for a creator's audience to reach roughly 63% of its ceiling. */
const REACH_GROWTH_DAYS = 45;

/** Days for a post to collect roughly 63% of the impressions it will ever get. */
const POST_SETTLE_DAYS = 2.5;

/** A real follower counts for far more than a synthetic one: it is a person the player chose. */
const REAL_FOLLOWER_WEIGHT = 25;

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
 * How many followers a creator appears to have.
 *
 * The ceiling is log-spread across the id, so the roster gets a believable mix: a few large
 * accounts, many small ones, rather than everyone landing near the average. Real followers are
 * added on top at a heavy weight, so a creator the player actually builds an audience for
 * outgrows the synthetic floor instead of being drowned by it.
 */
export function slurpCreatorReach(
  input: { accountId: string; createdAt: string; realFollowers: number },
  at: Date = new Date(),
): number {
  const spread = unitFor(input.accountId, "reach");
  const ceiling = MIN_BASE_REACH * Math.pow(MAX_BASE_REACH / MIN_BASE_REACH, spread);
  const grown = ceiling * settle(ageInDays(input.createdAt, at), REACH_GROWTH_DAYS);
  return Math.round(MIN_BASE_REACH + grown + Math.max(0, input.realFollowers) * REAL_FOLLOWER_WEIGHT);
}

/**
 * Impressions one post appears to have collected.
 *
 * Not every follower sees every post, and a post keeps picking up views for a couple of days
 * before it settles. The per-post share is stable, so an old post never loses reach.
 */
export function slurpPostImpressions(
  input: { postId: string; createdAt: string; creatorReach: number },
  at: Date = new Date(),
): number {
  // Between 18% and 70% of the audience: the spread is what stops every post looking identical.
  const share = 0.18 + unitFor(input.postId, "impressions") * 0.52;
  return Math.round(input.creatorReach * share * settle(ageInDays(input.createdAt, at), POST_SETTLE_DAYS));
}

/**
 * Likes shown on a post: the real ones the player can open and read, plus the silent crowd.
 *
 * Real interactions are never replaced. A reader who expands the list sees exactly the named
 * accounts that acted; the synthetic remainder is the part nobody can click.
 */
export function slurpPostLikeCount(
  input: { postId: string; createdAt: string; creatorReach: number; realLikes: number },
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
  input: { postId: string; createdAt: string; creatorReach: number; realReplies: number },
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
  input: { postId: string; createdAt: string; creatorReach: number },
  at: Date = new Date(),
): number {
  const rate = 0.004 + unitFor(input.postId, "unlocks") * 0.012;
  return Math.round(slurpPostImpressions(input, at) * rate);
}
