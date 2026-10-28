// ──────────────────────────────────────────────
// The feed keeps itself fresh (step 3.1: the refresh action is gone). Two pure rules, so a test can
// run them without a render:
// - a background refetch of page one must not drop the older pages the reader loaded with "Load more";
// - posts that arrive while the reader is on the feed wait behind a "New posts" pill instead of
//   pushing what they are reading down the screen.
// ──────────────────────────────────────────────

type FeedScope = {
  creators: { profile: { id: string }; posts: { id: string; createdAt: string }[] }[];
  nextCursor?: unknown;
};

const time = (value: string) => new Date(value).getTime();

/**
 * Merges a fresh first page into the cached feed. Page one comes only from the server (so a post that
 * left it disappears); posts older than the whole fresh page are the reader's loaded pages and stay,
 * with the cursor that follows them.
 * ponytail: a loaded-page post deleted elsewhere stays until the feed reloads; a full re-page fixes it if that matters.
 */
export function mergeSlpFeedFirstPage<Scope extends FeedScope>(current: Scope | undefined, fresh: Scope): Scope {
  if (!current || !fresh.nextCursor) return fresh;
  const freshTimes = fresh.creators.flatMap((creator) => creator.posts.map((post) => time(post.createdAt)));
  if (freshTimes.length === 0) return fresh;
  const oldestFresh = Math.min(...freshTimes);
  const loadedByCreator = new Map(
    current.creators.map((creator) => [
      creator.profile.id,
      creator.posts.filter((post) => time(post.createdAt) < oldestFresh),
    ]),
  );
  let kept = 0;
  const creators = fresh.creators.map((creator) => {
    const freshIds = new Set(creator.posts.map((post) => post.id));
    const older = (loadedByCreator.get(creator.profile.id) ?? []).filter((post) => !freshIds.has(post.id));
    kept += older.length;
    return older.length ? { ...creator, posts: [...creator.posts, ...older] } : creator;
  });
  return kept ? ({ ...fresh, creators, nextCursor: current.nextCursor ?? null } as Scope) : fresh;
}

/**
 * Splits a newest-first feed at the reader's mark: posts newer than `acceptedAt` are held back for the
 * "New posts" pill, the rest are shown. No mark yet (first load) shows everything. The reader's own
 * posts (`isOwn`) are never held: they just made them and expect to see them at once.
 */
export function holdNewSlpFeedPosts<Item extends { post: { createdAt: string } }>(
  feed: readonly Item[],
  acceptedAt: number | null,
  isOwn: (item: Item) => boolean = () => false,
): { shown: Item[]; held: Item[] } {
  if (acceptedAt === null) return { shown: [...feed], held: [] };
  const shown: Item[] = [];
  const held: Item[] = [];
  for (const item of feed) (time(item.post.createdAt) > acceptedAt && !isOwn(item) ? held : shown).push(item);
  return { shown, held };
}

/** The mark for a feed: its newest post's time, or null while it is empty. */
export function newestSlpFeedTime(feed: readonly { post: { createdAt: string } }[]): number | null {
  let newest: number | null = null;
  for (const { post } of feed) {
    const at = time(post.createdAt);
    if (newest === null || at > newest) newest = at;
  }
  return newest;
}
