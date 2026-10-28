/**
 * Callback references for the beats planner: now and then a post refers back to something real.
 *
 * Pure. The feature layer reads the sources; this decides which of them may be referred to and
 * whether this post gets one.
 *
 * A reference is one retrieved fact, never a quoted caption: quoting old captions is what taught
 * the model its own filler words. The fact is the beat an earlier post was planned on, a set's
 * title, a moment the player saved from a chat, or the label of a request the Creator delivered.
 */
import { slurpWeightedPick } from "./slp-weighted.js";

export const SLURP_REFERENCE_KINDS = ["post", "set", "chat", "promise"] as const;
export type SlurpReferenceKind = (typeof SLURP_REFERENCE_KINDS)[number];

export type SlurpBeatReference = { kind: SlurpReferenceKind; id: string; text: string };

/** Roughly one post in three refers back. */
const REFERENCE_SHARE = 1 / 3;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Too fresh reads as repetition; too old nobody remembers. */
const MIN_AGE_MS = DAY_MS;
const MAX_AGE_MS = 30 * DAY_MS;
/** A saved chat moment or a delivered request is rarer and more personal than an old post. */
const KIND_WEIGHT: Record<SlurpReferenceKind, number> = { chat: 2, promise: 2, set: 1.5, post: 1 };

type ReferencePost = {
  id: string;
  access: string;
  title: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

/** Everything this Creator could refer back to at `at`. */
export function slurpReferenceCandidates(input: {
  /** This Creator's published posts, newest first. */
  posts: readonly ReferencePost[];
  chatMoments: readonly { id: string; text: string }[];
  keptPromises: readonly { id: string; topic: string; completedAt: string | null }[];
  at: Date;
}): SlurpBeatReference[] {
  const inWindow = (iso: string | null) => {
    const age = input.at.getTime() - Date.parse(iso ?? "");
    return Number.isFinite(age) && age >= MIN_AGE_MS && age <= MAX_AGE_MS;
  };
  const fromPosts = input.posts
    .filter((post) => inWindow(post.createdAt))
    .flatMap((post): SlurpBeatReference[] => {
      if (post.metadata.contentIntent === "set" && post.title?.trim()) {
        return [{ kind: "set", id: `set:${post.id}`, text: `your earlier set "${post.title.trim()}"` }];
      }
      // A locked post's moment stays with its buyers; a set's title is public either way.
      const beat = post.metadata.slurpBeat as { line?: unknown } | undefined;
      return post.access === "public" && typeof beat?.line === "string" && beat.line.trim()
        ? [{ kind: "post", id: `post:${post.id}`, text: `an earlier post of yours: ${beat.line.trim()}` }]
        : [];
    });
  return [
    ...fromPosts,
    ...input.chatMoments.map((moment): SlurpBeatReference => ({
      kind: "chat",
      id: `chat:${moment.id}`,
      text: moment.text.trim(),
    })),
    ...input.keptPromises
      .filter((promise) => promise.topic.trim() && inWindow(promise.completedAt))
      .map((promise): SlurpBeatReference => ({
        kind: "promise",
        id: `promise:${promise.id}`,
        text: `a request you delivered: ${promise.topic.trim()}`,
      })),
  ].filter((reference) => reference.text);
}

/** The reference for this post, or null: most posts get none, and a recent one is not repeated. */
export function selectSlurpReference(
  seed: string,
  sequence: number,
  candidates: readonly SlurpBeatReference[],
  recentIds: readonly string[],
): SlurpBeatReference | null {
  const fresh = candidates.filter((candidate) => !recentIds.includes(candidate.id));
  if (fresh.length === 0) return null;
  const refer = slurpWeightedPick("reference", seed, sequence, [
    { value: true, weight: REFERENCE_SHARE },
    { value: false, weight: 1 - REFERENCE_SHARE },
  ]);
  if (!refer) return null;
  return slurpWeightedPick(
    "referenceSource",
    seed,
    sequence,
    fresh.map((value) => ({ value, weight: KIND_WEIGHT[value.kind] })),
  );
}
