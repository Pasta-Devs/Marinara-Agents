import type { SlpAccountKind } from "./slp-social.types.js";

interface SlpReplyManagementInput {
  actorKind: SlpAccountKind | null | undefined;
  actorAccountId: string;
  personaAccountId: string | null | undefined;
  /** The persona's fan account (its viewer actor row), which the server records fan actions under. */
  fanActorAccountId?: string | null;
}

/**
 * Whether an interaction is the player's own. The server records a like, comment or vote under the
 * persona's own Creator on that Creator's posts and under the persona's fan account everywhere else,
 * so both ids are "me" (R1-020).
 */
export function slpIsOwnActor(
  account: { id: string; fanActorAccountId?: string | null } | null | undefined,
  actorAccountId: string,
): boolean {
  return Boolean(account && (actorAccountId === account.id || actorAccountId === account.fanActorAccountId));
}

/**
 * Users may manage their current persona's replies and replies authored by
 * their characters. Generated random-user replies remain read-only.
 */
export function canManageSlpReply({
  actorKind,
  actorAccountId,
  personaAccountId,
  fanActorAccountId,
}: SlpReplyManagementInput): boolean {
  if (actorKind === "character") return true;
  return (
    actorKind === "persona" &&
    Boolean(personaAccountId) &&
    (actorAccountId === personaAccountId || (Boolean(fanActorAccountId) && actorAccountId === fanActorAccountId))
  );
}
