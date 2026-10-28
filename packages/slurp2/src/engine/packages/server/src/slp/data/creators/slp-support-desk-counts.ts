/**
 * What a Creator has published, for the Support desk's challenges and contracts. Apart from the desk
 * storage so that file stays free of the storage composition (the story storage reads the desk).
 */
import type { DB } from "../../../db/connection.js";
import { createSlurpStorage } from "../slp-storage.js";
import type { SlpDeskChallengeMetric } from "../../../../../shared/src/slp/slp-support-desk.js";

export async function countSlurpDeskPublished(
  db: DB,
  creatorAccountId: string,
): Promise<Record<SlpDeskChallengeMetric, number>> {
  const posts = await createSlurpStorage(db).listAllNoodlerPostsByAccount(creatorAccountId);
  const counts = { posts: 0, stories: 0 };
  for (const post of posts as { access: string; metadata?: Record<string, unknown> | null }[]) {
    if (post.access === "draft" || post.metadata?.slurpDeletedAt) continue;
    if (post.metadata?.noodlerPostType === "story") counts.stories += 1;
    else counts.posts += 1;
  }
  return counts;
}
