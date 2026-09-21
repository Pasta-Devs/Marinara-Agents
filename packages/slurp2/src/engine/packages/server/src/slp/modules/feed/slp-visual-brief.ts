import type { SlurpPostAxes } from "./slp-content-axes.js";
import type { SlurpPostVariation } from "./slp-post-variation.js";
import type { SlurpVisualBrief } from "../../base/media/slp-visual-brief.js";

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
}): SlurpVisualBrief {
  const place = input.shoot?.place ?? input.variation.place;
  const company = input.shoot?.company ?? input.variation.company;
  const action = input.shoot?.brief
    ? "continuing the same shoot with the same clothing and light"
    : input.variation.moment;
  const intent = input.axes?.intent;
  return {
    subject: "the Creator",
    action,
    setting: place,
    company,
    clothing: input.shoot?.brief ? null : "the Creator's established clothing for this moment",
    camera: input.cameraInstruction,
    mood: input.effortInstruction ?? null,
    // Adult page guidance can shape writing tone, but it cannot turn an ordinary visual situation
    // into explicit content. Explicit visual content must come from the planned scene itself.
    sexualLevel: intent === "teaser" ? "suggestive" : "none",
  };
}
