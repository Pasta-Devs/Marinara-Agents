/**
 * What the picture shows, decided without reading the caption.
 *
 * Pure and deterministic, like the other Slurp rule modules.
 *
 * ## The problem
 *
 * One model call returned `title`, `content` and `imagePrompt` together, so the picture could only
 * ever be an illustration of the text. A post said "I am sitting in the kitchen" and the image
 * showed exactly that kitchen, pose, clothing, phone, light and expression. Captions and images
 * matched so completely that the pair read as a storyboard rather than as something a person
 * posted: a real caption often sells a different idea, hides the production, or is just a hook.
 *
 * ## The approach
 *
 * The brief is assembled from what was already decided before any text existed — who is holding
 * the camera, where the Creator is, what they are in the middle of, and who is around — and never
 * from the caption body. The caption and the picture then come from the same situation without
 * either describing the other, which is the relationship they have on a real creator page.
 *
 * ponytail: assembled rather than written by a model. The existing image-prompt rewrite is already
 * a model call and supplies appearance, style and phrasing on top of this, so a second call would
 * buy wording this does not need. If briefs start reading samey across Creators, give this its own
 * call with the production profile as input.
 */
import type { SlurpPostVariation } from "./slp-post-variation.js";

export function slurpImageBrief(input: {
  /** From `slp-camera-source.ts`: who is holding the camera, and what that forbids. */
  cameraInstruction: string;
  variation: SlurpPostVariation;
  /** A Story is a picture with one line under it, so the picture has to carry the post alone. */
  story?: boolean;
}): string {
  return [
    "One photograph this person took and posted.",
    input.cameraInstruction,
    `Where: ${input.variation.place}.`,
    `What they are in the middle of: ${input.variation.moment}.`,
    `Who is around: ${input.variation.company}.`,
    input.story
      ? "This is a Story, so the picture has to carry the post on its own, but it is still a phone picture and not a production."
      : "",
    // Without this the rewrite reliably adds undress and a flattering light that the situation
    // never called for, which is what made unrelated Creators share one viewer gaze.
    "Do not add exposed skin, undress, lingerie, or sexual emphasis that the situation above did not already call for.",
  ]
    .filter(Boolean)
    .join("\n");
}
