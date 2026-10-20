import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { and, eq, inArray } from "../../../db/file-query.js";
import { slpCreatorPreparedPosts } from "../../../db/schema/slurp.js";
import { createSlurpStorage } from "../slp-storage.js";
import { parseRecord, type SlpCreatorPreparedPostPayload } from "../../modules/records/slp-storage-model.js";
import { slurpIsLegacyImageBrief, slurpWithoutCameraDevice } from "../../base/media/slp-image-prompt.js";

const SLURP_OTHER_SUBJECTS_WINDOW_MS = 24 * 60 * 60 * 1000;
const SLURP_OTHER_SUBJECTS_MAX = 10;
// Enough for the clothes and the room, which is what Creators copied from each other.
const SLURP_OTHER_PICTURE_LENGTH = 90;

/**
 * Titles other Creators posted publicly in the last day, newest first.
 *
 * "Everyone is at the laundry" was a feed-wide repeat that no single Creator's history could see.
 * Title and, for a public picture, the start of what it showed: titles alone let five Creators
 * wear the same cream knit sweater on one evening. Prepared posts count too. Never another Creator's
 * wording or a locked post.
 * A failed read costs the post this list, never the post.
 */
export async function listSlurpOtherCreatorSubjects(db: DB, accountId: string, at: Date): Promise<string[]> {
  return readOtherCreatorSubjects(db, accountId, at).catch((error: unknown) => {
    logger.warn(error, "[slurp] Could not read other Creators' recent subjects; the post is written without them");
    return [];
  });
}

async function otherCreatorIds(db: DB, accountId: string): Promise<string[]> {
  return (await createSlurpStorage(db).listNoodlerAccounts())
    .filter(
      (candidate) =>
        candidate.id !== accountId &&
        candidate.kind !== "random_user" &&
        !(candidate.kind === "persona" && candidate.sourceKind === "persona"),
    )
    .map((candidate) => candidate.id);
}

/** Other Creators' prepared posts that go up within a day of `at`: written, not yet on the feed. */
async function otherPreparedPosts(db: DB, creatorIds: readonly string[], at: Date) {
  if (!creatorIds.length) return [];
  const rows = await db
    .select()
    .from(slpCreatorPreparedPosts)
    .where(
      and(
        eq(slpCreatorPreparedPosts.state, "prepared"),
        inArray(slpCreatorPreparedPosts.creatorAccountId, [...creatorIds]),
      ),
    );
  return rows
    .filter((row) => Math.abs(Date.parse(row.publishAt) - at.getTime()) <= SLURP_OTHER_SUBJECTS_WINDOW_MS)
    .map((row) => ({ publishAt: row.publishAt, payload: parseRecord(row.payload) as SlpCreatorPreparedPostPayload }));
}

async function readOtherCreatorSubjects(db: DB, accountId: string, at: Date): Promise<string[]> {
  const noodle = createSlurpStorage(db);
  const creatorIds = await otherCreatorIds(db, accountId);
  const posts = await noodle.listNoodlerPostsByAccounts(creatorIds, 3, {
    since: new Date(at.getTime() - SLURP_OTHER_SUBJECTS_WINDOW_MS).toISOString(),
    maxRows: 40,
  });
  // Posts written in the same run as this one are prepared, not posted: without them five
  // Creators planned at once never saw each other (#104).
  const prepared = (await otherPreparedPosts(db, creatorIds, at)).map((item) => ({
    access: item.payload.access === "public" ? "public" : "locked",
    title: typeof item.payload.title === "string" ? item.payload.title : null,
    imagePrompt: typeof item.payload.imagePrompt === "string" ? item.payload.imagePrompt : null,
    // Ranked as "now" at most: a post due later must not push every posted subject off the list.
    createdAt: item.publishAt < at.toISOString() ? item.publishAt : at.toISOString(),
  }));
  return [...[...posts.values()].flat(), ...prepared]
    .filter((post) => post.access === "public" && post.title?.trim())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, SLURP_OTHER_SUBJECTS_MAX)
    .map((post) => {
      const picture =
        post.imagePrompt && !slurpIsLegacyImageBrief(post.imagePrompt)
          ? slurpWithoutCameraDevice(post.imagePrompt).replace(/\s+/gu, " ").trim().slice(0, SLURP_OTHER_PICTURE_LENGTH)
          : "";
      return picture ? `${post.title!.trim()} (picture: ${picture})` : post.title!.trim();
    });
}

/**
 * The spice kind and taste of other Creators' spicy posts from the last day, posted or prepared,
 * locked ones too. Only the two labels, never a word of the post. Lets one Creator's angle step
 * aside when the feed is already full of showers (#104). A failed read costs only the spread.
 */
export async function listSlurpFeedSpice(
  db: DB,
  accountId: string,
  at: Date,
): Promise<{ kind: string; taste: string | null }[]> {
  try {
    const creatorIds = await otherCreatorIds(db, accountId);
    const posts = await createSlurpStorage(db).listNoodlerPostsByAccounts(creatorIds, 6, {
      since: new Date(at.getTime() - SLURP_OTHER_SUBJECTS_WINDOW_MS).toISOString(),
      maxRows: 120,
    });
    const prepared = await otherPreparedPosts(db, creatorIds, at);
    return [
      ...[...posts.values()].flat().map((post) => post.metadata),
      ...prepared.map((item) => item.payload.metadata),
    ].flatMap((metadata) => {
      const spice = (metadata as Record<string, unknown> | null | undefined)?.slurpSpice as
        { kind?: unknown; taste?: unknown } | undefined;
      return typeof spice?.kind === "string"
        ? [{ kind: spice.kind, taste: typeof spice.taste === "string" ? spice.taste : null }]
        : [];
    });
  } catch (error) {
    logger.warn(error, "[slurp] Could not read the feed's recent spice; the angle goes without it");
    return [];
  }
}
