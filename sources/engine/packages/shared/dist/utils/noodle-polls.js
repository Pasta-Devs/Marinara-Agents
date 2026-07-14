import { noodlePollInputSchema, noodlePollSchema } from "../schemas/noodle.schema.js";
export function createNoodlePoll(value) {
    const parsed = noodlePollInputSchema.safeParse(value);
    if (!parsed.success)
        return null;
    return {
        question: parsed.data.question,
        options: parsed.data.options.map((label, index) => ({ id: `option-${index + 1}`, label })),
    };
}
export function readNoodlePoll(value) {
    const parsed = noodlePollSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}
export function readNoodlePollFromMetadata(metadata) {
    return readNoodlePoll(metadata?.poll);
}
function pollVoteKey(interaction) {
    return `${interaction.postId}\u0000${interaction.actorAccountId}`;
}
/**
 * Preserve durable poll votes when a newly fetched Noodle snapshot races an
 * interaction write. Server-returned votes remain authoritative for each
 * account, while a previously known vote is retained only if its poll and
 * option still exist in the new snapshot.
 */
export function mergeNoodlePollVoteInteractions(previousInteractions, nextPosts, nextInteractions) {
    const optionIdsByPostId = new Map();
    for (const post of nextPosts) {
        const poll = readNoodlePollFromMetadata(post.metadata);
        if (!poll)
            continue;
        optionIdsByPostId.set(post.id, new Set(poll.options.map((option) => option.id)));
    }
    const nextVoteKeys = new Set(nextInteractions.filter((interaction) => interaction.type === "vote").map(pollVoteKey));
    const preservedVotes = previousInteractions.filter((interaction) => {
        if (interaction.type !== "vote" || nextVoteKeys.has(pollVoteKey(interaction)))
            return false;
        const optionIds = optionIdsByPostId.get(interaction.postId);
        return Boolean(interaction.content && optionIds?.has(interaction.content));
    });
    return preservedVotes.length > 0 ? [...nextInteractions, ...preservedVotes] : nextInteractions;
}
//# sourceMappingURL=noodle-polls.js.map