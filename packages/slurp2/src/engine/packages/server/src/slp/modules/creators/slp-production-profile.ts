/**
 * How this Creator makes things, as opposed to who they are.
 *
 * Pure and deterministic, like the other Slurp rule modules.
 *
 * ## The problem
 *
 * Every Creator produced the same kind of picture. Unrelated people, with unrelated cards, all
 * arrived at soft light, a flattering angle, a vulnerable expression and a camera that had somehow
 * been placed for them. The variation rotation gave them different situations, but it gave all of
 * them the same production grammar, so the feed read as one photographer working through a cast.
 *
 * A real platform has someone who shoots on a phone in a messy kitchen and someone who runs a
 * ring light and a backdrop, and the difference shows in every post either of them makes.
 *
 * ## The approach
 *
 * A production style is assigned per Creator and then stays put. It biases which cameras they
 * reach for, how polished any given post is, and whether they talk about the work at all.
 *
 * The style is keyed on the account id rather than read out of the character card's prose. That is
 * deliberate: sniffing a bio for words like "professional" is the kind of cleverness that fails
 * silently and in one language only, and keying on the prose would reshuffle a Creator's entire
 * production style the first time somebody fixed a typo in their bio. Keyed on identity, the style
 * survives every edit to the card, which is what "this is how she shoots" has to mean.
 *
 * ponytail: assigned from identity, not inferred from the card, and not author-editable. If
 * players want to say outright that a Creator runs a studio, this wants a real profile field on
 * the stage profile and a migration; the shape here is already the shape that field would take.
 */
import { slurpRotationHash } from "../feed/slp-post-variation.js";
import type { SlurpCameraSource } from "../feed/slp-camera-source.js";

/** How much work goes into one picture. */
export const SLURP_POST_EFFORTS = ["low", "medium", "high"] as const;
export type SlurpPostEffort = (typeof SLURP_POST_EFFORTS)[number];

export const SLURP_PRODUCTION_STYLES = ["homemade", "polished", "documentary", "theatrical"] as const;
export type SlurpProductionStyle = (typeof SLURP_PRODUCTION_STYLES)[number];

export type SlurpProductionProfile = {
  style: SlurpProductionStyle;
  /** Cameras this Creator reaches for first. Never a restriction: the scene still has to allow it. */
  prefers: readonly SlurpCameraSource[];
  /** Rotated per post, so one Creator is not uniformly polished or uniformly scruffy. */
  effortCycle: readonly SlurpPostEffort[];
  /** How this Creator talks about making the thing. */
  transparency: string;
};

const PROFILES: Record<SlurpProductionStyle, Omit<SlurpProductionProfile, "style">> = {
  homemade: {
    prefers: ["selfie", "mirror", "screenshot"],
    effortCycle: ["low", "low", "medium", "low"],
    transparency:
      "You do not think of this as production. You take a picture, you post it, and you would not call any of it work.",
  },
  polished: {
    prefers: ["tripod", "mirror", "selfie"],
    effortCycle: ["medium", "high", "medium", "high"],
    transparency:
      "You care how this looks and you put time into it. You will mention a retake, a light you fought with, or how long something took.",
  },
  documentary: {
    prefers: ["screenshot", "selfie", "archive"],
    effortCycle: ["low", "medium", "low", "low"],
    transparency:
      "You post what the day actually looked like, including the parts that did not come out well. A bad picture that is true beats a good one that is not.",
  },
  theatrical: {
    prefers: ["tripod", "partner", "mirror"],
    effortCycle: ["high", "medium", "high", "high"],
    transparency:
      "This is a performance and you do not pretend otherwise. You plan it, you set it up, and letting people see the setup is part of the appeal.",
  },
};

/** This Creator's production style. Stable for the life of the account. */
export function slurpProductionProfile(creatorAccountId: string): SlurpProductionProfile {
  const style = SLURP_PRODUCTION_STYLES[slurpRotationHash(creatorAccountId) % SLURP_PRODUCTION_STYLES.length]!;
  return { style, ...PROFILES[style] };
}

/**
 * How much work went into this particular picture.
 *
 * Rotated rather than fixed, because a Creator who is uniformly polished is as monotonous as a
 * feed where every post is the same situation. Even the theatrical one has ordinary days.
 */
export function slurpPostEffort(profile: SlurpProductionProfile, sequence: number): SlurpPostEffort {
  const step = Number.isFinite(sequence) ? Math.max(0, Math.floor(sequence)) : 0;
  return profile.effortCycle[step % profile.effortCycle.length]!;
}

const EFFORT_INSTRUCTIONS: Record<SlurpPostEffort, string> = {
  low: "Effort: none. Whatever the phone caught. Bad crop, wrong light, something in the way, not worth retaking.",
  medium: "Effort: a bit. They looked at it, they took a second one, and they stopped there.",
  high: "Effort: real. They set this up, fixed the light, and chose this frame out of several. It still has to be a picture a person could take where they are.",
};

/** The effort as prompt text, for the image brief. */
export function slurpEffortInstruction(effort: SlurpPostEffort): string {
  return EFFORT_INSTRUCTIONS[effort];
}

/** The profile as prompt text, for the post. */
export function slurpProductionInstruction(profile: SlurpProductionProfile): string {
  return ["# How you make things", profile.transparency].join("\n");
}
