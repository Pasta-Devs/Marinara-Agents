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
import type { SlurpExplicitLevel } from "./slp-post-guidance.js";
import type { SlpWardrobeScene } from "../../../../../shared/src/slp/slp-wardrobe.js";

/**
 * What the picture may show, as one line the image model can act on.
 *
 * A single blanket "do not add exposed skin, undress, lingerie, or sexual emphasis" used to sit
 * here on every post. On a page whose premise is that people pay for exactly that, it was the
 * wrong default, and it was also the only thing said about the subject — so the posts that were
 * allowed to be sexual had no ceiling either.
 */
const LEVEL_LINES: Record<SlurpExplicitLevel, string> = {
  none: "This picture is not sexual. Do not add exposed skin, undress, lingerie, or sexual emphasis the situation above did not already call for.",
  suggestive:
    "This picture may be flirty and knowingly posed for the people who follow this page: clothed or partly undressed, suggestive rather than explicit. No nudity, no genitals, no sexual act.",
  nudity:
    "This picture may show them nude or partly nude, the way this page's paid posts do. Nudity on its own, not a sexual act, and never a second person's body.",
  explicit:
    "This picture may be explicit, the way this page's paid posts are. It is still one photograph this person took of themselves, so whatever it shows is their own body and nobody else's.",
};

export function slurpImageBrief(input: {
  /** From `slp-camera-source.ts`: who is holding the camera, and what that forbids. */
  cameraInstruction: string;
  variation: SlurpPostVariation;
  /** A Story is a picture with one line under it, so the picture has to carry the post alone. */
  story?: boolean;
  /**
   * An earlier shoot this picture came out of. When present it replaces today's place and company:
   * the photograph was taken then, so it cannot show where the Creator is standing now.
   */
  shoot?: { place: string; company: string; brief?: string } | null;
  /** From `slp-production-profile.ts`: how much work went into this picture. */
  effortInstruction?: string;
  /** What this post may show, already resolved from the Creator's dial and the post's access. */
  sexualLevel: SlurpExplicitLevel;
  /** This Creator's own look and life. See `SlpCreatorStageFacts`. */
  stageFacts?: { wardrobe?: string; locations?: string };
  scene?: SlpWardrobeScene | null;
  selectedWardrobe?: { name: string; description: string } | null;
}): string {
  const place = input.shoot?.place ?? input.scene?.setting?.trim() ?? input.variation.place;
  const company = input.shoot?.company ?? input.variation.company;
  return [
    input.shoot
      ? "One photograph this person took at an earlier shoot and is posting now."
      : "One photograph this person took and posted.",
    input.cameraInstruction,
    // Her own places, so "somewhere other than where she usually posts from" has something to be
    // other than. Without this the model picks a generic room and the axis has nothing to move.
    ...(input.stageFacts?.locations?.trim()
      ? [`The places she is usually in: ${input.stageFacts.locations.trim()}`]
      : []),
    `Where: ${place}.`,
    ...(input.shoot
      ? []
      : [`What they are in the middle of: ${input.scene?.action?.trim() || input.variation.moment}.`]),
    `Who is around: ${company}.`,
    // The drop's own brief, so the clothes and light match the picture subscribers already saw.
    input.shoot?.brief ? `Same shoot, same clothes and light as this earlier picture: ${input.shoot.brief}` : "",
    // Clothes she owns rather than whatever the image model reaches for. Skipped on a continuing
    // shoot, where the clothes are already fixed by the drop's own brief above.
    ...(!input.shoot?.brief && input.selectedWardrobe
      ? [`Chosen look — ${input.selectedWardrobe.name}: ${input.selectedWardrobe.description}`]
      : !input.shoot?.brief && input.stageFacts?.wardrobe?.trim()
        ? [
            `What she wears: ${input.stageFacts.wardrobe.trim()}. Dress her from this unless the situation says otherwise.`,
          ]
        : []),
    ...(input.scene?.expression?.trim() ? [`Expression and body language: ${input.scene.expression.trim()}.`] : []),
    ...(input.scene?.visualDirection?.trim()
      ? [
          `Creative visual direction: ${input.scene.visualDirection.trim()}. Keep it compatible with the camera and company above.`,
        ]
      : []),
    input.effortInstruction ?? "",
    input.story
      ? "This is a Story, so the picture has to carry the post on its own, but it is still a phone picture and not a production."
      : "",
    // Stated on every post, at whatever the level is. Left unsaid, the rewrite reliably adds
    // undress and a flattering light the situation never called for, which is what made unrelated
    // Creators share one viewer gaze.
    LEVEL_LINES[input.sexualLevel],
  ]
    .filter(Boolean)
    .join("\n");
}
