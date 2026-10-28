import type { createSlurpStorage } from "../../data/slp-storage.js";
import { slurpTeaserPost } from "../../modules/feed/slp-post-variation.js";

/**
 * Access for an automatic post: locked, except on this Creator's teaser slots, which go out free
 * to fish for subscribers. A player-chosen access never passes through here.
 */
export async function resolveSlurpAutomaticPostAccess(
  noodle: Pick<ReturnType<typeof createSlurpStorage>, "countNoodlerPostsByAccount" | "getSettings">,
  accountId: string,
): Promise<"public" | "locked"> {
  const [sequence, settings] = await Promise.all([noodle.countNoodlerPostsByAccount(accountId), noodle.getSettings()]);
  return slurpTeaserPost(accountId, sequence, settings.teaserRate) ? "public" : "locked";
}
