// ──────────────────────────────────────────────
// Otome Forge: the Wardrobe and the Album (plan M4 "Items, wardrobe and album server"): their numbers and wire shapes
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles (S/routes/{items,wardrobe,album}.ts answer with these shapes). Everyone
// starts in their base look (his setup portrait, her persona portrait); every other look is an item won on Wish, worn
// once it is painted. A her-look5 names the his-look5 it pairs with as a couple set (SH/wish.ts `coupleWith`).
// Showing a love interest one of her looks pays affection once per look and love interest (SH/economy.ts showHim,
// within the day's activity cap). A love interest may be any gender: the client names them or uses their pronouns.
import type { Favorite, LiId, Noticed, Outfit, Paint, SoundtrackTrack, TimelineEntry } from "./api-types";
import type { Face, MusicMood } from "./faces";
import type { GiftId, OwnedFigurineView } from "./shop";
import type { Arcana } from "./tarot";
import type { ItemKind, ItemView, Rarity } from "./wish";

/** The look everyone starts in. A wardrobe look id is this, or the id of the look's item. */
export const BASE_LOOK = "base";

/**
 * The image a person wears now: their worn outfit's (Wear at home), else their base portrait; "" with neither. Home
 * shows it for each side of Him / Me (S/routes/home.ts and its client), and faces (S/art/expressions.ts,
 * S/schemas/state.ts readyFaces) are painted and read on it.
 */
export function wornLookUrl(person: { outfits: readonly Outfit[]; wornOutfit?: string; portrait?: string }): string {
  const worn = person.wornOutfit ? person.outfits.find((outfit) => outfit.id === person.wornOutfit) : undefined;
  return worn?.url ?? person.portrait ?? "";
}

/** P19: what a love interest says on noticing her new look, at most this many words. */
export const NOTICED_WORDS_MAX = 20;
/** P24: his line when she shows him a look, at most this many words. */
export const SHOW_WORDS_MAX = 30;

/** Scripts written without spaces between words. */
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;

/** Words in a line, as P19 and P24 count them: space-separated, and two characters a word in a script without spaces. */
export function lineWords(text: string): number {
  return text
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .reduce((sum, token) => sum + (UNSPACED.test(token) ? Math.ceil([...token].length / 2) : 1), 0);
}

/** Whose look: the protagonist, or a love interest. */
export type WardrobeOwner = "me" | LiId;

export interface LookView {
  /** BASE_LOOK, or the look's item id (what `wornOutfit` names once it is worn). */
  id: string;
  owner: WardrobeOwner;
  /** The look's name in the world's language; "" for the base look (the client labels it). */
  name: string;
  /** Existing visual intent for this owned look, without story or Bible secrets. */
  description?: string;
  /** The item it was won as; absent for the base look. */
  item?: { kind: ItemKind; rarity: Rarity; title: string };
  /** The painted full-body image, once there is one: its saved cut-out once ready (`cut`). */
  url?: string;
  /** Its paint as the client should see it: the base look's setup portrait, or the item's first-open paint. */
  art: Paint | null;
  /** Worn now: on Home, and (his) the faces the story shows. */
  worn: boolean;
  /** Painted (the base look always is, once it has a portrait): only a painted look can be worn. */
  wearable: boolean;
  /** True while the item's first open has not happened (POST .../items/:item/open paints it). */
  unopened: boolean;
  /** His ready faces on this look, while expressions are on; each its saved cut-out once ready (`cut`). */
  faces?: Partial<Record<Face, string>>;
  /** Which of `url` and `faces` are saved cut-outs (no backdrop): shown as they are, never cleaned in the browser. */
  cut?: string[];
  /** A 5★ look (his-look5, her-look5): the first-wear beat (a one-node Character Story), once its first open wrote it. */
  story?: { key: string } | null;
  /** Her looks: the love interests already shown it, whose first Show paid its affection. */
  shownTo?: LiId[];
  /** 0.21.0: won from Wish and not looked at yet (a dot by it until it is clicked). */
  new?: true;
}

/**
 * A couple set: a her-look5 and the his-look5 it names. Shown once she owns either half. A half's `url` is its look's
 * saved cut-out once ready, which its `cut` says (shown as it is, never cleaned in the browser).
 */
export interface CoupleSet {
  his: { id: string; li: LiId | null; name: string; owned: boolean; url?: string; cut?: true };
  hers: { id: string; name: string; owned: boolean; url?: string; cut?: true };
  complete: boolean;
  /** The pair portrait: ready once painted, pending while it paints, null until then. */
  pair: Paint | null;
  /** Complete and both looks painted: "Paint a pair portrait (1 image)" may be offered. */
  canPaintPair: boolean;
}

/** GET /runs/:run/wardrobe, and the `wardrobe` of POST .../wardrobe/wear. Each list starts with the base look. */
export interface WardrobeView {
  him: Record<LiId, LookView[]>;
  me: LookView[];
  couples: CoupleSet[];
  /** P19: what a love interest noticed about the look she wears now. */
  noticed: Noticed | null;
  /** A love interest is noticing her new look right now (P19 is being written): read the wardrobe again shortly. */
  noticing: boolean;
  /**
   * #2128: the Shop's gifts she owns, gift id → how many: only those she has and the story's Heat offers (SH/shop.ts
   * giftsFor). Date Night gives them from here.
   */
  gifts?: Partial<Record<GiftId, number>>;
  /** #2128: the figurines she bought, in cast order, each with its scene. */
  figurines?: OwnedFigurineView[];
}

/** POST /runs/:run/wardrobe/wear {owner: "me" | <li id>, look: BASE_LOOK | <item id>, li?: who notices her look}. */
export interface WearResult {
  wardrobe: WardrobeView;
}

/** What a Show earned: the first Show of a look to a love interest, within the day's activity cap. */
export interface WardrobeGrant {
  source: "show-him";
  li: LiId;
  affection: number;
}

/** POST /runs/:run/wardrobe/show {li, look}: his one line about her look (P24), and its face. */
export interface ShowResult {
  line: string;
  face?: Face;
  grants: WardrobeGrant[];
}

/**
 * An image the Album keeps: a story CG once seen, a Memory's CG once painted, a couple set's pair portrait, a sticker,
 * (#2087) a Photo Shoot photo or (#2151) a Tarot card's painted picture.
 */
export interface AlbumImage {
  key: string;
  url: string;
  ref?: string;
  at: string;
  li?: LiId;
  source: "story" | "memory" | "pair" | "sticker" | "photo" | "card";
  /** A Memory's title, the couple set's look names, or a photo's place. */
  title?: string;
  /** A sticker's prompt name (mari_laugh), which its saved file is named after. */
  name?: string;
}

/**
 * A sticker in the Album (#2044): one the player has (`url`, the cut-out once ready), or one of his owed stickers whose
 * paint waits for a tap (`art`: waiting for consent, failed or stopped). `label` is his sticker's own; the protagonist's
 * are labelled by the client.
 */
export interface AlbumSticker {
  id: string;
  owner: "you" | LiId;
  emotion: string;
  name: string;
  label?: string;
  level?: number;
  url?: string;
  art?: Paint;
}

/**
 * A card of the Tarot deck in the Album (#2151): one drawn and claimed for painting, by its deckKey (SH/tarot.ts). `li`
 * is the love interest a card of them, or of the two of them, was cast for (none for the story's one set); `art` is its
 * paint as the client should see it.
 */
export interface AlbumCard {
  key: string;
  card: Arcana;
  li?: LiId;
  art: Paint;
}

/** An owned Memory, Moment or Snapshot, with how far its story has been read (null: it has none, or not yet). */
export interface AlbumMemory extends ItemView {
  read: "unread" | "in-progress" | "done" | null;
  /** 0.21.0: won from Wish and not looked at yet (a dot by it until it is opened). */
  new?: true;
}

/**
 * One soundtrack row: a mood cue with its generated track, or null (the client plays the stock one); or a begun
 * chapter's saved theme, cue `chapter-<key>` (SH/audio.ts chapterMusicCue), named by its chapter.
 */
export type SoundtrackEntry =
  | { cue: MusicMood; track: SoundtrackTrack | null }
  | { cue: string; track: SoundtrackTrack; chapter: { key: string; title: string } };

/** GET /runs/:run/album: only what is unlocked. `tells` are the tells she has learned to read, per love interest. */
export interface AlbumView {
  cgs: AlbumImage[];
  memories: AlbumMemory[];
  timeline: TimelineEntry[];
  favorites: Favorite[];
  soundtrack: SoundtrackEntry[];
  tells: Record<LiId, string[]>;
  /** #2044: the protagonist's five, then each love interest's owed stickers in level order. */
  stickers: AlbumSticker[];
  /** #2087: the Photo Shoot's photos once painted, newest first. Kept out of `cgs`, which Home's back layer reads. */
  photos: AlbumImage[];
  /** #2151: the Tarot deck's drawn cards in Arcana order, then by love interest in cast order. */
  cards: AlbumCard[];
}

/** POST /runs/:run/items/:item/open */
export interface ItemOpenResult {
  item: ItemView;
  /** The Character Story, Moment or first-wear beat to read (null for an item with none). */
  story: { key: string } | null;
  art: Paint | null;
}

/**
 * Whether the wardrobe has something still on its way, so the client reads it again shortly: a look or a couple set
 * painting, a love interest noticing her look, or a figurine painting or being cut out (#2138: a painted figurine is
 * shown cut out, so the wardrobe keeps reading until its cut-out lands).
 */
export function wardrobeWorking(wardrobe: WardrobeView | undefined): boolean {
  return (
    !!wardrobe &&
    (wardrobe.noticing ||
      [...Object.values(wardrobe.him).flat(), ...wardrobe.me].some((look) => look.art?.state === "pending") ||
      wardrobe.couples.some((couple) => couple.pair?.state === "pending") ||
      !!wardrobe.figurines?.some((figurine) => figurine.art?.state === "pending" || figurine.cutting))
  );
}
