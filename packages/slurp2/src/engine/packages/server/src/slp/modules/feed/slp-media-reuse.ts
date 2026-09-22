/**
 * Which earlier picture a post may reuse.
 *
 * Pure and deterministic, like the other Slurp rule modules.
 *
 * ## The problem
 *
 * "Old photo", "one more from that shoot", and "preview of the set" were prompt text. The model was
 * told the picture was older and then a brand-new one was generated, so a callback never actually
 * showed the shoot it claimed to come from.
 *
 * ## The approach
 *
 * Reuse picks a real earlier picture and the caller copies its bytes into the new post. A copy,
 * never a shared file: deleting one post removes its media, and that must not break another.
 *
 * Paid content is the one hard rule. A picture from a locked post is only ever reused in another
 * locked post, except as a cropped preview — and that crop is cut from the bytes on the server,
 * never shown whole and hidden with CSS.
 */

import { slurpWeightedPick } from "./slp-weighted.js";

export type SlurpReusablePost = {
  id: string;
  access: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

/** How old an archive picture has to be. Reposting yesterday's photo as "an old one" is a lie. */
export const SLURP_ARCHIVE_MIN_AGE_MS = 3 * 24 * 60 * 60_000;
/** How recent a locked set has to be for a preview of it to still be selling something. */
export const SLURP_PREVIEW_MAX_AGE_MS = 3 * 24 * 60 * 60_000;

export type SlurpReuseKind = "shoot" | "archive" | "preview";

function hasMedia(post: SlurpReusablePost): boolean {
  const path = post.metadata?.noodlerMediaPath;
  return typeof path === "string" && path.length > 0;
}

function isStory(post: SlurpReusablePost): boolean {
  return post.metadata?.noodlerPostType === "story";
}

/**
 * The pictures a new post may draw from.
 *
 * - `shoot`: pictures already posted from this shoot. A callback shows the shoot it names.
 * - `archive`: this Creator's older pictures.
 * - `preview`: recent locked pictures, for a public teaser. Only ever used through a server crop.
 *
 * `access` is the new post's access. Outside `preview`, a locked picture never reaches a public post.
 */
export function slurpReuseCandidates(
  posts: readonly SlurpReusablePost[],
  input: { kind: SlurpReuseKind; access: string; at: Date; shootId?: string | null },
): SlurpReusablePost[] {
  const now = input.at.getTime();
  return posts.filter((post) => {
    if (!hasMedia(post) || isStory(post)) return false;
    const age = now - Date.parse(post.createdAt);
    if (!Number.isFinite(age) || age < 0) return false;
    if (input.kind === "preview") {
      return post.access === "locked" && input.access === "public" && age <= SLURP_PREVIEW_MAX_AGE_MS;
    }
    // A locked picture in a public post gives the paid content away.
    if (post.access === "locked" && input.access !== "locked") return false;
    if (input.kind === "shoot") return Boolean(input.shootId) && post.metadata?.shootId === input.shootId;
    return age >= SLURP_ARCHIVE_MIN_AGE_MS;
  });
}

/** One candidate, chosen deterministically so a retry picks the same picture. */
export function slurpPickReuse(
  candidates: readonly SlurpReusablePost[],
  creatorAccountId: string,
  sequence: number,
): SlurpReusablePost | null {
  if (candidates.length === 0) return null;
  return slurpWeightedPick(
    "reuse",
    creatorAccountId,
    sequence,
    candidates.map((value) => ({ value, weight: 1 })),
  );
}

/**
 * The region a cropped preview keeps: a centred window a little under half of each side.
 *
 * Enough to recognise the set, not enough to be the set. Returned in pixels for `sharp.extract`.
 */
export function slurpPreviewCrop(
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  const cropWidth = Math.max(1, Math.round(width * 0.45));
  const cropHeight = Math.max(1, Math.round(height * 0.45));
  return {
    left: Math.max(0, Math.round((width - cropWidth) / 2)),
    top: Math.max(0, Math.round((height - cropHeight) / 2)),
    width: cropWidth,
    height: cropHeight,
  };
}
