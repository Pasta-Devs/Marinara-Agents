/**
 * The image draft for one post: short, positive, English sentences an image model can draw.
 *
 * Pure and deterministic, like the other Slurp rule modules.
 *
 * ## History
 *
 * This used to be a page of rules for a language model ("Describe the photograph, not the scene.
 * Never use a camera position nobody present could have reached …") that an image-prompt rewrite
 * was meant to turn into a picture. On a reasoning connection the rewrite never finished, so the
 * rules went to the image model as they were, were cut at 1500 characters, and the scene the post
 * model had planned was lost behind them. A diffusion model also reads a negation as a subject:
 * "no second body" draws one.
 *
 * The scene the post call writes is now the picture. This module only orders it and adds the
 * camera, effort, and level as plain visual phrases. Appearance and style are added later, where
 * the Creator's look and the Engine style profile are known.
 */
import type { SlurpPostVariation } from "./slp-post-variation.js";
import type { SlurpExplicitLevel } from "./slp-post-guidance.js";
import { slurpIsLegacyImageBrief } from "../../base/media/slp-image-prompt.js";
import type { SlpWardrobeScene } from "../../../../../shared/src/slp/slp-wardrobe.js";

/** What the picture may show, as a positive phrase. What it may not show goes to the negative prompt. */
const LEVEL_PHOTO: Record<SlurpExplicitLevel, string> = {
  none: "fully clothed, relaxed and non-sexual",
  suggestive: "flirty and a little suggestive, clothed or partly undressed",
  nudity: "nude or partly nude, posing for their own page",
  explicit: "explicit adult content, one person only",
};

/** Negative-prompt terms per level. The image provider honours these far better than prose rules. */
const LEVEL_NEGATIVE: Record<SlurpExplicitLevel, string> = {
  none: "nudity, lingerie, cleavage, sexual content",
  suggestive: "nudity, nipples, genitals, sexual act",
  nudity: "sexual act, genitals",
  explicit: "",
};

/** Always true for a Creator's own photo: one person, no stray body parts. */
// The phone and a doubled Creator are what the prompt side kept producing (0.2.74 on prod: a phone
// in 37 of 46 pictures, a second copy of the Creator beside every few mirrors).
const SHARED_NEGATIVE =
  "second person, extra people, duplicate person, twins, extra limbs, disembodied hands, smartphone, holding phone, selfie stick, text, watermark";

export function slurpImageNegativePrompt(level: SlurpExplicitLevel): string {
  return [LEVEL_NEGATIVE[level], SHARED_NEGATIVE].filter(Boolean).join(", ");
}

function sentence(value: string | null | undefined): string {
  const text =
    value
      ?.replace(/\s+/gu, " ")
      .trim()
      .replace(/[.;,]+$/u, "") ?? "";
  return text ? `${text}.` : "";
}

/**
 * What a later callback needs to keep from this photo: place, clothes, and light. Stored on the
 * shoot instead of the whole draft, so a callback never nests an earlier draft inside its own.
 */
export function slurpShootContinuity(input: {
  scene?: SlpWardrobeScene | null;
  outfit?: string | null;
}): string | null {
  const text = [
    sentence(input.scene?.setting),
    input.outfit?.trim() ? sentence(`Wearing ${input.outfit.trim()}`) : "",
    sentence(input.scene?.visualDirection),
  ]
    .filter(Boolean)
    .join(" ");
  return text || null;
}

export function slurpImageBrief(input: {
  /** From `slurpCameraSourceShot`: framing and how the photo was taken, as a visual phrase. */
  cameraPhoto: string;
  variation: SlurpPostVariation;
  /** A Story is a picture with one line under it, so the picture has to carry the post alone. */
  story?: boolean;
  /**
   * An earlier shoot this picture came out of. Its place, clothes, and light replace today's; the
   * action and expression still come from this post's scene.
   */
  shoot?: { place: string; company: string; brief?: string } | null;
  /** From `slurpEffortPhoto`. */
  effortPhoto?: string;
  /** What this post may show, already resolved from the Creator's dial and the post's access. */
  sexualLevel: SlurpExplicitLevel;
  /** This Creator's own look and life. See `SlpCreatorStageFacts`. */
  stageFacts?: { wardrobe?: string; locations?: string };
  scene?: SlpWardrobeScene | null;
  selectedWardrobe?: { name: string; description: string } | null;
}): string {
  const shootBrief =
    input.shoot?.brief &&
    !slurpIsLegacyImageBrief(input.shoot.brief) &&
    !/\b(?:same (?:outfit|clothes|place|shoot)|earlier (?:shoot|photo|picture)|established (?:outfit|clothing|appearance))\b/iu.test(
      input.shoot.brief,
    )
      ? input.shoot.brief
      : "";
  const outfit =
    input.selectedWardrobe?.description?.trim() ||
    input.scene?.outfit?.trim() ||
    input.stageFacts?.wardrobe?.trim() ||
    "";
  const place = input.shoot ? shootBrief || input.shoot.place : input.scene?.setting?.trim() || input.variation.place;
  return [
    sentence(input.scene?.action || input.variation.moment),
    sentence(input.scene?.expression),
    // A callback keeps the shoot's clothes; its continuity text already names them.
    !shootBrief && outfit ? sentence(`Wearing ${outfit}`) : "",
    sentence(place),
    input.shoot && shootBrief ? "" : sentence(input.scene?.visualDirection),
    sentence(
      [input.cameraPhoto, input.story ? "vertical story photo" : "", input.effortPhoto].filter(Boolean).join(", "),
    ),
    sentence(LEVEL_PHOTO[input.sexualLevel]),
    "The only person in the photo.",
  ]
    .filter(Boolean)
    .join("\n");
}
