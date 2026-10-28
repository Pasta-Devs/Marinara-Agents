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
import { slurpWeightedPick } from "../feed/slp-weighted.js";
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
  /** Weighted per post, so one Creator is not uniformly polished or uniformly scruffy. */
  effortWeights: readonly { value: SlurpPostEffort; weight: number }[];
  /** How this Creator talks about making the thing. */
  transparency: string;
};

const PROFILES: Record<SlurpProductionStyle, Omit<SlurpProductionProfile, "style">> = {
  homemade: {
    prefers: ["selfie", "screenshot", "tripod"],
    effortWeights: [
      { value: "low", weight: 70 },
      { value: "medium", weight: 25 },
      { value: "high", weight: 5 },
    ],
    transparency:
      "You do not think of this as production. You take a picture, you post it, and you would not call any of it work.",
  },
  polished: {
    prefers: ["tripod", "partner", "selfie"],
    effortWeights: [
      { value: "low", weight: 10 },
      { value: "medium", weight: 50 },
      { value: "high", weight: 40 },
    ],
    transparency:
      "You care how this looks and you put time into it. You will mention a retake, a light you fought with, or how long something took.",
  },
  documentary: {
    prefers: ["screenshot", "selfie", "archive"],
    effortWeights: [
      { value: "low", weight: 65 },
      { value: "medium", weight: 30 },
      { value: "high", weight: 5 },
    ],
    transparency:
      "You post what the day actually looked like, including the parts that did not come out well. A bad picture that is true beats a good one that is not.",
  },
  theatrical: {
    prefers: ["tripod", "partner", "screenshot"],
    effortWeights: [
      { value: "low", weight: 5 },
      { value: "medium", weight: 35 },
      { value: "high", weight: 60 },
    ],
    transparency:
      "This is a performance and you do not pretend otherwise. You plan it, you set it up, and letting people see the setup is part of the appeal.",
  },
};

/**
 * This Creator's production style. Stable for the life of the account unless the user names one.
 *
 * `override` is what the Creator strategy saved. Everything else about the profile still follows
 * from the style, so naming a style changes cameras, effort, and transparency together.
 */
export function slurpProductionProfile(
  creatorAccountId: string,
  override?: SlurpProductionStyle,
): SlurpProductionProfile {
  const style =
    override ?? SLURP_PRODUCTION_STYLES[slurpRotationHash(creatorAccountId) % SLURP_PRODUCTION_STYLES.length]!;
  return { style, ...PROFILES[style] };
}

/**
 * How much work went into this particular picture.
 *
 * Weighted rather than fixed, because a Creator who is uniformly polished is as monotonous as a
 * feed where every post is the same situation. Even the theatrical one has ordinary days, and a
 * fixed effort cycle would turn those ordinary days into a schedule.
 */
export function slurpPostEffort(
  profile: SlurpProductionProfile,
  sequence: number,
  // Seeded on the style alone, every Creator who shoots the same way moved through the identical
  // effort sequence. Keyed on the account too, two polished Creators have different days.
  creatorAccountId = "",
): SlurpPostEffort {
  return slurpWeightedPick("effort", `${profile.style}:${creatorAccountId}`, sequence, profile.effortWeights);
}

const EFFORT_INSTRUCTIONS: Record<SlurpPostEffort, string> = {
  low: "Effort: none. Whatever the first take caught: an offhand crop, ordinary room light, nothing arranged or tidied. Still sharp and clearly visible — careless, not broken.",
  medium: "Effort: a bit. They looked at it, they took a second one, and they stopped there.",
  high: "Effort: real. They set this up, fixed the light, and chose this frame out of several. It still has to be a picture a person could take where they are.",
};

/** The effort as prompt text, for the image brief. */
export function slurpEffortInstruction(effort: SlurpPostEffort): string {
  return EFFORT_INSTRUCTIONS[effort];
}

/** The effort as words an image model can draw. The caption side keeps `slurpEffortInstruction`. */
const EFFORT_PHOTO: Record<SlurpPostEffort, string> = {
  low: "casual and unedited, taken on the first attempt",
  medium: "casual, considered, and taken in a second attempt",
  high: "carefully planned and selected from several attempts",
};

export function slurpEffortPhoto(effort: SlurpPostEffort): string {
  return EFFORT_PHOTO[effort];
}

export function slurpProductionPhoto(style: SlurpProductionStyle): string {
  return {
    homemade: "personal snapshot, ordinary available light",
    polished: "carefully composed personal photograph, deliberate lighting and framing",
    documentary: "observational personal photograph, available light and unembellished framing",
    theatrical: "deliberately staged personal photograph, controlled lighting and expressive composition",
  }[style];
}

/** The profile as prompt text, for the post. */
export function slurpProductionInstruction(profile: SlurpProductionProfile): string {
  return ["# How you make things", profile.transparency].join("\n");
}
