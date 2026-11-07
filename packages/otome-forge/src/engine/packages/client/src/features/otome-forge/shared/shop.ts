// ──────────────────────────────────────────────
// Otome Hearth: the Shop in Wish (#2128): its gifts, the love interests' figurines, their prices and wire shapes
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles: the server charges by these numbers (S/routes/shop.ts applyPurchase) and the
// client shows them. A gift is unlimited (bought one at a time, kept as a count per gift) and is given on a date or a
// birthday (#2153); the aphrodisiac is offered only under NSFW Heat (giftsFor), which the server enforces too. Each love interest has one
// figurine, bought once, that then stands on Home and whose purchase writes a one-scene Character Story,
// `story-figurine-<li>` (S/items/character-story.ts figurineStoryChapter). Buying never calls a model; with an image
// connection it starts the figurine's one paid image (#2138, S/art/figurine.ts), cut out of its backdrop once painted.
// The gift names here are English and model-facing (date and birthday prompts); the client names gifts through its own literal map
// of ui.otomeForge.shop.* keys (C/components/GiftArt.tsx GIFT_NAME_KEYS).
import type { LiId, Paint } from "./api-types";
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

/** The extra affection a gift given on a date or a birthday earns: a fifth of its price. */
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

const FIGURINE_SCENE = "story-figurine-";

/** The chapter key of a love interest's figurine scene: a Character Story (`story-`), with no banner item behind it. */
export const figurineSceneKey = (li: LiId) => `${FIGURINE_SCENE}${li}`;

/** The love interest whose figurine scene a chapter key is, or null for any other chapter. */
export const figurineLiOf = (key: string): LiId | null =>
  key.startsWith(FIGURINE_SCENE) ? key.slice(FIGURINE_SCENE.length) || null : null;

// ── Wire shapes ──

/** A gift on the Shop's shelf. */
export interface ShopGiftView {
  id: GiftId;
  price: number;
  /** How many the protagonist owns. */
  owned: number;
}

/** A figurine's picture as the client shows it (#2138, S/art/figurine.ts figurinePicture). */
export interface FigurinePicture {
  /**
   * Its paint, once bought with an image connection or painted by a tap: pending, waiting-consent (Ask before painting
   * or prompt review), failed, stopped (a restart) or ready; null before.
   */
  art: Paint | null;
  /** The figurine as shown: its cut-out once made, else the painted image; absent until it is painted. */
  url?: string;
  /** Its cut-out is being made: read again shortly. */
  cutting: boolean;
}

/** A love interest's figurine on the Shop's shelf. */
export interface ShopFigurineView extends FigurinePicture {
  li: LiId;
  name: string;
  accent: string;
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
export interface OwnedFigurineView extends FigurinePicture {
  li: LiId;
  story: { key: string };
}
