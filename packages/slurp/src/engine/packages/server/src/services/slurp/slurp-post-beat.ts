/**
 * What makes this post different from the last one.
 *
 * Pure and deterministic, like the other Slurp rule modules.
 *
 * ## The problem
 *
 * Creators posted the same thing repeatedly — an office worker at her desk, in the same pose,
 * every time. Five causes, and only the last is about the model being unimaginative:
 *
 * 1. Post history showed the model `title — content` and never the image prompts, so it could not
 *    see that it had described the same desk eight times running.
 * 2. The only anti-repetition rule was "do not reuse their exact wording", which eight different
 *    captions about one desk satisfy completely.
 * 3. Nothing anywhere asked for situational variety. The generation guidance, including all three
 *    spice presets, is entirely about tone.
 * 4. Auto-posting hardcoded the `caption` format, so three of the four formats never fired.
 * 5. With no Conversation Schedule there is no situational anchor at all, so the character card is
 *    the only input — and a card that says "office worker" is constant, so the output is constant.
 *
 * ## The approach
 *
 * A beat supplies an **axis of variation**, never a concrete scene. "Somewhere other than where
 * you usually post" lets the character's own life answer; "at a train station" would overwrite it.
 * That is what keeps this from fighting the character card, and it is the maintainer's brief:
 * the same person, a different part of their life.
 *
 * Beats rotate rather than being drawn at random, so consecutive posts cannot land on the same
 * axis twice — which is exactly the failure being fixed.
 */

/** Where the post is coming from, relative to the Creator's habits. */
const PLACES = [
  "somewhere other than where this creator usually posts from",
  "in the room they spend the least time in",
  "out of the house entirely",
  "somewhere they had to travel to get to",
  "in their usual place, but from an angle they have never shown before",
  "somewhere half-packed, half-finished, or mid-move",
] as const;

/** What they are doing. Deliberately about state rather than subject matter. */
const MOMENTS = [
  "in the middle of something rather than posed for a photo",
  "just finished with something and still coming down from it",
  "about to leave and stopping for one second",
  "awake when they should not be",
  "getting ready rather than ready",
  "taking a break they did not plan",
  "having just been interrupted",
] as const;

/** How the picture is taken. This is the one that fixes "the same pose". */
const FRAMINGS = [
  "close crop, most of them out of frame",
  "wide, with the room doing most of the talking",
  "caught at an angle, not squared up to the camera",
  "in a mirror or reflection",
  "from above, looking down",
  "from low, looking up",
  "an object or a detail in the foreground, them behind it",
] as const;

/** Who else is in the world right now. Presence, never a named person. */
const COMPANY = [
  "alone and glad of it",
  "alone and not glad of it",
  "somebody else is nearby but out of frame",
  "surrounded by people who have no idea",
  "just got off a call",
] as const;

/**
 * The four shipped content formats.
 *
 * Auto-posting only ever used the first. Rotating them is the cheapest single change to the feed:
 * length and shape stop being constant even before the situation does.
 */
export const SLURP_POST_FORMATS = ["caption", "teaser", "announcement", "long_form"] as const;

export type SlurpPostFormat = (typeof SLURP_POST_FORMATS)[number];

/**
 * Weighted rotation. A creator page is mostly short captions, so the long formats appear but do
 * not take over: a feed of essays is as monotonous as a feed of one-liners.
 */
const FORMAT_CYCLE: readonly SlurpPostFormat[] = [
  "caption",
  "teaser",
  "caption",
  "announcement",
  "caption",
  "teaser",
  "caption",
  "long_form",
];

export type SlurpPostBeat = {
  format: SlurpPostFormat;
  place: string;
  moment: string;
  framing: string;
  company: string;
};

/**
 * The beat for one post.
 *
 * `sequence` is how many posts this Creator has already made. Rotating on it — rather than drawing
 * at random — is what guarantees consecutive posts differ, which random selection does not.
 *
 * The offset by creator id stops two Creators set up on the same day from marching through the
 * cycle in lockstep.
 */
export function slurpPostBeat(creatorAccountId: string, sequence: number): SlurpPostBeat {
  const offset = hash(creatorAccountId);
  // Math.floor(NaN) is NaN and indexes nothing, which would hand every caller an undefined beat.
  // Third time this shape has bitten in this package; guard it at the boundary rather than trust
  // the caller's arithmetic.
  const step = Number.isFinite(sequence) ? Math.max(0, Math.floor(sequence)) : 0;
  // Co-prime strides, so place, moment, framing, and company do not resynchronise into a repeating
  // combined pattern every few posts.
  return {
    format: FORMAT_CYCLE[(offset + step) % FORMAT_CYCLE.length]!,
    place: PLACES[(offset + step) % PLACES.length]!,
    moment: MOMENTS[(offset + step * 3) % MOMENTS.length]!,
    framing: FRAMINGS[(offset + step * 5) % FRAMINGS.length]!,
    company: COMPANY[(offset + step * 2) % COMPANY.length]!,
  };
}

/** The beat as prompt text. One block, so the caller does not assemble it in three places. */
export function slurpPostBeatInstruction(beat: SlurpPostBeat): string {
  return [
    "# This post's angle",
    "Keep the person exactly as the character card describes them — face, body, style, voice. Change the situation, not the person.",
    `Place: ${beat.place}.`,
    `Moment: ${beat.moment}.`,
    `Framing for the image: ${beat.framing}.`,
    `Company: ${beat.company}.`,
    "Let their own life supply the specifics. These are directions to vary along, not a scene to copy.",
  ].join("\n");
}

function hash(value: string): number {
  let out = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  out ^= out >>> 16;
  out = Math.imul(out, 0x85ebca6b);
  out ^= out >>> 13;
  return out >>> 0;
}
