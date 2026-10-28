import type { DB } from "../../../db/connection.js";
import { and, desc, eq, inArray } from "../../../db/file-query.js";
import { slpInteractions, slpPosts } from "../../../db/schema/slurp.js";
import { readSlpPurpose, type SlpPurpose } from "../../../../../shared/src/slp/slp-post-purpose.js";
import { readSlpPollFromMetadata } from "../../../../../shared/src/slp/slp-polls.js";
import {
  slurpPurposeLinks,
  type SlurpPurposeComment,
  type SlurpPurposePost,
} from "../../modules/feed/slp-post-purpose.js";

/**
 * The read and write side of post purposes (3b): a Creator's recent posts and the comments on
 * them, poll votes, and the links a published drop or a taken-up poll leaves behind. Every write
 * touches only `metadata` and never `updatedAt`, which the picture URLs are cache-busted on.
 */

const parse = (value: unknown): Record<string, unknown> => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

export type SlurpPurposeRow = SlurpPurposePost & { metadata: Record<string, unknown> };

/** Their newest posts and Stories (at most 30), newest first. */
export async function listSlurpPurposePosts(db: DB, creatorAccountId: string): Promise<SlurpPurposeRow[]> {
  const rows = await db
    .select()
    .from(slpPosts)
    .where(eq(slpPosts.authorAccountId, creatorAccountId))
    .orderBy(desc(slpPosts.createdAt))
    .limit(30);
  return rows.map((row) => {
    const metadata = parse(row.metadata);
    return {
      id: String(row.id),
      title: row.title ? String(row.title) : null,
      content: String(row.content ?? ""),
      access: String(row.access ?? "public"),
      createdAt: String(row.createdAt),
      story: metadata.noodlerPostType === "story",
      purpose: readSlpPurpose(metadata),
      metadata,
    };
  });
}

/** Top-level comments by other people on these posts, newest first. */
export async function listSlurpPurposeComments(
  db: DB,
  creatorAccountId: string,
  postIds: readonly string[],
): Promise<SlurpPurposeComment[]> {
  if (!postIds.length) return [];
  const rows = await db
    .select()
    .from(slpInteractions)
    .where(and(inArray(slpInteractions.postId, [...postIds]), eq(slpInteractions.type, "reply")))
    .orderBy(desc(slpInteractions.createdAt));
  return rows
    .filter(
      (row) => !row.parentInteractionId && row.actorAccountId !== creatorAccountId && String(row.content ?? "").trim(),
    )
    .map((row) => ({
      postId: String(row.postId),
      handle: String(parse(row.actorSnapshot).handle ?? ""),
      text: String(row.content).trim().slice(0, 280),
      createdAt: String(row.createdAt),
    }));
}

/** Real votes per option of a post's poll, in option order. */
export async function listSlurpPollVotes(db: DB, post: SlurpPurposeRow): Promise<number[]> {
  const poll = readSlpPollFromMetadata(post.metadata);
  if (!poll) return [];
  const counts = poll.options.map(() => 0);
  const rows = await db
    .select()
    .from(slpInteractions)
    .where(and(eq(slpInteractions.postId, post.id), eq(slpInteractions.type, "vote")));
  for (const row of rows) {
    const index = poll.options.findIndex((option) => option.id === row.content);
    if (index >= 0) counts[index]! += 1;
  }
  return counts;
}

async function writePurpose(db: DB, post: SlurpPurposeRow, purpose: SlpPurpose, extra: Record<string, unknown> = {}) {
  await db
    .update(slpPosts)
    .set({ metadata: JSON.stringify({ ...post.metadata, ...extra, slurpPurpose: purpose }) })
    .where(eq(slpPosts.id, post.id));
}

/** A later post took up this poll's answer: it is answered once. */
export async function markSlurpPollAnswered(db: DB, post: SlurpPurposeRow, at: Date): Promise<void> {
  if (post.purpose?.kind !== "poll") return;
  await writePurpose(db, post, { ...post.purpose, answeredAt: at.toISOString() });
}

/** A post that closes a loop went up: write the links it closes (`slurpPurposeLinks`). */
export async function linkSlurpPurposePost(
  db: DB,
  post: { id: string; authorAccountId: string; metadata: Record<string, unknown> },
): Promise<void> {
  const purpose = readSlpPurpose(post.metadata);
  if (!purpose?.campaignId) return;
  const posts = await listSlurpPurposePosts(db, post.authorAccountId);
  const byId = new Map(posts.map((entry) => [entry.id, entry]));
  const links = slurpPurposeLinks({ id: post.id, purpose, story: post.metadata.noodlerPostType === "story" }, posts);
  for (const link of links) {
    const entry = byId.get(link.postId);
    if (entry)
      await writePurpose(db, entry, link.purpose, link.linkedPostId ? { noodlerLinkedPostId: link.linkedPostId } : {});
  }
}
