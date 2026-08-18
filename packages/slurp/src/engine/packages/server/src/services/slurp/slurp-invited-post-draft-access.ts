import type { NoodleAccount } from "@marinara-engine/shared";

export function isDirectlyInvitedNoodleCharacter(account: Pick<NoodleAccount, "kind" | "invited"> | null): boolean {
  return account?.kind === "character" && account.invited === true;
}
