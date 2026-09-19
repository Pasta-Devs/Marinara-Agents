import type { SlpAccountKind } from "./slp-social.types.js";

interface SlpReplyManagementInput {
  actorKind: SlpAccountKind | null | undefined;
  actorAccountId: string;
  personaAccountId: string | null | undefined;
}

/**
 * Users may manage their current persona's replies and replies authored by
 * their characters. Generated random-user replies remain read-only.
 */
export function canManageSlpReply({ actorKind, actorAccountId, personaAccountId }: SlpReplyManagementInput): boolean {
  if (actorKind === "character") return true;
  return actorKind === "persona" && Boolean(personaAccountId) && actorAccountId === personaAccountId;
}
