import type { SlurpPostAxes } from "./slp-content-axes.js";
import type { SlurpPostVariation } from "./slp-post-variation.js";
import type { SlurpVisualBrief } from "../../base/media/slp-visual-brief.js";
import { slurpPostSexualLevel, type SlurpExplicitLevel, type SlurpPostAccess } from "./slp-post-guidance.js";
import type { SlpWardrobeScene } from "../../../../../shared/src/slp/slp-wardrobe.js";

/**
 * The typed visual contract between post planning and image prompt writing.
 *
 * The brief holds scene facts. Image style, stable appearance, and provider wording are added later.
 * This keeps a global image instruction from changing the scene decided by the post planner.
 */
export function slurpVisualBriefFromSituation(input: {
  variation: SlurpPostVariation;
  axes: Pick<SlurpPostAxes, "intent"> | null | undefined;
  cameraInstruction: string;
  effortInstruction?: string;
  shoot?: { place: string; company: string; brief?: string } | null;
  story?: boolean;
  /** Who can read the post. A locked post is the one somebody paid for. */
  access: SlurpPostAccess;
  /** This Creator's ceiling, from the post guidance blob. */
  explicitLevel: SlurpExplicitLevel;
  scene?: SlpWardrobeScene | null;
  clothing?: string | null;
}): SlurpVisualBrief {
  const place = input.shoot?.place ?? input.scene?.setting?.trim() ?? input.variation.place;
  const company = input.shoot?.company ?? input.variation.company;
  // A callback still has this post's own action; only place, clothes, and light come from the shoot.
  const action = input.scene?.action?.trim() || input.variation.moment;
  const intent = input.axes?.intent;
  return {
    subject: "the Creator",
    action,
    setting: place,
    company,
    clothing: input.shoot?.brief ? null : input.clothing?.trim() || null,
    camera: input.cameraInstruction,
    mood:
      [input.scene?.expression, input.scene?.visualDirection, input.effortInstruction].filter(Boolean).join("; ") ||
      null,
    // This used to be decided by the intent alone: teasers were suggestive and everything else was
    // "none". That put the whole feed at "none" apart from the teasers, every locked post
    // included. The level is now the Creator's own, stepped down for anything unpaid.
    sexualLevel: slurpPostSexualLevel({ level: input.explicitLevel, access: input.access, intent }),
  };
}
