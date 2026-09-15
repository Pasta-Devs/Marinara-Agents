import type { NoodleAccount } from "@marinara-engine/shared";
import { isNoodlerHiddenFromViewer } from "./slurp-access.js";

export function normalizeNoodlerSeenAt(seenAt: string | null | undefined): string | null {
  if (!seenAt) return null;
  const parsed = Date.parse(seenAt);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

/**
 * The unseen badge sees the same creators as the full viewer projection, except the viewer's own
 * Creator profile. Locked posts still count as news, matching the existing viewer-feed contract.
 */
export function noodlerUnseenCreatorAccountIds(accounts: NoodleAccount[], viewerAccountId: string): string[] {
  return accounts
    .filter(
      (account) =>
        !(account.kind === "persona" && account.entityId === viewerAccountId) &&
        !isNoodlerHiddenFromViewer(account, viewerAccountId),
    )
    .map((account) => account.id);
}
