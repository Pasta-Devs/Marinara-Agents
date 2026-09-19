import type { SlpAccount, SlpPost } from "../../../../../shared/src/slp/slp-social.types.js";

type NoodlerAccessAccount = SlpAccount & { sourceEntityId?: string | null };

export function withoutNoodlerSelfHiddenAccountId(
  hiddenFromAccountIds: readonly string[],
  sourceEntityId: string | null | undefined,
): string[] {
  return sourceEntityId
    ? hiddenFromAccountIds.filter((accountId) => accountId !== sourceEntityId)
    : [...hiddenFromAccountIds];
}

export function isNoodlerHiddenFromViewer(account: NoodlerAccessAccount, viewerAccountId: string): boolean {
  if (account.sourceEntityId === viewerAccountId) return false;
  return account.settings.privacy.access.hiddenFromAccountIds.includes(viewerAccountId);
}

export function canViewNoodlerPost(input: {
  post: Pick<SlpPost, "id" | "access">;
  subscribed: boolean;
  unlockedPostIds: ReadonlySet<string>;
}): boolean {
  if (input.post.access === "public") return true;
  return input.subscribed || input.unlockedPostIds.has(input.post.id);
}
