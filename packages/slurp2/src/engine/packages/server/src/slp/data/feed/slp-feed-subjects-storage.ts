import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { createSlurpStorage } from "../slp-storage.js";

const SLURP_OTHER_SUBJECTS_WINDOW_MS = 24 * 60 * 60 * 1000;
const SLURP_OTHER_SUBJECTS_MAX = 10;

/**
 * Titles other Creators posted publicly in the last day, newest first.
 *
 * "Everyone is at the laundry" was a feed-wide repeat that no single Creator's history could see.
 * Titles only: a subject to steer away from, never another Creator's wording or a locked post.
 * A failed read costs the post this list, never the post.
 */
export async function listSlurpOtherCreatorSubjects(db: DB, accountId: string, at: Date): Promise<string[]> {
  return readOtherCreatorSubjects(db, accountId, at).catch((error: unknown) => {
    logger.warn(error, "[slurp] Could not read other Creators' recent subjects; the post is written without them");
    return [];
  });
}

async function readOtherCreatorSubjects(db: DB, accountId: string, at: Date): Promise<string[]> {
  const noodle = createSlurpStorage(db);
  const creatorIds = (await noodle.listNoodlerAccounts())
    .filter(
      (candidate) =>
        candidate.id !== accountId &&
        candidate.kind !== "random_user" &&
        !(candidate.kind === "persona" && candidate.sourceKind === "persona"),
    )
    .map((candidate) => candidate.id);
  const posts = await noodle.listNoodlerPostsByAccounts(creatorIds, 3, {
    since: new Date(at.getTime() - SLURP_OTHER_SUBJECTS_WINDOW_MS).toISOString(),
    maxRows: 40,
  });
  return [...posts.values()]
    .flat()
    .filter((post) => post.access === "public" && post.title?.trim())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, SLURP_OTHER_SUBJECTS_MAX)
    .map((post) => post.title!.trim());
}
