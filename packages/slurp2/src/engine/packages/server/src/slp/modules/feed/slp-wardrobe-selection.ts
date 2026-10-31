import {
  formatSlpWardrobeCloset,
  slpWardrobeForPicture,
  slpWardrobeLookFits,
  type SlpWardrobeLook,
  type SlpWardrobeScene,
} from "../../../../../shared/src/slp/slp-wardrobe.js";
import { slurpPostIsBare } from "./slp-image-brief.js";
import type { SlurpExplicitLevel, SlurpPostAccess } from "./slp-post-guidance.js";
import { slpResolveCardMacros } from "../../base/prompting/slp-prompt-safety.js";

export type SlurpWardrobeSelection = {
  look: SlpWardrobeLook | null;
  requestedId: string | null;
  fallback: boolean;
};

/** The wardrobe look IDs the given posts used. */
export function slurpRecentLookIds(posts: readonly { metadata: Record<string, unknown> }[]): string[] {
  return posts.flatMap((post) =>
    typeof post.metadata.wardrobeLookId === "string" ? [post.metadata.wardrobeLookId] : [],
  );
}

/**
 * The closet a post chooses from, and whether its picture shows the body. A picture that shows the
 * body (nudity or explicit, once access and intent have capped the level) is dressed by an everyday
 * look, so only intimate looks are offered, and no everyday look is the fallback. Without a scene
 * plan (`scene` false) nothing is chosen.
 */
export function slurpPostCloset(
  looks: readonly SlpWardrobeLook[],
  post: { level: SlurpExplicitLevel; access: SlurpPostAccess; intent?: string; scene: boolean },
): { looks: SlpWardrobeLook[]; bare: boolean } {
  const bare = slurpPostIsBare(post);
  return { looks: post.scene ? slpWardrobeForPicture(looks, bare) : [], bare };
}

export function slurpWardrobePrompt(
  looks: readonly SlpWardrobeLook[],
  access: "public" | "locked",
  recentIds: readonly string[],
  creatorName: string,
): string | null {
  // Engine macros (`{{char}}`, `{{random::…}}`) resolve per post, so a look can vary between posts.
  const enabled = looks
    .filter((look) => look.enabled)
    .map((look) => ({ ...look, summary: slpResolveCardMacros(look.summary, creatorName) }));
  if (enabled.length === 0) return null;
  return [
    "# Creator wardrobe",
    "Choose exactly one suitable look by its ID for an image post. You can see the full enabled closet; public/locked/both says where each look may be used.",
    "Avoid recently used looks unless this post deliberately continues the same set. Never invent a wardrobe ID.",
    `This post is ${access}.`,
    recentIds.length
      ? `Recently used look IDs, newest first: ${recentIds.join(", ")}`
      : "No saved look has been used recently.",
    formatSlpWardrobeCloset(enabled),
  ].join("\n");
}

export function resolveSlurpWardrobeSelection(input: {
  looks: readonly SlpWardrobeLook[];
  access: "public" | "locked";
  scene?: SlpWardrobeScene | null;
  recentIds?: readonly string[];
  creatorName: string;
  /** The picture shows the body: only a look the writer named is used, never a fallback over its outfit. */
  bare?: boolean;
}): SlurpWardrobeSelection {
  const resolve = (look: SlpWardrobeLook): SlpWardrobeLook => ({
    ...look,
    description: slpResolveCardMacros(look.description, input.creatorName),
  });
  const requestedId = input.scene?.wardrobeId?.trim() || null;
  const requested = requestedId ? input.looks.find((look) => look.id === requestedId) : null;
  if (requested && slpWardrobeLookFits(requested, input.access)) {
    return { look: resolve(requested), requestedId, fallback: false };
  }
  if (input.bare) return { look: null, requestedId, fallback: Boolean(requestedId) };
  const recent = input.recentIds ?? [];
  const recency = new Map(recent.map((id, index) => [id, index]));
  const compatible = input.looks.filter((look) => slpWardrobeLookFits(look, input.access));
  compatible.sort((left, right) => {
    const leftRecent = recency.has(left.id) ? recent.length - recency.get(left.id)! : 0;
    const rightRecent = recency.has(right.id) ? recent.length - recency.get(right.id)! : 0;
    return leftRecent - rightRecent || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
  });
  return {
    look: compatible[0] ? resolve(compatible[0]) : null,
    requestedId,
    fallback: Boolean(requestedId || compatible.length),
  };
}
