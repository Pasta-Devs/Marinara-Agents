/**
 * Who is holding the camera.
 *
 * Pure and deterministic, like the other Slurp rule modules.
 *
 * ## The problem
 *
 * A Creator posts alone, and the picture is taken from the floor looking up, or from above her
 * head, or from across the room. Nobody in the scene could have reached those positions. The feed
 * is not broken because it is staged — a creator-platform post is normally staged — it is broken
 * because it claims to be candid while using production conditions the scene never paid for.
 *
 * `slp-post-variation.ts` caused a good part of this directly. Its `FRAMINGS` axis handed out
 * "from above, looking down" and "from low, looking up" as free-floating instructions, with no
 * tripod, timer, mirror, or second person anywhere to justify them. The image model did as it was
 * told, and every Creator ended up with an invisible cameraman.
 *
 * ## The approach
 *
 * Framing stops being an independent axis and becomes a *consequence* of who is holding the
 * camera. A selfie cannot be taken from further away than an arm. A tripod shot cannot show the
 * subject holding the phone. A second person cannot hold the camera when the Creator is alone.
 *
 * So the source is chosen first, and the scene has to pay for it: `permitted` filters the sources
 * against what the rest of the variation already decided. Produce mode uses weighted draws so a
 * common phone picture stays common without making the sequence periodic.
 *
 * Deliberately staged sources are here on purpose. A tripod shoot the Creator admits to reads as
 * more real than a candid shot that could not exist. The distinction that matters is not staged
 * against real, it is credible staging against unexplained access.
 */

import { slurpWeightedPick } from "./slp-weighted.js";

export const SLURP_CAMERA_SOURCES = ["selfie", "mirror", "tripod", "partner", "screenshot", "archive"] as const;

export type SlurpCameraSource = (typeof SLURP_CAMERA_SOURCES)[number];

type CameraSourceRule = {
  /** What the photograph is, written as the photograph rather than as the scene. */
  instruction: string;
  /** Whether this source needs somebody willing who can be handed the phone. */
  needsHelper?: boolean;
};

// The device is a fact about feasibility, never an object in the scene. "Their own phone, held in
// their own hand" made the scene writer put a phone in every picture, and a visible phone reads as
// a mirror that is not there. Only the mirror source keeps the phone: it is really in the shot.
const RULES: Record<SlurpCameraSource, CameraSourceRule> = {
  selfie: {
    instruction:
      "Camera: they took it themselves, close and at about eye level. The picture shows their face and shoulders; their arm and the device stay out of the frame. No angle they could not reach.",
  },
  mirror: {
    instruction:
      "Camera: a shot of their reflection in a mirror. Only the reflection is in the picture, so there is one of them, never a second copy beside the mirror. The framing is whatever the mirror allows, not whatever flatters them.",
  },
  tripod: {
    instruction:
      "Camera: propped up or on a timer, and they walked into frame with their hands free. The camera does not move, so the framing is fixed and a little too wide, and it stands somewhere a real surface exists.",
  },
  partner: {
    instruction:
      "Camera: held by the other person who is there. It can move and it can be further away, because somebody is carrying it.",
    needsHelper: true,
  },
  screenshot: {
    instruction:
      "Camera: a still pulled out of a video, not a photo. It is softer and noisier than a photo, the pose is caught between two others, and the expression is unresolved.",
  },
  archive: {
    instruction:
      "Camera: none today. This is an older picture of theirs, so it does not match today's place, light, or clothes, and they know that.",
  },
};

/**
 * The rule every source shares, for the post call that writes the caption and the scene.
 *
 * Kept to the two facts the scene needs. The longer version ("describe the photograph, not the
 * scene", "plain and imperfect is right") went into the caption call and into every image draft;
 * the caption model turned it into the topic — nearly every post said its own picture was badly
 * framed — and the image model, which reads prose rules as things to draw, got a list of the exact
 * framings it was told to avoid. The picture side now uses `slurpCameraSourcePhoto` instead.
 */
export const SLURP_CAMERA_SOURCE_RULE =
  "The camera is a camera, never a person's eyes: no first-person or point-of-view framing. Show only the people the company names. Describe what the picture shows and how it is framed, not the device that took it.";

/**
 * The source as words an image model can draw. Positive phrasing only: a diffusion model reads
 * "no floor-level shot" as "floor-level shot".
 */
const PHOTO: Record<SlurpCameraSource, string> = {
  selfie: "close personal photo at eye level, looking at viewer",
  mirror: "reflection in a mirror filling the frame, single person",
  tripod: "self-timer photo from a nearby surface at chest height, hands free, fixed slightly wide framing",
  partner: "candid photo taken from a few steps away",
  screenshot: "still frame from a video, slight motion blur, soft focus",
  archive: "older snapshot from their own archive, slightly dated look",
};

export function slurpCameraSourcePhoto(source: SlurpCameraSource): string {
  return PHOTO[source];
}

/**
 * Angle and crop, as the composition tags image models already know (Danbooru/NovelAI vocabulary:
 * `upper body`, `cowboy shot`, `from side` …). Natural-language models read them as plain words,
 * and the optional image rewrite can restyle them, so one phrase serves both.
 *
 * Every source used to draw the same framing every time, so a Creator's feed was one picture
 * repeated. Each option is one the source can physically explain: an arm's-length shot is never a
 * wide shot, and only somebody else holding the camera can stand behind or below them. `pov` is
 * left out on purpose: it adds a first-person body, which the source rule forbids.
 */
const FRAMINGS: Record<SlurpCameraSource, readonly string[]> = {
  selfie: [
    "close-up, from above",
    "upper body, from above",
    "portrait, upper body",
    "close-up, from side",
    "portrait, head tilt",
    "upper body, looking back",
  ],
  mirror: ["full body", "cowboy shot", "upper body", "cowboy shot, from side"],
  tripod: [
    "full body, from front",
    "cowboy shot, from side",
    "full body, from side",
    "wide shot",
    "sitting, full body",
    "upper body, from front",
    "full body, looking away",
  ],
  partner: [
    "upper body, from side",
    "cowboy shot",
    "full body, from behind, looking back",
    "full body, from below",
    "wide shot",
    "upper body, candid, looking away",
    "full body, walking",
  ],
  screenshot: ["upper body", "cowboy shot, dutch angle", "close-up, from side", "full body, mid-motion"],
  archive: ["upper body", "full body", "cowboy shot", "portrait", "upper body, from side"],
};

/**
 * The picture's framing and source as one phrase. `seed` is anything that differs per picture —
 * the scene's action does — so a set's shots and a Creator's posts do not all share one angle.
 */
export function slurpCameraSourceShot(source: SlurpCameraSource, seed: string): string {
  const framing = slurpWeightedPick(
    "framing",
    seed,
    0,
    FRAMINGS[source].map((value) => ({ value, weight: 1 })),
  );
  return `${framing}, ${PHOTO[source]}`;
}

/** The sources this variation can actually pay for. */
export function slurpPermittedCameraSources(options: { companyCanHoldCamera: boolean }): readonly SlurpCameraSource[] {
  return SLURP_CAMERA_SOURCES.filter((source) => !RULES[source].needsHelper || options.companyCanHoldCamera);
}

/**
 * How often each camera turns up.
 *
 * These are weights rather than rotation slots on purpose. Six sources in a rotation meant an old
 * photo every sixth post forever, which stops being "sometimes she posts an old one" and becomes
 * her posting schedule.
 *
 * The first cut of this table reasoned from photographs in general: a phone in your own hand is
 * how most pictures on earth are taken, so selfie took 42 and mirror took 22. But a mirror shot is
 * also a phone in her own hand, so together they were two posts in three, and the feed read as one
 * person taking the same picture forever. Photographs in general is the wrong reference class —
 * this is a page somebody runs, and a page that is only arm's-length phone pictures is a page
 * nobody is working on.
 *
 * So the weights now reason from the work instead. Hand-held self-shots stay the largest share at
 * a little under half, because they are still the cheap everyday post. A propped-up phone is what
 * an actual planned picture looks like and is now close behind. A still out of a video is common
 * on a page that posts video at all, and was badly underweighted at 10. Somebody else holding the
 * camera is rare because it needs somebody else, not because it is unusual when they are there —
 * the permitted-sources filter already removes it when she is alone, so its weight should reflect
 * how often it happens *given* company.
 */
// 0.2.75: on prod, 27 of 40 pictures were selfie or mirror (68 %) once "homemade" preferences,
// casual intent and low effort stacked on 28 + 17. Mirror shots also drew the Creator twice
// (image models paint the reflection as a second person), so mirror is now occasional.
const WEIGHTS: Record<SlurpCameraSource, number> = {
  selfie: 22,
  mirror: 7,
  tripod: 25,
  screenshot: 16,
  archive: 10,
  partner: 12,
};

/**
 * How much a Creator's own habits bend the odds. Enough to be their habit, not enough to be a rule.
 *
 * Lowered with the weights below. At 2.5 against the old selfie weight, a Creator who prefers
 * selfies drew one about three posts in four, which is the monoculture again for that Creator.
 */
const PREFERENCE_MULTIPLIER = 1.4;

/**
 * What the post is for bends the odds too.
 *
 * A phone in your own hand dominates ordinary posting, but a planned shoot taken as a selfie is
 * the same unexplained-access problem in reverse: the caption says this took an afternoon and the
 * picture says she held the phone. Effort says the same thing from the production side.
 */
const INTENT_BIAS: Record<string, Partial<Record<SlurpCameraSource, number>>> = {
  set: { selfie: 0.4, mirror: 0.8, tripod: 2.2, partner: 2, screenshot: 0.6 },
  teaser: { tripod: 1.4, mirror: 1.2, selfie: 0.8 },
  callback: { tripod: 1.3, selfie: 0.9 },
  behind_the_scenes: { tripod: 1.5, screenshot: 1.6, selfie: 0.9 },
  business: { selfie: 1.3, tripod: 0.6, partner: 0.5 },
  casual: { screenshot: 1.2, tripod: 0.9 },
  appreciation: { selfie: 1.1, tripod: 0.9 },
};

const EFFORT_BIAS: Record<string, Partial<Record<SlurpCameraSource, number>>> = {
  low: { screenshot: 1.5, tripod: 0.7, partner: 0.8 },
  medium: {},
  high: { selfie: 0.5, tripod: 2, partner: 1.6, screenshot: 0.7 },
};

/**
 * The camera source for one post.
 *
 * `sequence` is how many posts this Creator has already made. It seeds a deterministic weighted
 * draw, so the same post is reproducible without forcing consecutive posts to differ.
 *
 * The rotation runs over the permitted list, so a Creator who is alone for several posts still
 * moves through the sources available to them instead of stalling on one.
 */
export function slurpPostCameraSource(
  creatorAccountId: string,
  sequence: number,
  options: {
    companyCanHoldCamera: boolean;
    prefers?: readonly SlurpCameraSource[];
    /** What this post is for, from `slp-content-axes.ts`. */
    intent?: string;
    /** How much work this picture gets, from `slp-production-profile.ts`. */
    effort?: string;
  },
): SlurpCameraSource {
  const prefers = options.prefers ?? [];
  const intentBias = (options.intent ? INTENT_BIAS[options.intent] : undefined) ?? {};
  const effortBias = (options.effort ? EFFORT_BIAS[options.effort] : undefined) ?? {};
  return slurpWeightedPick(
    "camera",
    creatorAccountId,
    sequence,
    slurpPermittedCameraSources(options).map((value) => ({
      value,
      weight:
        WEIGHTS[value] *
        (prefers.includes(value) ? PREFERENCE_MULTIPLIER : 1) *
        (intentBias[value] ?? 1) *
        (effortBias[value] ?? 1),
    })),
  );
}

/** The source as prompt text. One block, so the caller does not assemble it in three places. */
export function slurpCameraSourceInstruction(source: SlurpCameraSource): string {
  return `${RULES[source].instruction}\n${SLURP_CAMERA_SOURCE_RULE}`;
}
