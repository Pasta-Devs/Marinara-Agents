// ──────────────────────────────────────────────
// Otome Hearth: the Shop in Wish (#2128): its gifts, the love interests' figurines, their prices and wire shapes
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles: the server charges by these numbers (S/routes/shop.ts applyPurchase) and the
// client shows them. A gift is unlimited (bought one at a time, kept as a count per gift) and is given on a date; the
// aphrodisiac is offered only under NSFW Heat (giftsFor), which the server enforces too. Each love interest has one
// figurine, bought once: a small model-drawn SVG of them (S/minigames/plush.ts, as their plush is drawn) that then
// stands on Home, and whose purchase writes a one-scene Character Story, `story-figurine-<li>`
// (S/items/character-story.ts figurineStoryChapter). Buying never calls a model.
// The gift names here are English and model-facing (date prompts); the client names gifts through its own literal map
// of ui.otomeForge.shop.* keys (C/components/GiftArt.tsx GIFT_NAME_KEYS).
import type { LiId } from "./api-types";
import { intimacyOpen, type ContentSettings } from "./content";

export const GIFT_IDS = ["flowers", "chocolates", "wine", "aphrodisiac"] as const;
export type GiftId = (typeof GIFT_IDS)[number];

/** Starlight per gift (the maintainer's, 2026-11-06: between 100 and 1,000 each). */
export const GIFT_PRICES: Readonly<Record<GiftId, number>> = {
  flowers: 200,
  chocolates: 300,
  wine: 600,
  aphrodisiac: 1000,
};

/** The extra affection a gift given on a date earns: a fifth of its price. */
export const GIFT_AFFECTION: Readonly<Record<GiftId, number>> = {
  flowers: 40,
  chocolates: 60,
  wine: 120,
  aphrodisiac: 200,
};

/** Each gift as the date prompts name it. English, never localized. */
export const GIFT_PROMPT_NAMES: Readonly<Record<GiftId, string>> = {
  flowers: "a bouquet of flowers",
  chocolates: "a box of chocolates",
  wine: "a bottle of wine",
  aphrodisiac: "an aphrodisiac",
};

/** One love interest's figurine, bought once. */
export const FIGURINE_COST = 5000;

export function isGiftId(value: unknown): value is GiftId {
  return typeof value === "string" && (GIFT_IDS as readonly string[]).includes(value);
}

/**
 * The gifts offered and given under these content settings, in shelf order: the aphrodisiac only under NSFW Heat
 * (intimacyOpen, which enforceContent keeps behind the 18+ confirmation). One bought earlier stays owned when Heat is
 * lowered, and is neither offered nor given until it is raised again.
 */
export function giftsFor(content: Pick<ContentSettings, "heat">): GiftId[] {
  return GIFT_IDS.filter((gift) => gift !== "aphrodisiac" || intimacyOpen(content));
}

/** The chapter key of a love interest's figurine scene: a Character Story (`story-`), with no banner item behind it. */
export const figurineSceneKey = (li: LiId) => `story-figurine-${li}`;

// ── Wire shapes ──

/** A gift on the Shop's shelf. */
export interface ShopGiftView {
  id: GiftId;
  price: number;
  /** How many the protagonist owns. */
  owned: number;
}

/** A love interest's figurine on the Shop's shelf. */
export interface ShopFigurineView {
  li: LiId;
  name: string;
  accent: string;
  /** The drawn figurine as a data URL (shown only as an <img>), once drawn. */
  art?: string;
  /** Its drawing waits or runs in the background: read the Shop again shortly. */
  drawing: boolean;
  owned: boolean;
  /** Its scene, once bought. */
  story?: { key: string };
}

/** GET /runs/:run/shop. */
export interface ShopView {
  starlight: number;
  /** The gifts offered under the story's Heat. */
  gifts: ShopGiftView[];
  /** One per love interest, in cast order. */
  figurines: ShopFigurineView[];
  figurineCost: number;
}

/** POST /runs/:run/shop/gifts {gift, requestId?} and POST /runs/:run/shop/figurines/:li {requestId?}. */
export interface ShopBuyResult {
  starlight: number;
  shop: ShopView;
  /** A figurine's scene, ready to play. */
  story?: { key: string };
}

/** The protagonist's gifts and figurines, as the Wardrobe lists them (WardrobeView `gifts`, `figurines`). */
export interface OwnedFigurineView {
  li: LiId;
  /** The drawn figurine as a data URL, once drawn. */
  art?: string;
  story: { key: string };
}
