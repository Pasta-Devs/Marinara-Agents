import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";

export function isDirectlyInvitedSlpCharacter(account: Pick<SlpAccount, "kind" | "invited"> | null): boolean {
  return account?.kind === "character" && account.invited === true;
}
