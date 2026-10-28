/**
 * One Undo per Creator and slot after "Use" on a drawn profile picture or cover, back to the picture
 * from before the first Use. Pure bookkeeping: the caller swaps the URLs and removes the files.
 * ponytail: in memory, so a restart forgets the Undo and leaves the old file on disk; persist it in
 * the account settings if a restart between Use and Undo ever matters.
 */
export function createSlpPictureUndo() {
  const kept = new Map<string, string | null>();
  return {
    /**
     * A Use replaced `before`. The first Use keeps it; a later one (after Retry) keeps the original,
     * so `before` (the picture the earlier Use put up) is returned for the caller to remove.
     */
    used(key: string, before: string | null): { drop: string | null } | null {
      if (kept.has(key)) return { drop: before };
      kept.set(key, before);
      return null;
    },
    /** The picture Undo puts back, or null when there is nothing to undo. */
    previous(key: string): { url: string | null } | null {
      return kept.has(key) ? { url: kept.get(key) ?? null } : null;
    },
    forget(key: string) {
      kept.delete(key);
    },
  };
}
