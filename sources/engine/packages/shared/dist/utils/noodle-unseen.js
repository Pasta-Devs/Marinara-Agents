/**
 * How many of these activity timestamps land after `seenAt`.
 *
 * No stored timestamp means this viewer has never had the feed shown to them, so nothing
 * counts as new — the counter stays silent on first run rather than announcing the whole
 * backlog. An unparseable value is treated the same way, never as "everything is new".
 *
 * Callers pass the timestamp their feed is *sorted* by, which is not always `createdAt`:
 * public Noodle orders by latest activity, so creation time here would put the divider
 * somewhere other than the boundary the reader actually sees.
 */
export function countActivityAfter(activityAtMs, seenAt) {
    if (!seenAt)
        return 0;
    const seen = new Date(seenAt).getTime();
    if (Number.isNaN(seen))
        return 0;
    return activityAtMs.filter((at) => at > seen).length;
}
/**
 * When each post last received a reply from someone else to one of this persona's own
 * comments. Public Noodle's timeline bumps a post to the top for this, so it is part of the
 * activity timestamp the feed is ordered by — not just the post's creation time.
 */
export function noodleReplyBumpByPostId(interactions, personaAccountId) {
    const latest = new Map();
    if (!personaAccountId)
        return latest;
    const byId = new Map(interactions.map((interaction) => [interaction.id, interaction]));
    for (const interaction of interactions) {
        if (interaction.type !== "reply" || interaction.actorAccountId === personaAccountId)
            continue;
        if (!interaction.parentInteractionId)
            continue;
        const parentComment = byId.get(interaction.parentInteractionId);
        if (parentComment?.type !== "reply" || parentComment.actorAccountId !== personaAccountId)
            continue;
        const createdAt = new Date(interaction.createdAt).getTime();
        if (!Number.isFinite(createdAt))
            continue;
        latest.set(interaction.postId, Math.max(latest.get(interaction.postId) ?? 0, createdAt));
    }
    return latest;
}
/** The value public Noodle's timeline is sorted by: creation, or a later reply bump. */
export function noodleActivityAt(post, replyBumpByPostId) {
    return Math.max(new Date(post.createdAt).getTime() || 0, replyBumpByPostId.get(post.id) ?? 0);
}
/**
 * Posts on the public Noodle timeline this persona has not been shown yet. Counted across the
 * whole timeline rather than the selected Following/All tab: the tab is a view preference, and
 * a counter that changed when you switched tabs would be reporting the filter, not the news.
 */
export function countNoodlePostsSince(posts, interactions, personaAccountId, seenAt) {
    const bumps = noodleReplyBumpByPostId(interactions, personaAccountId);
    return countActivityAfter(posts.filter((post) => post.authorAccountId !== personaAccountId).map((post) => noodleActivityAt(post, bumps)), seenAt);
}
/**
 * Posts a viewer persona has not been shown yet on NoodleR: newer than that persona's stored
 * `noodlerFeedSeenAt`, excluding its own stage profile's posts, which are never "new" to the
 * person who just wrote them.
 */
export function countNoodlerPostsSince(scope, seenAt) {
    if (!scope)
        return 0;
    return countActivityAfter(scope.creators
        .filter((creator) => creator.profile.noodleAccountId !== scope.viewer.id)
        .flatMap((creator) => creator.posts.map((post) => new Date(post.createdAt).getTime())), seenAt);
}
//# sourceMappingURL=noodle-unseen.js.map