import type { SlpPost } from "../../../../../shared/src/slp/slp-social.types.js";

export function withoutCreatorSelfHiddenAccountId(
  hiddenFromAccountIds: readonly string[],
  sourceEntityId: string | null | undefined,
): string[] {
  return sourceEntityId
    ? hiddenFromAccountIds.filter((accountId) => accountId !== sourceEntityId)
    : [...hiddenFromAccountIds];
}

export function canViewCreatorPost(input: {
  post: Pick<SlpPost, "id" | "access">;
  subscribed: boolean;
  unlockedPostIds: ReadonlySet<string>;
}): boolean {
  if (input.post.access === "public") return true;
  return input.subscribed || input.unlockedPostIds.has(input.post.id);
}
