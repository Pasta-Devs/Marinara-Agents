/**
 * Tier 2 creator replies: the creator saying something real back to the audience.
 *
 * The free tier answers a three-word comment with a three-word thank-you, which is what a real
 * creator does and costs nothing. It cannot answer a comment that actually said something, and a
 * creator who only ever replies "🥺 thank you" is a different kind of bot from one who never
 * replies at all.
 *
 * Two rules shape everything here.
 *
 * **Unattended work never calls the model.** So this is driven from a read, beside
 * `drainSlurpPendingText`, not from the background tick. The player is present and the spend is
 * against text they are about to scroll past.
 *
 * **Being a particular fan has to change something.** Which comments earn a written answer is
 * decided by the same rapport the rest of the system runs on, so a regular who asked a real
 * question gets a real answer and a passer-by does not.
 */
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { createSlurpPopulationStorage } from "../storage/slurp-population.storage.js";
import { resolveSlurpTextConnection } from "./slurp-connection.js";
import { tryNoodlerAccountOperation } from "./slurp-account-operation-lock.js";
import { generateNoodlerCreatorReply } from "./slurp-reply-generation.service.js";
import { slurpCreatorReplyChance } from "./slurp-world.js";

/**
 * Shortest comment worth a written answer.
 *
 * ponytail: a length test, not a provenance flag. Tier 1 bank lines are a handful of words and
 * generated ones are sentences, so length separates them without a column to carry the tier.
 * If the banks ever grow long lines, mark the tier on the row instead.
 */
const SUBSTANTIVE_LENGTH = 40;

/** Written answers per drain. The budget ceiling in the claim is the real cap; this is politeness. */
const MAX_PER_DRAIN = 2;

/** Posts still close enough to the present that a reply reads as a reply, not an exhumation. */
const RECENT_POSTS_PER_CREATOR = 4;

/**
 * Answer up to a couple of substantive audience comments. Returns how many were written.
 *
 * Every failure is swallowed: this runs inside a page load, and a creator failing to think of
 * something to say must never cost the player their feed.
 */
export async function drainSlurpAudienceReplies(db: DB, limit = MAX_PER_DRAIN): Promise<number> {
  const noodle = createSlurpStorage(db);
  const settings = await noodle.getSettings();
  const connection = await resolveSlurpTextConnection(createConnectionsStorage(db), settings.generationConnectionId);
  if (!connection) return 0;

  const population = createSlurpPopulationStorage(db);
  let written = 0;
  for (const creator of await noodle.listNoodlerAccounts()) {
    if (written >= limit) break;
    const posts = (await noodle.listNoodlerPostsByAccounts([creator.id], RECENT_POSTS_PER_CREATOR))
      .get(creator.id)
      ?.filter((post) => post.access !== "draft");
    if (!posts || posts.length === 0) continue;
    const interactions = await noodle.listNoodlerInteractions(posts.map((post) => post.id));
    const answered = new Set(
      interactions
        .filter((entry) => entry.actorAccountId === creator.id && entry.parentInteractionId)
        .map((entry) => entry.parentInteractionId!),
    );
    const ties = new Map((await population.listTiesForCreator(creator.id)).map((tie) => [tie.memberId, tie]));

    // Newest first: a reply to what somebody just said beats a reply to what they said on Tuesday.
    const candidates = interactions
      .filter(
        (entry) =>
          entry.type === "reply" &&
          !entry.parentInteractionId &&
          entry.actorAccountId !== creator.id &&
          !answered.has(entry.id) &&
          (entry.content?.trim().length ?? 0) >= SUBSTANTIVE_LENGTH &&
          ties.has(entry.actorAccountId),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    for (const comment of candidates) {
      if (written >= limit) break;
      const tie = ties.get(comment.actorAccountId) ?? null;
      // A higher bar than the free tier. A written answer is the scarce thing, so it goes to the
      // people the relationship model says have earned one rather than to whoever commented last.
      if (slurpCreatorReplyChance(tie) < 0.4) continue;
      const commenter = await population.get(comment.actorAccountId).catch(() => null);
      if (!commenter) continue;
      const post = posts.find((entry) => entry.id === comment.postId);
      if (!post) continue;

      const claim = await noodle.claimNoodlerAudienceReply(creator.id, comment.id);
      if (claim.status === "exhausted") return written;
      if (claim.status !== "claimed") continue;

      const locked = await tryNoodlerAccountOperation(creator.id, async () => {
        try {
          // Destructured and dropped: this reply answers a generated audience member, and their
          // feelings are not a relationship the player has. Only a real viewer moves a mood.
          const { content } = await generateNoodlerCreatorReply({
            db,
            creator: claim.creator,
            viewer: claim.commenter,
            post: claim.post,
            parent: claim.parent,
            connection,
          });
          return await noodle.finalizeNoodlerCreatorReplyClaim(claim.claimId, content);
        } catch (error) {
          // Release, or the claim becomes a permanent "already answered" key for a comment that
          // never got an answer.
          await noodle.releaseNoodlerCreatorReplyClaim(claim.claimId).catch(() => undefined);
          logger.warn(error, "[slurp-audience-reply] Could not answer comment %s", comment.id);
          return null;
        }
      });
      if (!locked.acquired) {
        await noodle.releaseNoodlerCreatorReplyClaim(claim.claimId).catch(() => undefined);
        continue;
      }
      if (locked.value) written += 1;
    }
  }
  return written;
}
