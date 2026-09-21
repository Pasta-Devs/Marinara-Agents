/**
 * The three separate axes of a planned Slurp post.
 *
 * One list used to mix what a post is for with how it is delivered: `story` sat beside `teaser`
 * and `boundary`, so a Story could never also be a thank-you. The axes are kept apart so every
 * combination the rules allow can be expressed.
 *
 * - Intent: why the Creator posts.
 * - Delivery: how the content reaches the feed.
 * - Workflow: what happens to the planned opportunity. Not every state creates a post.
 */

export const SLURP_CONTENT_INTENTS = [
  "casual",
  "teaser",
  "set",
  "behind_the_scenes",
  "request",
  "appreciation",
  "callback",
  "business",
] as const;
export type SlurpContentIntent = (typeof SLURP_CONTENT_INTENTS)[number];

export const SLURP_CONTENT_DELIVERIES = [
  "text_only",
  "new_capture",
  "existing_media",
  "story",
  "multi_image_set",
  "cropped_preview",
] as const;
export type SlurpContentDelivery = (typeof SLURP_CONTENT_DELIVERIES)[number];

export const SLURP_CONTENT_WORKFLOWS = [
  "planned",
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
  "completed",
] as const;
export type SlurpContentWorkflow = (typeof SLURP_CONTENT_WORKFLOWS)[number];

export function isSlurpContentIntent(value: unknown): value is SlurpContentIntent {
  return typeof value === "string" && (SLURP_CONTENT_INTENTS as readonly string[]).includes(value);
}

export function isSlurpContentDelivery(value: unknown): value is SlurpContentDelivery {
  return typeof value === "string" && (SLURP_CONTENT_DELIVERIES as readonly string[]).includes(value);
}

export function isSlurpContentWorkflow(value: unknown): value is SlurpContentWorkflow {
  return typeof value === "string" && (SLURP_CONTENT_WORKFLOWS as readonly string[]).includes(value);
}
