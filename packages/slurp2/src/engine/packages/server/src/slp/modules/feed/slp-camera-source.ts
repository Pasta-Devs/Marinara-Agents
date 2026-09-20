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

const RULES: Record<SlurpCameraSource, CameraSourceRule> = {
  selfie: {
    instruction:
      "Camera: their own phone, held in their own hand. The camera can be no further away than their arm reaches, and the holding arm is visible or clearly implied. No angle they could not reach while holding it.",
  },
  mirror: {
    instruction:
      "Camera: their own phone, photographed in a mirror. The phone is visible in the reflection and partly covers them. The framing is whatever the mirror allows, not whatever flatters them.",
  },
  tripod: {
    instruction:
      "Camera: propped up or on a timer, and they walked into frame. They are not holding a phone. The camera does not move, so the framing is fixed and a little too wide, and they had to place it somewhere a real surface exists.",
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
      "Camera: none today. This is an older picture out of their own camera roll, so it does not match today's place, light, or clothes, and they know that.",
  },
};

/**
 * The rule every source shares.
 *
 * Stated as a prohibition rather than a preference, because the image model reliably reintroduces
 * the unexplained angle when this is phrased softly.
 */
export const SLURP_CAMERA_SOURCE_RULE =
  "Describe the photograph, not the scene. Never use a camera position nobody present could have reached: no floor-level, overhead, or across-the-room shot unless the camera source above put a camera there. The picture may be badly framed, poorly lit, partly blocked, or dull. Do not improve it.";

/** The sources this variation can actually pay for. */
export function slurpPermittedCameraSources(options: { companyCanHoldCamera: boolean }): readonly SlurpCameraSource[] {
  return SLURP_CAMERA_SOURCES.filter((source) => !RULES[source].needsHelper || options.companyCanHoldCamera);
}

/**
 * How often each camera turns up.
 *
 * A phone in your own hand is how most pictures on earth are taken, so it dominates. The rest are
 * occasional by nature: setting up a timer is a decision, somebody else holding the camera needs
 * somebody else, and posting an old picture is a thing people do sometimes rather than weekly.
 *
 * These are weights rather than rotation slots on purpose. Six sources in a rotation meant an old
 * photo every sixth post forever, which stops being "sometimes she posts an old one" and becomes
 * her posting schedule.
 */
const WEIGHTS: Record<SlurpCameraSource, number> = {
  selfie: 42,
  mirror: 22,
  tripod: 14,
  screenshot: 10,
  archive: 7,
  partner: 5,
};

/** How much a Creator's own habits bend the odds. Enough to be their habit, not enough to be a rule. */
const PREFERENCE_MULTIPLIER = 2.5;

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
  options: { companyCanHoldCamera: boolean; prefers?: readonly SlurpCameraSource[] },
): SlurpCameraSource {
  const prefers = options.prefers ?? [];
  return slurpWeightedPick(
    "camera",
    creatorAccountId,
    sequence,
    slurpPermittedCameraSources(options).map((value) => ({
      value,
      weight: WEIGHTS[value] * (prefers.includes(value) ? PREFERENCE_MULTIPLIER : 1),
    })),
  );
}

/** The source as prompt text. One block, so the caller does not assemble it in three places. */
export function slurpCameraSourceInstruction(source: SlurpCameraSource): string {
  return `${RULES[source].instruction}\n${SLURP_CAMERA_SOURCE_RULE}`;
}
