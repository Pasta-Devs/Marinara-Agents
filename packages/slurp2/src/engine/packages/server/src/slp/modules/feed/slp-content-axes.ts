/**
 * What a post is for, how it is delivered, and what happens to the plan behind it.
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
 * The intent is chosen before anything is written, and it decides what the caption is *for* — not
 * what it says. An intent never supplies a scene, for the same reason a variation never supplies
 * one: the Creator's own life has to answer.
 *
 * The delivery is chosen separately. A thank-you can be a Story or a plain text post; a set is
 * never text-only. Keeping the two apart is what lets a post be both.
 *
 * Stories come out of the format rotation in `slp-post-variation.ts`, and free teaser posts come
 * out of `slurpTeaserPost`. `slurpPostAxes` takes both as given, so the three decisions cannot
 * contradict each other.
 */

import type {
  SlurpContentDelivery,
  SlurpContentIntent,
  SlurpContentWorkflow,
} from "../../../../../shared/src/slp/slp-content-axes.js";
import type { SlpCreatorContentFormat } from "../../base/prompting/slp-content-format.js";
import { slurpContentDeliveryFits, slurpIntentFitsAccess } from "../../../../../shared/src/slp/slp-content-axes.js";
import { slurpWeightedPick } from "./slp-weighted.js";

/**
 * What each intent asks the caption to do.
 *
 * Written as the job, never as a scene or a line to copy. Several of these deliberately ask for
 * less: a feed where every entry resolves into a meaning is the thing being fixed.
 */
const JOBS: Record<SlurpContentIntent, string> = {
  casual:
    "This one is not selling anything. Talk about your actual day like a person with a life outside this, and let it be dull.",
  teaser:
    "This one is bait. Show enough that somebody wants the rest, say less than you want to, and do not resolve it.",
  set: "This is a planned shoot you have been working on. You may say it took effort, that there is more of it, or when the rest lands.",
  behind_the_scenes:
    "Show the work. A setup, a retake, an outtake, a shoot that went wrong, or how long something actually took.",
  request:
    "Somebody asked for this. Say so, in the way you would to a regular, without naming anyone or quoting a private message.",
  appreciation: "This is for the people who stayed. Say thank you plainly and do not turn it into a sale.",
  callback:
    "This continues something you already posted. Assume they remember it and do not explain it from the beginning.",
  business:
    "This is housekeeping: a limit, a schedule, a price, a quiet week, an absence, or something that is running late. Be straightforward and do not apologise twice.",
};

/** What each delivery changes about the caption. Absent where the delivery changes nothing. */
const DELIVERY_NOTES: Partial<Record<SlurpContentDelivery, string>> = {
  text_only: "There is no picture with this one. Do not describe one, promise one, or apologise for not having one.",
  story: "This goes up as a Story: throwaway, one line at most, gone tomorrow.",
  existing_media: "The picture is one you took earlier. Do not pretend it was taken just now.",
  multi_image_set: "Several pictures from one shoot go up together. Introduce them once, not one by one.",
  cropped_preview: "The picture is cropped on purpose. The full one is for subscribers.",
};

/**
 * Which deliveries each intent may use.
 *
 * A set is a shoot, so it always has pictures. A callback continues a picture, so it has one too.
 * A cropped preview exists only to sell something, so only a teaser uses it. Everything else is
 * open, because a thank-you or a schedule notice can be delivered almost any way.
 */
export function slurpDeliveryFits(intent: SlurpContentIntent, delivery: SlurpContentDelivery): boolean {
  return slurpContentDeliveryFits(intent, delivery);
}

/**
 * How often each intent turns up.
 *
 * `teaser` is absent because it is already decided elsewhere, and choosing it again here would let
 * the two decisions disagree.
 *
 * Ordinary life is most of it. A feed where every entry is a sale reads exactly as false as one
 * where every entry is a confession, and the thing a person mostly does is have a day.
 *
 * The bottom of this list is the reason these are weights and not rotation slots. Ten slots meant
 * one boundary post every ten, which at four posts a day is a Creator announcing a limit every
 * second afternoon. A business post lands because it is rare; on a schedule it is just nagging.
 */
const INTENT_WEIGHTS: Record<Exclude<SlurpContentIntent, "teaser">, number> = {
  casual: 38,
  set: 16,
  callback: 13,
  request: 10,
  behind_the_scenes: 9,
  appreciation: 8,
  business: 6,
};

/**
 * How often an intent goes out with no picture, out of 100, when pictures are available.
 *
 * Text-only was only ever what happened when image generation was off or failed. A person also
 * posts words on purpose: a schedule note does not need a selfie, and neither does "thank you".
 */
const TEXT_ONLY_WEIGHTS: Record<SlurpContentIntent, number> = {
  casual: 25,
  teaser: 10,
  set: 0,
  behind_the_scenes: 15,
  request: 10,
  appreciation: 30,
  callback: 0,
  business: 60,
};

/** The shipped weights with the Creator's saved ones applied. All zero means "use the shipped ones". */
function intentOptions(saved: Partial<Record<SlurpContentIntent, number>> | undefined) {
  const shipped = Object.entries(INTENT_WEIGHTS).map(([value, weight]) => ({
    value: value as SlurpContentIntent,
    weight,
  }));
  const options = shipped.map((option) => ({ ...option, weight: saved?.[option.value] ?? option.weight }));
  return options.some((option) => option.weight > 0) ? options : shipped;
}

/** Weights that make one intent certain, for a purpose the player chose. */
export function slurpOnlyIntent(intent: SlurpContentIntent): Partial<Record<SlurpContentIntent, number>> {
  return Object.fromEntries(Object.keys(INTENT_WEIGHTS).map((key) => [key, key === intent ? 1 : 0]));
}

export type SlurpPostAxes = { intent: SlurpContentIntent; delivery: SlurpContentDelivery };

/**
 * The intent and delivery for one post.
 *
 * `story` and `teaser` are passed in rather than chosen, because the format rotation and the
 * access rotation already decided them. `images` is whether this post can have a picture at all.
 *
 * Drawn rather than rotated, so the sequence has no period and consecutive posts are unrelated
 * instead of adjacent. Two ordinary days in a row are allowed on purpose: forcing every post to
 * differ from the last one reads as a schedule just as clearly as repeating does.
 *
 * Reuse is decided afterwards by `slurpReuseDelivery`, because it depends on which real pictures
 * exist. Sets, callbacks, and requests may draw a multi-image delivery from one shoot.
 */
export function slurpPostAxes(
  creatorAccountId: string,
  sequence: number,
  decided: {
    story?: boolean;
    teaser?: boolean;
    images: boolean;
    /** This Creator's saved weights, from `slp-creator-strategy.ts`. Absent intents keep theirs. */
    intentWeights?: Partial<Record<SlurpContentIntent, number>>;
    /** Out of 100, from the same place. Scales every intent's lean on words. */
    textOnlyRate?: number;
    /** Who will be able to read this. A locked post never teases what the reader already owns. */
    access?: "public" | "locked";
  },
): SlurpPostAxes {
  // A Story can be a thank-you or a request as well as a passing moment. It cannot be a set or a
  // callback: both need a shoot, and a Story is taken now.
  const options = intentOptions(decided.intentWeights).filter(
    (option) =>
      (!decided.story || (option.value !== "set" && option.value !== "callback")) &&
      slurpIntentFitsAccess(option.value, decided.access ?? "public"),
  );
  const intent: SlurpContentIntent = decided.teaser
    ? "teaser"
    : slurpWeightedPick(
        "contentType",
        creatorAccountId,
        sequence,
        options.some((option) => option.weight > 0) ? options : [{ value: "casual" as const, weight: 1 }],
      );
  if (decided.story && decided.images) return { intent, delivery: "story" };
  // Without pictures every intent goes out as text, including a set: it becomes the announcement
  // of one. The caller still has no picture to attach, so claiming otherwise would be a lie.
  if (!decided.images) return { intent, delivery: "text_only" };
  // The Creator's own lean scales the shipped per-intent rates rather than replacing them: a
  // Creator who mostly writes still never sends a set out as text, because a set has no words to
  // be. 50 is the shipped balance, so an unset strategy changes nothing.
  const lean = (decided.textOnlyRate ?? 50) / 50;
  const textOnly = Math.min(90, Math.round(TEXT_ONLY_WEIGHTS[intent] * lean));
  const multiImageWeight = intent === "set" ? 45 : intent === "callback" ? 25 : intent === "request" ? 20 : 0;
  const delivery = slurpWeightedPick("delivery", creatorAccountId, sequence, [
    { value: "text_only" as const, weight: textOnly },
    { value: "new_capture" as const, weight: Math.max(0, 100 - textOnly - multiImageWeight) },
    { value: "multi_image_set" as const, weight: multiImageWeight },
  ]);
  return { intent, delivery };
}

/** The intent and delivery as prompt text. One block, so the caller does not assemble it twice. */
export function slurpContentAxesInstruction(axes: SlurpPostAxes): string {
  return [
    "# What this post is for",
    JOBS[axes.intent],
    DELIVERY_NOTES[axes.delivery] ?? "",
    // The single most visible artificial signal in the shipped feed: every post ended by inviting
    // the reader in. A creator does that sometimes, not every time.
    "Only address the reader directly if this particular post calls for it. Do not end with an invitation out of habit.",
    "This is the post's job, not its subject.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Which lengths fit each intent. The first entry is the fallback.
 *
 * The format rotation in `slp-post-variation.ts` knows nothing about intent, so it used to hand a
 * teaser ("say less than you want to") a 2,000-character long_form, and a dull ordinary day an
 * essay. The rotation still varies length; the intent only rules out the lengths that contradict
 * its job.
 */
const FORMATS: Record<SlurpContentIntent, readonly SlpCreatorContentFormat[]> = {
  casual: ["caption"],
  teaser: ["caption"],
  callback: ["caption"],
  appreciation: ["caption", "announcement"],
  request: ["caption", "announcement"],
  set: ["caption", "announcement"],
  behind_the_scenes: ["caption", "announcement", "long_form"],
  business: ["announcement", "caption"],
};

/** The rotated format if it fits this intent, otherwise the intent's own default. */
export function slurpIntentFormat(
  intent: SlurpContentIntent | undefined,
  rotated: SlpCreatorContentFormat,
): SlpCreatorContentFormat {
  if (!intent) return rotated;
  const allowed = FORMATS[intent];
  return allowed.includes(rotated) ? rotated : allowed[0]!;
}

/**
 * Where a planned opportunity may go next.
 *
 * `planned` is the only open state. The publishing states finish as `completed`; every other state
 * is final. A state that is not listed has no way out, which is what stops a skipped slot from
 * later producing a post.
 */
const WORKFLOW_NEXT: Partial<Record<SlurpContentWorkflow, readonly SlurpContentWorkflow[]>> = {
  planned: [
    "publish",
    "text_only",
    "reuse_media",
    "fulfill",
    "tease",
    "delay",
    "decline",
    "ignore",
    "skip",
    "cancelled",
  ],
  publish: ["completed", "cancelled"],
  text_only: ["completed", "cancelled"],
  reuse_media: ["completed", "cancelled"],
  fulfill: ["completed", "cancelled"],
  tease: ["completed", "cancelled"],
  // A delay is a promise to come back, so it is the one decision that reopens.
  delay: ["planned", "cancelled"],
};

export function slurpWorkflowCanMove(from: SlurpContentWorkflow, to: SlurpContentWorkflow): boolean {
  return WORKFLOW_NEXT[from]?.includes(to) ?? false;
}

/** The states that end in a feed post. The rest consume the slot and publish nothing. */
const PUBLISHING: ReadonlySet<SlurpContentWorkflow> = new Set([
  "publish",
  "text_only",
  "reuse_media",
  "fulfill",
  "tease",
]);

export function slurpWorkflowPublishes(state: SlurpContentWorkflow): boolean {
  return PUBLISHING.has(state);
}

/**
 * Whether this post reuses a real earlier picture instead of taking a new one.
 *
 * Run after `slurpPostAxes`, with what actually exists. A callback mostly shows the shoot it names;
 * a public teaser often shows a cropped corner of a recent locked set; anything else now and then
 * reposts an older picture. Text-only, Story, and set posts are left alone: a set is new work, and
 * a Story is taken now.
 */
export function slurpReuseDelivery(
  axes: SlurpPostAxes,
  available: { shoot: boolean; archive: boolean; preview: boolean },
  creatorAccountId: string,
  sequence: number,
): SlurpPostAxes {
  if (axes.delivery !== "new_capture") return axes;
  const draw = (reuse: number) =>
    slurpWeightedPick("reuseDelivery", creatorAccountId, sequence, [
      { value: true, weight: reuse },
      { value: false, weight: 100 - reuse },
    ]);
  if (axes.intent === "callback" && available.shoot && draw(60)) return { ...axes, delivery: "existing_media" };
  if (axes.intent === "teaser" && available.preview && draw(50)) return { ...axes, delivery: "cropped_preview" };
  if (
    axes.intent !== "set" &&
    axes.intent !== "callback" &&
    available.archive &&
    slurpDeliveryFits(axes.intent, "existing_media") &&
    draw(12)
  ) {
    return { ...axes, delivery: "existing_media" };
  }
  return axes;
}
