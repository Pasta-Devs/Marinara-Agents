// Stir's Creator pickers (release 0.3.0, user): the list rule, pure, so a test can run it.
export type SlpChipCreator = { id: string; name: string; avatarUrl: string | null };

/** Above this many Creators the chips get a "Find a Creator" field. */
export const SLP_CREATOR_CHIPS_SEARCH_FROM = 12;

/**
 * Which chips show, in order: the picked ones first (always, even when the words do not match), then
 * the rest whose name contains the words (any case).
 */
export function slpCreatorChipList<T extends SlpChipCreator>(
  creators: readonly T[],
  picked: readonly string[],
  query: string,
): T[] {
  const words = query.trim().toLocaleLowerCase();
  const chosen = creators.filter((creator) => picked.includes(creator.id));
  const rest = creators.filter(
    (creator) => !picked.includes(creator.id) && (!words || creator.name.toLocaleLowerCase().includes(words)),
  );
  return [...chosen, ...rest];
}
