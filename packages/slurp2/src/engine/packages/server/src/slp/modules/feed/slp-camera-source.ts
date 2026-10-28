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
import type { SlurpPromptFamily } from "../../base/media/slp-image-prompt.js";

export const SLURP_CAMERA_SOURCES = ["selfie", "mirror", "tripod", "partner", "screenshot", "archive", "desk"] as const;

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
      "Camera: they took it themselves at arm's length, close and at about eye level or a little above. The arm reaching toward the viewer is part of the picture; the device itself stays out of the frame. No angle they could not reach.",
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
  // Slice I (user: more camera variety, fewer timer shots): a second way to shoot alone with the
  // hands free, from where they already sit, the way a live stream or a video call looks.
  desk: {
    instruction:
      "Camera: fixed at desk height straight in front of them, the look of a live stream or a video call. They sit facing it, lit by the screen or a small lamp, and the framing stays where it was set.",
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
 * Viewpoint words come in the image model's own vocabulary (PERSPECTIVE-RESEARCH.md, 2026-09-28).
 * Tag models (Pony, Illustrious, NoobAI, NovelAI, SD1.5 anime) were trained on Danbooru tags,
 * furry tag models on e621 tags; Flux, SD3, realistic checkpoints and the API models read short
 * natural phrases. `natural` is the default: plain words are harmless to a tag model, tags read
 * oddly to Flux. See `slurpPromptFamily`.
 */
type Phrase = { tags: string; e621?: string; natural: string };

/**
 * The source as words an image model can draw. Positive phrasing only: a diffusion model reads
 * "no floor-level shot" as "floor-level shot".
 *
 * No phrase names the device, the photographer, a tripod or a timer: weak models draw every noun
 * they read. A selfie shows the arm instead, the one cue the models learned without the phone
 * (about half of Danbooru's `selfie` posts also hold a phone). Only the mirror keeps the phone:
 * 95 % of `mirror_selfie` posts hold one, and fighting that drew odd hands and a second Creator.
 */
const PHOTO: Record<SlurpCameraSource, Phrase> = {
  selfie: {
    tags: "selfie, outstretched arm, reaching towards viewer, looking at viewer",
    e621: "selfie, raised arm, reaching towards viewer, looking at viewer",
    natural: "selfie, arm extended toward the viewer and cut off by the frame edge, looking straight at the viewer",
  },
  mirror: {
    tags: "mirror selfie, holding phone, reflection",
    natural: "mirror selfie, a single reflection filling the frame, phone in hand",
  },
  tripod: { tags: "arms at sides", natural: "seen from a few steps away at chest height, both hands free" },
  partner: { tags: "", natural: "unposed moment seen from a few steps away" },
  screenshot: { tags: "motion blur, blurry background", natural: "caught mid-motion, slight motion blur, soft focus" },
  // Tag models ignore "old photo"; the archive framing alone is enough for them.
  archive: { tags: "", natural: "faded older snapshot, slightly dated colours" },
  // Slice I: the hands-free desk shot, the look of a live stream or a video call.
  desk: {
    tags: "sitting, facing viewer, screen light",
    natural: "seated facing the viewer at desk height, soft screen glow on the face, stream-style framing",
  },
};

function phrase(value: Phrase, family: SlurpPromptFamily): string {
  return family === "e621" ? (value.e621 ?? value.tags) : value[family];
}

export function slurpCameraSourcePhoto(source: SlurpCameraSource, family: SlurpPromptFamily = "natural"): string {
  return phrase(PHOTO[source], family);
}

/**
 * Angle and crop. Tag models get the composition tags they were trained on (`upper body`,
 * `cowboy shot`, `from side` …), e621 models their own spellings (`bust portrait`, `rear view`),
 * natural-language models short phrases (`cowboy shot` in plain English can add a cowboy hat).
 *
 * Every source used to draw the same framing every time, so a Creator's feed was one picture
 * repeated. Each option is one the source can physically explain: an arm's-length shot is never a
 * wide shot, and only somebody else holding the camera can stand behind or below them. `pov` is
 * left out on purpose: it adds a first-person body, which the source rule forbids.
 */
const f = (tags: string, e621: string, natural: string): Phrase => ({ tags, e621, natural });
const FRAMINGS: Record<SlurpCameraSource, readonly Phrase[]> = {
  selfie: [
    f(
      "close-up, from above, looking up",
      "close-up, high-angle view, looking up",
      "close on the face and shoulders from slightly above, looking up",
    ),
    f("upper body, from above", "bust portrait, high-angle view", "waist-up from slightly above"),
    f("upper body", "bust portrait", "waist-up at eye level"),
    f("close-up, from side", "close-up, side view", "close on the face, turned a little to the side"),
    f("portrait, head tilt", "headshot portrait, head tilt", "close on the face and shoulders, head tilted"),
    f("upper body, looking back", "bust portrait, looking back", "waist-up, glancing back over one shoulder"),
  ],
  mirror: [
    f("full body", "full-length portrait", "full-length in the mirror"),
    f("cowboy shot", "three-quarter portrait", "framed from mid-thigh up in the mirror"),
    f("upper body", "bust portrait", "waist-up in the mirror"),
    f(
      "cowboy shot, from side",
      "three-quarter portrait, side view",
      "framed from mid-thigh up, body turned to the side",
    ),
  ],
  tripod: [
    f("full body, straight-on", "full-length portrait, front view", "full-length, head to toe, facing the viewer"),
    f("cowboy shot, from side", "three-quarter portrait, side view", "framed from mid-thigh up, side view"),
    f("full body, from side", "full-length portrait, side view", "full-length side view"),
    f("wide shot", "full-length portrait, wide shot", "wide shot, small in the room"),
    f("sitting, full body", "sitting, full-length portrait", "sitting, full-length"),
    f("upper body, straight-on", "bust portrait, front view", "waist-up, facing the viewer"),
    f("full body, looking away", "full-length portrait, looking away", "full-length, looking off to the side"),
    f("kneeling, full body", "kneeling, full-length portrait", "kneeling, full-length"),
    f("full body, stretching", "full-length portrait, stretching", "full-length, mid-stretch"),
  ],
  partner: [
    f("upper body, from side", "bust portrait, side view", "waist-up, side view"),
    f("cowboy shot", "three-quarter portrait", "framed from mid-thigh up"),
    f(
      "full body, from behind, looking back",
      "full-length portrait, rear view, looking back",
      "full-length, seen from behind, glancing back over one shoulder",
    ),
    f("full body, from below", "full-length portrait, low-angle view", "full-length, low-angle shot looking up"),
    f("wide shot", "full-length portrait, wide shot", "wide shot, small in the scene"),
    f("upper body, looking away", "bust portrait, looking away", "waist-up, looking off to the side"),
    f("full body, walking", "full-length portrait, walking", "full-length, caught mid-stride"),
  ],
  screenshot: [
    f("upper body", "bust portrait", "waist-up"),
    f("cowboy shot, dutch angle", "three-quarter portrait, dutch angle", "framed from mid-thigh up, tilted frame"),
    f("close-up, from side", "close-up, side view", "close on the face, side view"),
    f("full body", "full-length portrait", "full-length"),
  ],
  archive: [
    f("upper body", "bust portrait", "waist-up"),
    f("full body", "full-length portrait", "full-length"),
    f("cowboy shot", "three-quarter portrait", "framed from mid-thigh up"),
    f("portrait", "headshot portrait", "close on the face and shoulders"),
    f("upper body, from side", "bust portrait, side view", "waist-up, side view"),
  ],
  desk: [
    f("upper body", "bust portrait", "waist-up"),
    f("portrait, upper body", "headshot portrait", "close on the face and shoulders"),
    f("upper body, leaning forward", "bust portrait, leaning forward", "waist-up, leaning in toward the viewer"),
    f("upper body, head tilt", "bust portrait, head tilt", "waist-up, head tilted"),
    f("cowboy shot, sitting", "three-quarter portrait, sitting", "framed from mid-thigh up, sitting"),
  ],
};

function shotPhrase(framing: Phrase, source: SlurpCameraSource, family: SlurpPromptFamily): string {
  return [phrase(framing, family), phrase(PHOTO[source], family)].filter(Boolean).join(", ");
}

/**
 * The picture's framing and source as one phrase. `seed` is anything that differs per picture —
 * the scene's action does — so a set's shots and a Creator's posts do not all share one angle.
 *
 * The brief is written before the image connection is known, so it carries the natural phrase;
 * `slurpViewpointForFamily` swaps it for the image model's own words where the style is known.
 */
export function slurpCameraSourceShot(
  source: SlurpCameraSource,
  seed: string,
  family: SlurpPromptFamily = "natural",
): string {
  const framing = slurpWeightedPick(
    "framing",
    seed,
    0,
    FRAMINGS[source].map((value) => ({ value, weight: 1 })),
  );
  return shotPhrase(framing, source, family);
}

/** Every viewpoint phrase Slurp writes, longest first, so a lookup never stops at a shorter match. */
const VIEWPOINTS = SLURP_CAMERA_SOURCES.flatMap((source) =>
  FRAMINGS[source].map((framing) => ({ source, framing })),
).sort((a, b) => shotPhrase(b.framing, b.source, "natural").length - shotPhrase(a.framing, a.source, "natural").length);

const viewpointIn = (text: string) =>
  VIEWPOINTS.find(({ source, framing }) => text.includes(shotPhrase(framing, source, "natural")));

/** The camera source and its natural viewpoint phrase in this text, if it carries one. */
export function slurpViewpointIn(text: string): { source: SlurpCameraSource; phrase: string } | null {
  const found = viewpointIn(text);
  return found ? { source: found.source, phrase: shotPhrase(found.framing, found.source, "natural") } : null;
}

/** The prompt with its natural viewpoint phrase in the image model's own words. */
export function slurpViewpointForFamily(prompt: string, family: SlurpPromptFamily): string {
  const found = family === "natural" ? undefined : viewpointIn(prompt);
  if (!found) return prompt;
  return prompt.replace(
    shotPhrase(found.framing, found.source, "natural"),
    shotPhrase(found.framing, found.source, family),
  );
}

/**
 * What each source must keep out of the picture, for the negative prompt. One list for every
 * family: Flux and the API models ignore a negative prompt, and SD models read both spellings.
 * The mirror is the one shot where the phone belongs, so it fights a doubled Creator instead.
 */
const NEGATIVE: Record<SlurpCameraSource, string> = {
  selfie: "holding phone, smartphone, cellphone, selfie stick",
  mirror: "multiple girls, multiple boys, two people",
  tripod: "holding phone, smartphone, tripod, camera",
  partner: "photographer, holding camera, smartphone",
  screenshot: "user interface, recording, smartphone",
  archive: "smartphone, holding phone",
  desk: "webcam, monitor, holding phone, smartphone",
};

export function slurpCameraSourceNegative(source: SlurpCameraSource): string {
  return NEGATIVE[source];
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
// 0.2.79: the 7-day simulation drew a timer shot for 45 % of posts once the intent and effort
// biases stacked on 25 (the new sameness after the selfies). Timer and hand-held now start even,
// and the biases below bend less, so no camera takes more than about a quarter of a Creator's feed.
// Slice I (user): timer shots at about 15-20 % with more camera variety. A planned shoot is no
// longer mostly a timer: the desk camera is a second hands-free way to shoot alone.
const WEIGHTS: Record<SlurpCameraSource, number> = {
  selfie: 22,
  mirror: 7,
  tripod: 14,
  screenshot: 16,
  archive: 10,
  partner: 14,
  desk: 11,
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
  set: { selfie: 0.5, mirror: 0.9, tripod: 1.2, partner: 2, screenshot: 0.7, desk: 0.9 },
  teaser: { tripod: 1.05, mirror: 1.2, selfie: 0.9, desk: 1.2 },
  callback: { tripod: 1.1, selfie: 0.9, desk: 1.1 },
  behind_the_scenes: { tripod: 1.05, screenshot: 1.6, selfie: 0.9, desk: 1.2 },
  business: { selfie: 1.3, tripod: 0.6, partner: 0.5, desk: 1.4 },
  casual: { screenshot: 1.2, tripod: 0.9, desk: 1.1 },
  appreciation: { selfie: 1.1, tripod: 0.9 },
};

const EFFORT_BIAS: Record<string, Partial<Record<SlurpCameraSource, number>>> = {
  low: { screenshot: 1.5, tripod: 0.7, partner: 0.8 },
  medium: {},
  high: { selfie: 0.6, tripod: 1.2, partner: 1.6, screenshot: 0.8 },
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
