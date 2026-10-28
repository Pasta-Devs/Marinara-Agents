/**
 * Rewriting prepared posts after the player changed a Creator's steering.
 *
 * Pure. Posts already written for the reserve keep the old mood and focus. The app asks first
 * ("3 posts are already prepared. Rewrite them to match? (4 AI calls)") and nothing happens
 * without the answer. See `features/creators/slp-steering-routes.ts`.
 */
import type { SlpCreatorSteering } from "../../../../../shared/src/slp/slp-creator-steering.js";
import type { SlurpBeat } from "./slp-post-beat.js";

/** Steering that changes what a post says. Pace changes when they post; ideas wait for the next post. */
const CONTENT_FIELDS = ["mood", "lifePhase", "focus", "push", "avoid", "turnOns", "hardNoes"] as const;

export function slurpSteeringContentChanged(before: SlpCreatorSteering, after: SlpCreatorSteering): boolean {
  return CONTENT_FIELDS.some((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

/**
 * The posts a rewrite would touch and the AI calls it would cost: one text call per post, plus a
 * picture call where the post had a picture drawn for it. A prepared post that is already due is
 * left alone: it goes out before a rewrite could land.
 */
export function slurpPreparedRewriteCost(
  items: readonly {
    creatorAccountId: string;
    state: string;
    publishAt: string;
    imagePrompt?: unknown;
  }[],
  creatorAccountId: string,
  at: Date,
): { posts: number; calls: number } {
  const mine = items.filter(
    (item) =>
      item.creatorAccountId === creatorAccountId &&
      item.state === "prepared" &&
      Date.parse(item.publishAt) > at.getTime(),
  );
  const pictures = mine.filter((item) => typeof item.imagePrompt === "string" && item.imagePrompt.trim()).length;
  return { posts: mine.length, calls: mine.length + pictures };
}

/**
 * Whether a rewritten slot may drop its plan and be planned again under the new steering. A plan
 * that carries a promise, a campaign stage, a storyline chapter, one of the player's ideas, or a
 * collab / brand deal / rivalry keeps its reason: only the words are written again.
 */
export function slurpPlanRewritable(
  plan: { sourceEventId: string | null; beat: SlurpBeat | null } | null,
  claimedByCampaign: boolean,
): boolean {
  return (
    Boolean(plan) &&
    !plan!.sourceEventId &&
    !claimedByCampaign &&
    plan!.beat?.anchorKind !== "arc" &&
    !plan!.beat?.nudgeId &&
    !plan!.beat?.tie
  );
}
