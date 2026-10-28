// ──────────────────────────────────────────────
// Otome Forge: Wish (plan §1.11 "Wish rates", M4 "Wish server"): banners, items, pity and their wire shapes
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles: the server rolls and charges by these numbers (S/wish/pull.ts), and the
// client shows the exact pity count and the costs from them. A regression pins every number here
// (tests/otome-forge-pity.regression.ts), so a change is always on purpose.
//
// The roll is Gacha Forge's (server.mjs `MA`, the summon-rates regression) with Otome's constants: a 5★ chance of 1.5%
// that, from pull 46, rises by (1 − 1.5%) / 15 a pull, so pull 60 is certain; a 4★ chance of 10% with every 10th pull
// a 4★ at least; a 5★ resets both counters. There is no 50/50: the 5★ is always the banner's featured item, and the
// 4★ and 3★ are uniform over their lists. Pity is kept per banner kind and carries over from banner to banner, so an
// Echo (a past banner, never expired) pulls on the same counter. The design's "7.5% per pull from 46" would reach
// 100% at pull 59, so it could not also be "guaranteed at 60"; this keeps "guaranteed at 60" (flagged for the
// maintainer). Duplicate refunds are a proposal.
import type { LiId, Paint } from "./api-types";
import { TEN_WISH_COST, WISH_COST } from "./economy";

export const BANNER_KINDS = ["memories", "his-wardrobe", "my-wardrobe"] as const;
export type BannerKind = (typeof BANNER_KINDS)[number];

export function isBannerKind(value: unknown): value is BannerKind {
  return typeof value === "string" && (BANNER_KINDS as readonly string[]).includes(value);
}

/** Banners rotate every 14 days, counted from the world's creation day; a rotation is created on the next Wish open. */
export const ROTATION_DAYS = 14;

export const FIVE_STAR_RATE = 0.015;
/** The pull number from which the 5★ chance rises. */
export const SOFT_PITY_FROM = 46;
/** The pull number that is always a 5★. */
export const HARD_PITY = 60;
export const FOUR_STAR_RATE = 0.1;
/** Every 10th pull without a 4★ or 5★ is a 4★. */
export const FOUR_STAR_EVERY = 10;

export type Rarity = 3 | 4 | 5;
/** Starlight back for an item already owned (proposal). */
export const DUPLICATE_REFUNDS: Record<Rarity, number> = { 5: 400, 4: 60, 3: 10 };

export const PULL_COUNTS = [1, 10] as const;
export type PullCount = (typeof PULL_COUNTS)[number];

/** How many items of each rarity a banner holds. */
export const BANNER_SIZES = { five: 1, four: 3, three: 6 } as const;

/** GF's counter names: `count` pulls since the last 5★, `since4` pulls since the last 4★ or 5★. */
export interface PityCounter {
  count: number;
  since4: number;
}

export const freshPity = (): PityCounter => ({ count: 0, since4: 0 });

/** The 5★ chance of the next pull after `count` pulls without one (GF's interpolation, Otome's constants). */
export function fiveStarChance(count: number): number {
  const pull = Math.max(0, Math.trunc(count) || 0) + 1;
  if (pull >= HARD_PITY) return 1;
  if (pull < SOFT_PITY_FROM) return FIVE_STAR_RATE;
  return FIVE_STAR_RATE + (pull - SOFT_PITY_FROM + 1) * ((1 - FIVE_STAR_RATE) / (HARD_PITY - SOFT_PITY_FROM + 1));
}

/**
 * One pull on `counter` (GF's `MA`): the rarity and the counter after it. `random` is Math.random in play; a seeded one
 * in the regressions. Two draws at most, in GF's order: the 5★ first, then (when that misses) the 4★.
 */
export function rollRarity(
  counter: PityCounter,
  random: () => number = Math.random,
): { rarity: Rarity; pity: PityCounter } {
  if (random() < fiveStarChance(counter.count)) return { rarity: 5, pity: freshPity() };
  const count = counter.count + 1;
  const since4 = counter.since4 + 1;
  if (since4 >= FOUR_STAR_EVERY || random() < FOUR_STAR_RATE) return { rarity: 4, pity: { count, since4: 0 } };
  return { rarity: 3, pity: { count, since4 } };
}

/** What the client shows: "5★ in 23" (the pull that is certain to be one, counting this one) and the 4★ likewise. */
export interface PityView {
  fiveIn: number;
  fourIn: number;
}

export function pityView(counter: PityCounter): PityView {
  return {
    fiveIn: Math.max(1, HARD_PITY - counter.count),
    fourIn: Math.max(1, FOUR_STAR_EVERY - counter.since4),
  };
}

/** The Starlight one pull, or ten, costs (SH/economy.ts: 100 each, no discount for ten). */
export const wishCost = (count: PullCount) => (count === 10 ? TEN_WISH_COST : WISH_COST);

// ── Days and rotations (day keys are "YYYY-MM-DD", the kit's forgeDayKey in the request's time zone) ──

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** Days since 1970-01-01 for a day key; NaN for anything else. */
export function dayNumber(dayKey: string): number {
  const match = DAY_KEY.exec(dayKey);
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS : Number.NaN;
}

/** The day key `days` after `dayKey`. */
export function addDays(dayKey: string, days: number): string {
  return new Date((dayNumber(dayKey) + days) * DAY_MS).toISOString().slice(0, 10);
}

/** `floor(days(created → today) / 14)`; 0 before or on the creation day, or for a day key that does not read. */
export function rotationOf(createdDay: string, today: string): number {
  const days = dayNumber(today) - dayNumber(createdDay);
  return Number.isFinite(days) && days > 0 ? Math.floor(days / ROTATION_DAYS) : 0;
}

/** The first and last day of rotation `rotation`. */
export function rotationWindow(createdDay: string, rotation: number): { startsDay: string; endsDay: string } {
  const startsDay = addDays(createdDay, rotation * ROTATION_DAYS);
  return { startsDay, endsDay: addDays(startsDay, ROTATION_DAYS - 1) };
}

/** `${kind}-${rotation}`: a banner's key, and its document id's tail. */
export const bannerKey = (kind: BannerKind, rotation: number) => `${kind}-${rotation}`;

const BANNER_KEY = /^(memories|his-wardrobe|my-wardrobe)-(0|[1-9]\d{0,5})$/;

export function parseBannerKey(value: unknown): { kind: BannerKind; rotation: number } | null {
  const match = typeof value === "string" ? BANNER_KEY.exec(value) : null;
  return match ? { kind: match[1] as BannerKind, rotation: Number(match[2]) } : null;
}

// ── Items ──

/**
 * memory5: a CG, a 3–5 beat Character Story and a voiced line · moment4: a one-beat Moment · snapshot3: a 2–3 sentence
 * vignette (his Love Timeline and his private memory) · his-look5: his look, a first-wear beat and repainted faces ·
 * his-look4: another love interest's look · her-look5: her look, a couple set with his · her-look4: a look of hers.
 */
export const ITEM_KINDS = [
  "memory5",
  "moment4",
  "snapshot3",
  "his-look5",
  "his-look4",
  "her-look5",
  "her-look4",
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_RARITY: Record<ItemKind, Rarity> = {
  memory5: 5,
  moment4: 4,
  snapshot3: 3,
  "his-look5": 5,
  "his-look4": 4,
  "her-look5": 5,
  "her-look4": 4,
};

/** What each banner kind holds at each rarity. */
export const BANNER_ITEM_KINDS: Record<BannerKind, { five: ItemKind; four: ItemKind; three: ItemKind }> = {
  memories: { five: "memory5", four: "moment4", three: "snapshot3" },
  "his-wardrobe": { five: "his-look5", four: "his-look4", three: "snapshot3" },
  "my-wardrobe": { five: "her-look5", four: "her-look4", three: "snapshot3" },
};

/** True for the looks (a his-look is his or another love interest's; a her-look is the protagonist's). */
export const isLookKind = (kind: ItemKind) => kind.includes("-look");

/** An item's slot on its banner: `f` the 5★, `a1`–`a3` the 4★s, `s1`–`s6` the Snapshots. */
export type ItemSlot = "f" | `a${1 | 2 | 3}` | `s${1 | 2 | 3 | 4 | 5 | 6}`;

/**
 * `${bannerKey}-${slot}` (e.g. `memories-3-f`): an item's id, the tail of its document id, and of its Character
 * Story's chapter key `story-<itemId>`. Ids follow the banner, so writing a banner twice never makes two items.
 */
export const itemIdOf = (key: string, slot: ItemSlot) => `${key}-${slot}`;

const ITEM_ID = /^(?:memories|his-wardrobe|my-wardrobe)-(?:0|[1-9]\d{0,5})-(?:f|a[1-3]|s[1-6])$/;

export function isItemId(value: unknown): value is string {
  return typeof value === "string" && ITEM_ID.test(value);
}

/** The banner key an item id belongs to. */
export const bannerKeyOfItem = (itemId: string) => itemId.replace(/-(?:f|a[1-3]|s[1-6])$/, "");

/** A look's name (the world's language) and its English, visual-only outfit line. */
export interface ItemLook {
  name: string;
  outfitLine: string;
}

/**
 * `${R}:item:${itemId}`: written with its banner (P20); `art`, `story` and `voicedLine` are filled on first open
 * (S/items/open.ts). Hidden from the client: `cg` (an English brief) and, until owned, a Snapshot's `text`.
 */
export interface Item {
  id: string;
  kind: ItemKind;
  /** The banner key it was written for. */
  banner: string;
  /** Whose item it is: the love interest it is about or for; null for a look of the protagonist's own (her-look4). */
  li: LiId | null;
  title: string;
  /** memory5 and moment4: the situation, never a plot turn; how close they are follows their stage when opened. */
  premise?: string;
  /** snapshot3: the vignette. */
  text?: string;
  look?: ItemLook;
  /** her-look5: the item id of his look it pairs with (the his-wardrobe banner's 5★ of the same rotation). */
  coupleWith?: string;
  /** memory5: the key image's English brief and the names of the people in it (at most 3), as a beat's `cg`. */
  cg?: { brief: string; cast: string[] };
  art: Paint | null;
  /** The Character Story (memory5), Moment (moment4) or first-wear beat (his-look5), once written. */
  story: { key: string } | null;
  voicedLine?: string;
  createdAt: string;
}

/** `${R}:banner:${kind}-${rotation}`. `art` is the featured item's art, painted when the banner is created. */
export interface Banner {
  key: string;
  kind: BannerKind;
  rotation: number;
  startsDay: string;
  endsDay: string;
  featuredLi: LiId;
  items: { five: string[]; four: string[]; three: string[] };
  /** Null without an image connection (the client shows a gradient in his accent colour). */
  art: Paint | null;
  createdAt: string;
  connectionId: string;
  model: string;
}

// ── Wire shapes ──

/** An item as the client sees it: no CG brief, and a Snapshot's text only once owned. */
export interface ItemView {
  id: string;
  kind: ItemKind;
  rarity: Rarity;
  banner: string;
  li: LiId | null;
  title: string;
  premise?: string;
  text?: string;
  look?: { name: string };
  coupleWith?: string;
  owned: boolean;
  art: Paint | null;
  story: { key: string } | null;
  voicedLine?: string;
}

export interface BannerView {
  key: string;
  kind: BannerKind;
  rotation: number;
  startsDay: string;
  endsDay: string;
  featuredLi: LiId;
  /** The featured item's title. */
  title: string;
  /** True for a past banner (an Echo): still pullable, on the same pity. */
  echo: boolean;
  five: ItemView;
  four: ItemView[];
  three: ItemView[];
  art: Paint | null;
}

/** A love interest's Memory Selector: at affection 10, once, claim one of their Memories from an Echo not owned yet. */
export interface SelectorView {
  li: LiId;
  /** Level 10 reached and not used yet. */
  available: boolean;
  used: boolean;
  /** Their memory5 items on Echoes (past rotations' banners) that are not owned (only while available). */
  choices: ItemView[];
}

/** GET /runs/:run/wish */
export interface WishView {
  starlight: number;
  /** The current rotation's banners, in BANNER_KINDS order (fewer until POST .../wish/open creates them). */
  banners: BannerView[];
  /** Past banners, newest first. */
  echoes: BannerView[];
  pity: Record<BannerKind, PityView>;
  /** Banners are being created right now (an open is running): ask again shortly. */
  creating: boolean;
  /** The current rotation's kinds that have no banner yet: Wish open creates them. */
  missing: BannerKind[];
  rotation: { number: number; startsDay: string; endsDay: string };
  selectors: SelectorView[];
}

/** POST /runs/:run/wish/open: the view, and each kind whose banner could not be created (open again to retry). */
export interface WishOpenResult {
  wish: WishView;
  failed: Array<{ kind: BannerKind; code: string }>;
}

export interface PullResult {
  item: ItemView;
  rarity: Rarity;
  /** False for a duplicate, which refunds `refund` Starlight instead. */
  isNew: boolean;
  refund: number;
}

/** POST /runs/:run/wish/pull {banner, count, requestId?}. A retried requestId answers with the same pull. */
export interface WishPullResponse {
  results: PullResult[];
  starlight: number;
  pity: Record<BannerKind, PityView>;
}

/** POST /runs/:run/selector/:li {item} */
export interface SelectorResult {
  item: ItemView;
  selector: SelectorView;
}
