// ──────────────────────────────────────────────
// Otome Hearth: chat stickers (#2044), shared by both bundles
// ──────────────────────────────────────────────
// The protagonist has five chibi stickers (painted for the run with images on, else a built-in set), and each love
// interest nine of himself, one unlocked at each affection level from 2 to 10 and painted only with images on
// (S/art/stickers.ts). #2477: each friend has five, one at each friend level from 1 to 5, on the same rules. A message
// names a sticker by id: `you:<emotion>` for the protagonist's, `<li id>:<emotion>` for his (a friend's id is li-…
// too). In prompts a sticker is `[name_emotion]` (mari_laugh); S/art/stickers.ts makes those names. Messages saved
// before #2044 name one of his five faces instead (SH/faces.ts) and keep showing it.
import { MAX_LEVEL } from "./economy";
import { FRIEND_MAX_LEVEL } from "./friends";

export const PLAYER_STICKERS = ["laugh", "love", "shy", "sad", "pout"] as const;
export type PlayerSticker = (typeof PLAYER_STICKERS)[number];

/** English, for prompts: [how P17 describes it, what the paint draws]. The client labels them through its locale. */
export const PLAYER_STICKER_LOOKS: Record<PlayerSticker, [label: string, look: string]> = {
  laugh: ["laughing", "laughing out loud, eyes squeezed shut, mouth wide open"],
  love: ["in love", "heart eyes, hands clasped under the chin, small floating hearts"],
  shy: ["shy", "deep blush, peeking over joined fingertips, eyes glancing away"],
  sad: ["sad", "teary eyes, wobbly frown, one tear"],
  pout: ["pouting", "puffed cheeks, pursed lips, arms crossed, small anger mark"],
};

/** His stickers unlock one per affection level, from this level to MAX_LEVEL: `set[i]` at level i + 2. */
export const STICKER_FIRST_LEVEL = 2;
export const STICKERS_PER_LI = MAX_LEVEL - STICKER_FIRST_LEVEL + 1;
/** #2477: a friend's stickers unlock one per friend level, from level 1: `set[i]` at level i + 1. */
export const STICKERS_PER_FRIEND = FRIEND_MAX_LEVEL;

/** The owner part of the protagonist's sticker ids. */
export const PLAYER_STICKER_OWNER = "you";
/** `you:<emotion>` or `<li id>:<emotion>`; an emotion is one lowercase English word. */
export const STICKER_ID = /^(you|li-[a-z0-9-]{3,40}):([a-z]{2,20})$/;
export const STICKER_EMOTION = /^[a-z]{2,20}$/;

export const stickerId = (owner: string, emotion: string) => `${owner}:${emotion}`;

export function parseStickerId(value: unknown): { owner: string; emotion: string } | null {
  const match = typeof value === "string" ? STICKER_ID.exec(value) : null;
  return match ? { owner: match[1]!, emotion: match[2]! } : null;
}

export const isPlayerSticker = (value: unknown): value is PlayerSticker =>
  typeof value === "string" && (PLAYER_STICKERS as readonly string[]).includes(value);
