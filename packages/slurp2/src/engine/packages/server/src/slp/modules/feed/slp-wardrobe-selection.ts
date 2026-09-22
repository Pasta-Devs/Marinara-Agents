import {
  formatSlpWardrobeCloset,
  slpWardrobeLookFits,
  type SlpWardrobeLook,
  type SlpWardrobeScene,
} from "../../../../../shared/src/slp/slp-wardrobe.js";

export type SlurpWardrobeSelection = {
  look: SlpWardrobeLook | null;
  requestedId: string | null;
  fallback: boolean;
};

export function slurpWardrobePrompt(
  looks: readonly SlpWardrobeLook[],
  access: "public" | "locked",
  recentIds: readonly string[],
): string | null {
  const enabled = looks.filter((look) => look.enabled);
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
}): SlurpWardrobeSelection {
  const requestedId = input.scene?.wardrobeId?.trim() || null;
  const requested = requestedId ? input.looks.find((look) => look.id === requestedId) : null;
  if (requested && slpWardrobeLookFits(requested, input.access)) {
    return { look: requested, requestedId, fallback: false };
  }
  const recent = input.recentIds ?? [];
  const recency = new Map(recent.map((id, index) => [id, index]));
  const compatible = input.looks.filter((look) => slpWardrobeLookFits(look, input.access));
  compatible.sort((left, right) => {
    const leftRecent = recency.has(left.id) ? recent.length - recency.get(left.id)! : 0;
    const rightRecent = recency.has(right.id) ? recent.length - recency.get(right.id)! : 0;
    return leftRecent - rightRecent || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
  });
  return { look: compatible[0] ?? null, requestedId, fallback: Boolean(requestedId || compatible.length) };
}
