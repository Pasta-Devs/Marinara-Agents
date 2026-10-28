/**
 * Why a post or a Story went up (3b), stored on it as `metadata.slurpPurpose`.
 *
 * The planner decides it before a word is written, so it shapes the post and what follows it: a
 * tease is followed by its drop, a Story poll's answer comes back in a later post, a Story points
 * at the post it announces. Plain data; the words a reader sees live in the client and the prompt.
 */

export const SLP_PURPOSE_KINDS = [
  // Posts
  "tease",
  "drop",
  "behind_the_scenes",
  "promote",
  "storyline",
  "answer_fans",
  "thanks",
  "daily_life",
  "poll_answer",
  // Stories
  "new_post",
  "countdown",
  "poll",
  "day_in_life",
  "comment_reaction",
] as const;
export type SlpPurposeKind = (typeof SLP_PURPOSE_KINDS)[number];

export type SlpPurpose = {
  kind: SlpPurposeKind;
  /** The post this one leads to or points at: the drop of a tease, the post a Story announces. */
  postId?: string;
  /** The tease a drop delivers. */
  teasePostId?: string;
  /** The campaign a tease, a drop and a countdown share. */
  campaignId?: string;
  /** When the drop is due (tease, countdown). */
  dropAt?: string;
  /** tease: Slurp holds a slot at exactly `dropAt` (slice I), so the tease names that time. */
  held?: boolean;
  /** poll_answer: the Story poll it answers and the option that won. */
  pollPostId?: string;
  answer?: string;
  /** poll: set once a later post took up the answer, so it is answered once. */
  answeredAt?: string;
  /** comment_reaction: the comment the Story answers. */
  comment?: { handle: string; text: string };
  /** promote: what is promoted. */
  subject?: "collab" | "brand" | "couple";
  /** day_in_life: which Story of the day this is (2 = the second). */
  part?: number;
};

const str = (value: unknown, max = 240) =>
  typeof value === "string" && value.trim() ? value.slice(0, max) : undefined;

export function readSlpPurpose(metadata: Record<string, unknown> | null | undefined): SlpPurpose | null {
  const raw = metadata?.slurpPurpose;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const kind = value.kind;
  if (typeof kind !== "string" || !(SLP_PURPOSE_KINDS as readonly string[]).includes(kind)) return null;
  const comment =
    value.comment && typeof value.comment === "object" ? (value.comment as Record<string, unknown>) : null;
  const subject = value.subject === "collab" || value.subject === "brand" || value.subject === "couple";
  const part = typeof value.part === "number" && Number.isFinite(value.part) ? Math.floor(value.part) : undefined;
  return {
    kind: kind as SlpPurposeKind,
    ...(str(value.postId, 80) ? { postId: str(value.postId, 80) } : {}),
    ...(str(value.teasePostId, 80) ? { teasePostId: str(value.teasePostId, 80) } : {}),
    ...(str(value.campaignId, 80) ? { campaignId: str(value.campaignId, 80) } : {}),
    ...(str(value.dropAt, 40) ? { dropAt: str(value.dropAt, 40) } : {}),
    ...(value.held === true ? { held: true } : {}),
    ...(str(value.pollPostId, 80) ? { pollPostId: str(value.pollPostId, 80) } : {}),
    ...(str(value.answer, 120) ? { answer: str(value.answer, 120) } : {}),
    ...(str(value.answeredAt, 40) ? { answeredAt: str(value.answeredAt, 40) } : {}),
    ...(comment && str(comment.text)
      ? { comment: { handle: str(comment.handle, 60) ?? "", text: str(comment.text, 280)! } }
      : {}),
    ...(subject ? { subject: value.subject as SlpPurpose["subject"] } : {}),
    ...(part && part > 0 ? { part } : {}),
  };
}

const HOUR = 60 * 60_000;

function hash(value: string): number {
  let h = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * How often each Story job comes up when it is available (`slurpStoryPurpose`). The player sets them
 * with one slider per job (Settings › Posting, `storyJobs`, 0-10, 0 = never); the balanced default
 * is 3b's 4 / 3 / 2 / 1.5 / 1.5 / 1.5 doubled.
 */
export const SLURP_STORY_JOB_DEFAULTS = {
  countdown: 8,
  newPost: 6,
  comment: 4,
  poll: 3,
  earlier: 3,
  plain: 3,
} as const;
export type SlurpStoryJobWeights = Record<keyof typeof SLURP_STORY_JOB_DEFAULTS, number>;

/**
 * Votes per option on a Story poll: the real votes plus a small seeded crowd that grows over the
 * first twelve hours, the same on the server (who won) and in the viewer (the results sticker).
 * The player's vote decides (slice I, user): once they voted, the crowd leans their way, so their
 * pick leads in the sticker and wins the follow-up post. Only the player's personas vote for real.
 */
export function slpStoryPollTally(
  poll: { postId: string; createdAt: string; optionCount: number },
  realVotes: readonly number[],
  at: Date | number,
): number[] {
  const now = typeof at === "number" ? at : at.getTime();
  const age = Math.max(0, now - Date.parse(poll.createdAt));
  const grown = Math.min(1, age / (12 * HOUR));
  const crowd = Math.round((6 + (hash(`${poll.postId}:crowd`) % 13)) * grown);
  const weights = Array.from({ length: poll.optionCount }, (_, index) => 1 + (hash(`${poll.postId}:${index}`) % 7));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const counts = weights.map((weight) => Math.floor((crowd * weight) / total));
  let rest = crowd - counts.reduce((sum, count) => sum + count, 0);
  for (let index = 0; rest > 0; index = (index + 1) % counts.length, rest -= 1) counts[index]! += 1;
  const real = counts.map((_, index) => realVotes[index] ?? 0);
  const pick = real.indexOf(Math.max(0, ...real));
  if (pick >= 0 && real[pick]! > 0) {
    // The biggest part of the crowd goes with the player's pick, and it leads by at least one.
    const most = counts.indexOf(Math.max(...counts));
    [counts[pick], counts[most]] = [counts[most]!, counts[pick]!];
    const rival = Math.max(...counts.map((count, index) => (index === pick ? -1 : count + real[index]!)));
    if (counts[pick]! + real[pick]! <= rival) counts[pick] = rival - real[pick]! + 1;
  }
  return counts.map((count, index) => count + real[index]!);
}
