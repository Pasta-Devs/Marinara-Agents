/**
 * Users may manage their current persona's replies and replies authored by
 * their characters. Generated random-user replies remain read-only.
 */
export function canManageNoodleReply({ actorKind, actorAccountId, personaAccountId, }) {
    if (actorKind === "character")
        return true;
    return actorKind === "persona" && Boolean(personaAccountId) && actorAccountId === personaAccountId;
}
//# sourceMappingURL=noodle-interactions.js.map