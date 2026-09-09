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
 * A variation supplies an **axis to differ along**, never a concrete scene. "Somewhere other than
 * where you usually post" lets the character's own life answer; "at a train station" would
 * overwrite it.
 * That is what keeps this from fighting the character card, and it is the maintainer's brief:
 * the same person, a different part of their life.
 *
 * Variations rotate rather than being drawn at random, so consecutive posts cannot land on the same
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
 * The shipped content formats.
 *
 * Auto-posting only ever used the first. Rotating them is the cheapest single change to the feed:
 * length and shape stop being constant even before the situation does.
 */
export const SLURP_POST_FORMATS = ["caption", "announcement", "long_form"] as const;

export type SlurpPostFormat = (typeof SLURP_POST_FORMATS)[number];

/**
 * Weighted rotation. A creator page is mostly short captions, so the long formats appear but do
 * not take over: a feed of essays is as monotonous as a feed of one-liners.
 */
// Length stays at eight and the story slots below are all even, so replacing the two `teaser`
// slots (1 and 5, both odd) changes which formats appear without touching Story placement.
// `teaser` is gone: it asked the model to leave a hook to a linked locked post that nothing could
// ever create, so every teaser shipped a promise the feed did not keep.
const FORMAT_CYCLE: readonly SlurpPostFormat[] = [
  "caption",
  "announcement",
  "caption",
  "announcement",
  "caption",
  "caption",
  "caption",
  "long_form",
];

/** How much of a Creator's automatic output is Stories rather than feed posts. */
export const SLURP_STORY_RATE = ["off", "rare", "regular", "often"] as const;
export type SlurpStoryRate = (typeof SLURP_STORY_RATE)[number];
export const SLURP_DEFAULT_STORY_RATE: SlurpStoryRate = "regular";

/**
 * Which slots of `FORMAT_CYCLE` are published as a Story rather than a feed post.
 *
 * Indices into that cycle rather than a cycle of their own: a second cycle whose length divides
 * eight resonates with it and lands on the same formats forever, which is how the first attempt at
 * this managed to schedule exactly zero Stories. A Story is a picture with one line under it, so
 * only caption slots (0, 2, 4, 6) may be listed — an announcement or a long_form Story is a wall of
 * text in a tall frame.
 *
 * `regular` is two of the eight, roughly one Story a day at the default four posts, which is what a
 * shelf that expires in twenty-four hours needs. `off` is a real off switch, not a quieter version.
 */
export function slurpStorySlots(rate: SlurpStoryRate | undefined): ReadonlySet<number> {
  switch (rate ?? SLURP_DEFAULT_STORY_RATE) {
    case "off":
      return new Set();
    case "rare":
      return new Set([6]);
    case "often":
      return new Set([0, 2, 4, 6]);
    default:
      return new Set([2, 6]);
  }
}

/** How much of a Creator's automatic output belongs to a project rather than standing alone. */
export const SLURP_PROJECT_RATE = ["off", "rare", "regular", "often"] as const;
export type SlurpProjectRate = (typeof SLURP_PROJECT_RATE)[number];
export const SLURP_DEFAULT_PROJECT_RATE: SlurpProjectRate = "regular";

/**
 * Which slots of `FORMAT_CYCLE` carry a project post rather than a loose one.
 *
 * Odd slots only, because `slurpStorySlots` uses even ones. Keeping the two sets disjoint means a
 * project post is never also a Story: a Story is a picture with one line under it, which is the
 * worst possible place to move a story on, and a slot that had to satisfy both would silently
 * drop one of them.
 *
 * `regular` is two of the eight, so a project claims roughly one post in four and the feed still
 * reads as a life rather than as a serial. `off` is a real off switch.
 */
export function slurpProjectSlots(rate: SlurpProjectRate | undefined): ReadonlySet<number> {
  switch (rate ?? SLURP_DEFAULT_PROJECT_RATE) {
    case "off":
      return new Set();
    case "rare":
      return new Set([3]);
    case "often":
      return new Set([1, 3, 5, 7]);
    default:
      return new Set([1, 5]);
  }
}

export type SlurpPostVariation = {
  format: SlurpPostFormat;
  /**
   * Publish this variation as a Story. Advisory: the caller must clear it when the run produces no
   * image, because a Story with no picture is not a Story.
   */
  story: boolean;
  place: string;
  moment: string;
  framing: string;
  company: string;
};

/**
 * The variation for one post.
 *
 * `sequence` is how many posts this Creator has already made. Rotating on it — rather than drawing
 * at random — is what guarantees consecutive posts differ, which random selection does not.
 *
 * The offset by creator id stops two Creators set up on the same day from marching through the
 * cycle in lockstep.
 */
export function slurpPostVariation(
  creatorAccountId: string,
  sequence: number,
  storyRate: SlurpStoryRate = SLURP_DEFAULT_STORY_RATE,
): SlurpPostVariation {
  const offset = hash(creatorAccountId);
  // Math.floor(NaN) is NaN and indexes nothing, which would hand every caller an undefined variation.
  // Third time this shape has bitten in this package; guard it at the boundary rather than trust
  // the caller's arithmetic.
  const step = Number.isFinite(sequence) ? Math.max(0, Math.floor(sequence)) : 0;
  // Co-prime strides, so place, moment, framing, and company do not resynchronise into a repeating
  // combined pattern every few posts.
  const formatSlot = (offset + step) % FORMAT_CYCLE.length;
  const format = FORMAT_CYCLE[formatSlot]!;
  return {
    format,
    story: format === "caption" && slurpStorySlots(storyRate).has(formatSlot),
    place: PLACES[(offset + step) % PLACES.length]!,
    moment: MOMENTS[(offset + step * 3) % MOMENTS.length]!,
    framing: FRAMINGS[(offset + step * 5) % FRAMINGS.length]!,
    company: COMPANY[(offset + step * 2) % COMPANY.length]!,
  };
}

/** The variation as prompt text. One block, so the caller does not assemble it in three places. */
export function slurpPostVariationInstruction(variation: SlurpPostVariation): string {
  return [
    "# This post's angle",
    "Keep the person exactly as the character card describes them — face, body, style, voice. Change the situation, not the person.",
    `Place: ${variation.place}.`,
    `Moment: ${variation.moment}.`,
    `Framing for the image: ${variation.framing}.`,
    `Company: ${variation.company}.`,
    ...(variation.story
      ? [
          "This one is a Story, not a feed post: the picture carries it and the text is one short line under it. Write for something that disappears in a day, not for the profile grid.",
        ]
      : []),
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

/**
 * The project this post belongs to, or null when it stands alone.
 *
 * Selected from the same rotation the variation uses, rather than from a scheduler of its own.
 * That is what produces an interleaved feed for free — two projects and ordinary posts take turns
 * because the slots do — and it means a project cannot post twice in a row while another waits.
 *
 * `sequence` is the same post count the variation is rotated on, so the caller cannot accidentally
 * put the project and the variation out of step.
 */
export function slurpPostProject<T extends { id: string }>(
  creatorAccountId: string,
  sequence: number,
  projects: readonly T[],
  rate: SlurpProjectRate = SLURP_DEFAULT_PROJECT_RATE,
): T | null {
  if (projects.length === 0) return null;
  const step = Number.isFinite(sequence) ? Math.max(0, Math.floor(sequence)) : 0;
  const offset = hash(creatorAccountId);
  const slots = slurpProjectSlots(rate);
  if (!slots.has((offset + step) % FORMAT_CYCLE.length)) return null;
  // Which project slot this is overall, not which post. Indexing projects by `step` looks
  // equivalent and is not: consecutive project slots are a fixed distance apart, so `step` lands
  // on the same residue every time and a second project would never be chosen.
  const cycle = Math.floor(step / FORMAT_CYCLE.length);
  let ordinal = cycle * slots.size;
  for (let earlier = cycle * FORMAT_CYCLE.length; earlier < step; earlier += 1) {
    if (slots.has((offset + earlier) % FORMAT_CYCLE.length)) ordinal += 1;
  }
  return projects[ordinal % projects.length] ?? null;
}
