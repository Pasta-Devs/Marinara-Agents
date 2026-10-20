/**
 * What happened to one Creator's latest posts, for the trend detector: likes, replies, the player's own
 * likes, unlocks and tips. Read-only. A failed read means no trend from this Creator, never a failed tick.
 */
import type { DB } from "../../../db/connection.js";
import { inArray } from "../../../db/file-query.js";
import { slpPostUnlocks } from "../../../db/schema/slurp.js";
import { logger } from "../../../lib/logger.js";
import { SLURP_TREND_ORIGIN_DAYS, type SlurpTrendPost } from "../../modules/discovery/slp-trends.js";
import { slurpPostLikeCount } from "../../../../../shared/src/slp/slp-reach.js";
import { createSlurpStorage } from "../slp-storage.js";

const POSTS = 10;

export async function readSlurpTrendPosts(
  db: DB,
  accountId: string,
  playerIds: ReadonlySet<string>,
  at: Date,
  /** The Creator's reach (`slurpCreatorReach`): the silent crowd on a post scales with it. */
  creatorReach: number,
): Promise<SlurpTrendPost[]> {
  try {
    const storage = createSlurpStorage(db);
    const posts = (await storage.listNoodlerPostsByAccount(accountId, POSTS)).filter((post) => post.access !== "draft");
    // Nothing public in the last days: no trend from here, and no interactions to read.
    const recent = (post: (typeof posts)[number]) =>
      post.access === "public" && at.getTime() - Date.parse(post.createdAt) <= SLURP_TREND_ORIGIN_DAYS * 86_400_000;
    if (!posts.some(recent)) return [];
    const ids = posts.map((post) => post.id);
    const [interactions, unlocks, earnings] = await Promise.all([
      storage.listNoodlerInteractions(ids),
      db.select().from(slpPostUnlocks).where(inArray(slpPostUnlocks.postId, ids)),
      storage.getEarnings(accountId),
    ]);
    const tipTimes = earnings.ledger.filter((entry) => entry.kind === "tip").map((entry) => Date.parse(entry.at));
    return posts.map((post, index) => {
      // A tip is not tied to a post: it counts for the post that was newest when it came in.
      const from = Date.parse(post.createdAt);
      const until = index > 0 ? Date.parse(posts[index - 1]!.createdAt) : Number.POSITIVE_INFINITY;
      const mine = interactions.filter((entry) => entry.postId === post.id);
      // Post likes only; a heart on a comment is not a like of the post, as the viewer counts it.
      const likes = mine.filter((entry) => entry.type === "like" && !entry.parentInteractionId);
      const spice = (post.metadata as Record<string, unknown> | null | undefined)?.slurpSpice;
      return {
        id: post.id,
        createdAt: post.createdAt,
        access: post.access,
        title: post.title,
        // What the post shows: real likes plus the silent crowd, so a trend starts from what a
        // player sees (a viral week included), not only from the rows.
        likes: slurpPostLikeCount(
          { postId: post.id, createdAt: post.createdAt, creatorReach, realLikes: likes.length, accountId },
          at,
        ),
        replies: mine.filter((entry) => entry.type === "reply" && entry.actorAccountId !== accountId).length,
        playerLikes: likes.filter((entry) => entry.actorAccountId !== accountId && playerIds.has(entry.actorAccountId))
          .length,
        unlocks: unlocks.filter((row) => String((row as { postId: string }).postId) === post.id).length,
        tips: tipTimes.filter((time) => time >= from && time < until).length,
        spicy: Boolean(spice && typeof spice === "object"),
      };
    });
  } catch (error) {
    logger.warn(error, "[slurp] Could not read a Creator's posts for trends");
    return [];
  }
}
