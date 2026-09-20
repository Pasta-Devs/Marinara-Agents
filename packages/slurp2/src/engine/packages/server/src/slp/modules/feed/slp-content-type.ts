/**
 * What this post is for.
 *
 * Pure and deterministic, like the other Slurp rule modules.
 *
 * ## The problem
 *
 * Every post was the same kind of post: something happened, here is a picture of it, here is what
 * it meant to me. A creator page does not work like that. It sells, it teases, it thanks people,
 * it answers requests, it admits the work, it apologises for a quiet week, and sometimes it just
 * says good morning. A locked post that reads as a diary entry behind a paywall is not a product,
 * and the complete emotional arc in every single entry is why the feed felt written rather than
 * lived.
 *
 * ## The approach
 *
 * The type is chosen before anything is written, and it decides what the caption is *for* — not
 * what it says. A type never supplies a scene, for the same reason a variation never supplies one:
 * the Creator's own life has to answer.
 *
 * Two of these already existed elsewhere and are not reinvented here. Stories come out of the
 * format rotation in `slp-post-variation.ts`, and free teaser posts come out of `slurpTeaserPost`.
 * `slurpPostContentType` takes both as given and rotates only over what is left, so the three
 * cannot contradict each other and a Story cannot also be a boundary notice.
 */

import { slurpRotationHash } from "./slp-post-variation.js";

export const SLURP_CONTENT_TYPES = [
  "teaser",
  "story",
  "set",
  "life",
  "request",
  "production",
  "callback",
  "appreciation",
  "boundary",
] as const;

export type SlurpContentType = (typeof SLURP_CONTENT_TYPES)[number];

/**
 * What each type asks the caption to do.
 *
 * Written as the job, never as a scene or a line to copy. Several of these deliberately ask for
 * less: a feed where every entry resolves into a meaning is the thing being fixed.
 */
const JOBS: Record<SlurpContentType, string> = {
  teaser:
    "This one is bait. Show enough that somebody wants the rest, say less than you want to, and do not resolve it.",
  story: "This one is throwaway. One line at most, no point to make, and it is gone tomorrow.",
  set: "This is a planned shoot you have been working on. You may say it took effort, that there is more of it, or when the rest lands.",
  life: "This one is not selling anything. Talk about your actual day like a person with a life outside this, and let it be dull.",
  request:
    "Somebody asked for this. Say so, in the way you would to a regular, without naming anyone or quoting a private message.",
  production:
    "Show the work. A setup, a retake, an outtake, a shoot that went wrong, or how long something actually took.",
  callback:
    "This continues something you already posted. Assume they remember it and do not explain it from the beginning.",
  appreciation: "This is for the people who stayed. Say thank you plainly and do not turn it into a sale.",
  boundary:
    "This is housekeeping: a limit, a schedule, a quiet week, or something you will not be doing. Be straightforward and do not apologise twice.",
};

/**
 * Types the rotation may choose on its own.
 *
 * `teaser` and `story` are excluded because they are already decided elsewhere, and choosing them
 * again here would let the two decisions disagree.
 */
const ROTATED: readonly SlurpContentType[] = [
  "life",
  "set",
  "callback",
  "life",
  "production",
  "request",
  "life",
  "appreciation",
  "set",
  "boundary",
];

/**
 * The type for one post.
 *
 * `story` and `teaser` are passed in rather than chosen, because the format rotation and the
 * access rotation already decided them. Everything else rotates on the same post count the
 * variation uses, so consecutive posts cannot land on the same job twice.
 *
 * `life` appears three times in ten on purpose. Most of what a person posts is not a product, and
 * a feed where every entry is a sale reads exactly as false as a feed where every entry is a
 * confession.
 */
export function slurpPostContentType(
  creatorAccountId: string,
  sequence: number,
  decided: { story?: boolean; teaser?: boolean },
): SlurpContentType {
  if (decided.story) return "story";
  if (decided.teaser) return "teaser";
  // Math.floor(NaN) is NaN and indexes nothing, which would hand the caller an undefined type.
  const step = Number.isFinite(sequence) ? Math.max(0, Math.floor(sequence)) : 0;
  return ROTATED[(slurpRotationHash(creatorAccountId) + step) % ROTATED.length]!;
}

/** The type as prompt text. One block, so the caller does not assemble it in three places. */
export function slurpContentTypeInstruction(type: SlurpContentType): string {
  return [
    "# What this post is for",
    JOBS[type],
    // The single most visible artificial signal in the shipped feed: every post ended by inviting
    // the reader in. A creator does that sometimes, not every time.
    "Only address the reader directly if this particular post calls for it. Do not end with an invitation out of habit.",
    "This is the post's job, not its subject. Let your own life supply what it is actually about.",
  ].join("\n");
}
