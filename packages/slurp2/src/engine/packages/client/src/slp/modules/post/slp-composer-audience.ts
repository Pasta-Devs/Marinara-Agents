/** Who can see a post, as the composer offers it (design step 7). */
export type SlpComposerAudience = "public" | "subscribers" | "locked";

/**
 * The server knows two audiences, public and locked (subscribers see it, everyone else unlocks it).
 * "Subscribers" is a locked post at the Creator's usual unlock price; "Locked · 25 ©" is a locked
 * post with its own price.
 */
export function slpComposerAudienceOf(draft: {
  access: "public" | "locked";
  unlockPrice?: number | null;
}): SlpComposerAudience {
  if (draft.access === "public") return "public";
  return draft.unlockPrice === null || draft.unlockPrice === undefined ? "subscribers" : "locked";
}
