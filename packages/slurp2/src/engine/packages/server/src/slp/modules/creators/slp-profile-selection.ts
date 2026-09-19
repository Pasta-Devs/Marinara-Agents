import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";

export function isSlpProfileGenerated(account: Pick<SlpAccount, "settings">): boolean {
  return account.settings.profile.profileGenerated === true;
}

/** Profiles are generated only for character accounts selected for the current refresh. */
export function slpAccountsNeedingProfiles(accounts: readonly SlpAccount[]): SlpAccount[] {
  return accounts.filter((account) => account.kind === "character" && !isSlpProfileGenerated(account));
}
