/**
 * How long one shoot lasts.
 *
 * Pure constants and one pure instruction builder, kept out of the storage module so the rules can
 * be checked without a database.
 *
 * A Creator who moves through four cinematic locations in an afternoon reads as a script. Real
 * creator output arrives in batches: one afternoon, one outfit, one room, several posts spread
 * over days. A set drop opens a shoot and later posts draw from it, which is what lets a caption
 * say "one more from yesterday" and have the picture actually match.
 */
import type { SlurpCameraSource } from "./slp-camera-source.js";
import { slurpIsLegacyImageBrief } from "../../base/media/slp-image-prompt.js";

/**
 * Posts one shoot can produce, including the drop that opened it.
 *
 * Three, not more: a shoot that supplies a week of posts stops being continuity and becomes the
 * repetition `slp-post-variation.ts` exists to prevent.
 */
export const SLURP_SHOOT_MAX_SHOTS = 3;

/** A shoot goes stale after two days. "One more from yesterday" three weeks later is its own lie. */
export const SLURP_SHOOT_MAX_AGE_MS = 2 * 24 * 60 * 60_000;

/** Only the newest shoot is ever read, so a Creator needs very few kept. */
export const SLURP_SHOOT_KEEP_PER_CREATOR = 5;

/**
 * The shoot as prompt text.
 *
 * States the gap out loud. Without it the model writes the callback as if the picture were taken
 * just now, which puts the Creator back in yesterday's room wearing yesterday's clothes with no
 * explanation — exactly the teleporting the shoot was meant to cure.
 */
export function slurpShootInstruction(shoot: {
  place: string;
  company: string;
  cameraSource: SlurpCameraSource;
  shotsUsed: number;
  /** Place, clothes, and light of the shoot, from `slurpShootContinuity`. */
  brief?: string | null;
}): string {
  const brief = shoot.brief?.trim() && !slurpIsLegacyImageBrief(shoot.brief) ? shoot.brief.trim() : "";
  return [
    "# This one is from an earlier shoot",
    "You are posting another picture from something you already shot, not something happening now. Say so the way a person would, and do not describe it as if you were there this minute.",
    `That shoot was: ${shoot.place}, ${shoot.company}.`,
    ...(brief ? [`The shoot's place, clothes, and light: ${brief}`] : []),
    "The picture keeps that shoot's place, clothes, and light, so the scene's setting and outfit stay the same and only the pose and expression change. The rule against repeating a recent setting does not apply to this post. Your caption is written now, so it may talk about anything.",
    shoot.shotsUsed > 1 ? "You have already posted from this one, so do not introduce it again from scratch." : "",
  ]
    .filter(Boolean)
    .join("\n");
}
