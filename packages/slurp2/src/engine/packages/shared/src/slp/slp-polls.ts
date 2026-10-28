import { slpPollInputSchema, slpPollSchema } from "./slp-social.schema.js";
import type { SlpInteraction, SlpPoll, SlpPost } from "./slp-social.types.js";

export function createSlpPoll(value: unknown): SlpPoll | null {
  const parsed = slpPollInputSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    question: parsed.data.question,
    options: parsed.data.options.map((label, index) => ({ id: `option-${index + 1}`, label })),
  };
}

export function readSlpPoll(value: unknown): SlpPoll | null {
  const parsed = slpPollSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function readSlpPollFromMetadata(metadata: Record<string, unknown> | null | undefined): SlpPoll | null {
  return readSlpPoll(metadata?.poll);
}

function pollVoteKey(interaction: Pick<SlpInteraction, "postId" | "actorAccountId">): string {
  return `${interaction.postId}\u0000${interaction.actorAccountId}`;
}

/**
 * Preserve durable poll votes when a newly fetched Slurp snapshot races an
 * interaction write. Server-returned votes remain authoritative for each
 * account, while a previously known vote is retained only if its poll and
 * option still exist in the new snapshot.
 */
export function mergeSlpPollVoteInteractions(
  previousInteractions: SlpInteraction[],
  nextPosts: SlpPost[],
  nextInteractions: SlpInteraction[],
): SlpInteraction[] {
  const optionIdsByPostId = new Map<string, Set<string>>();
  for (const post of nextPosts) {
    const poll = readSlpPollFromMetadata(post.metadata);
    if (!poll) continue;
    optionIdsByPostId.set(post.id, new Set(poll.options.map((option) => option.id)));
  }

  const nextVoteKeys = new Set(nextInteractions.filter((interaction) => interaction.type === "vote").map(pollVoteKey));
  const preservedVotes = previousInteractions.filter((interaction) => {
    if (interaction.type !== "vote" || nextVoteKeys.has(pollVoteKey(interaction))) return false;
    const optionIds = optionIdsByPostId.get(interaction.postId);
    return Boolean(interaction.content && optionIds?.has(interaction.content));
  });

  return preservedVotes.length > 0 ? [...nextInteractions, ...preservedVotes] : nextInteractions;
}
