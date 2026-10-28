/**
 * The Story ring, as data (T). A ring means "has a live Story" and nothing else: `new` while one of
 * the Creator's live Stories is unwatched by this persona, `seen` once all are, no entry without one.
 * Pure, so a test can run it without a render.
 */
export type SlpStoryRingState = "new" | "seen";

/** A live Story (inside the Story lifetime) and whether this persona watched it. */
export type SlpLiveStory = { creatorId: string; postId: string; createdAt: string; watched: boolean };

export function slpStoryRings(stories: readonly SlpLiveStory[]): Map<string, SlpStoryRingState> {
  const rings = new Map<string, SlpStoryRingState>();
  for (const story of stories) {
    if (!story.watched) rings.set(story.creatorId, "new");
    else if (!rings.has(story.creatorId)) rings.set(story.creatorId, "seen");
  }
  return rings;
}

/** Where a ringed avatar starts: the Creator's oldest unwatched live Story, else their oldest. */
export function slpStoryStartId(stories: readonly SlpLiveStory[], creatorId: string): string | null {
  const own = stories
    .filter((story) => story.creatorId === creatorId)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  return (own.find((story) => !story.watched) ?? own[0])?.postId ?? null;
}
