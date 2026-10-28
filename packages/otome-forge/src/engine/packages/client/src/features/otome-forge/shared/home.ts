// ──────────────────────────────────────────────
// Otome Forge: Home's numbers and words shared by both bundles (plan M3 "Home server", P15, P16)
// ──────────────────────────────────────────────
// Pure TypeScript. The server writes line packs and notes by these counts and limits (S/home) and reads the time of day
// with timeOfDayOf; the client picks a tap line by the same zones and times of day (C/lib/tap-mood.ts, which also holds
// the catalog's fallback lines until his own pack exists).

export const TAP_ZONES = ["head", "hand", "heart"] as const;
export type TapZone = (typeof TAP_ZONES)[number];

export const TIMES_OF_DAY = ["morning", "day", "night"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

/** How many lines each list of a pack holds (P15). Taps: per zone and time of day. */
export const LINE_COUNTS = {
  tap: 3,
  annoyed: 4,
  cold: 6,
  comfort: 8,
  claw: { cheer: 4, cheat: 3, win: 3, miss: 3, plush: 3 },
} as const;
export type ClawLineKind = keyof (typeof LINE_COUNTS)["claw"];
export const CLAW_LINE_KINDS = Object.keys(LINE_COUNTS.claw) as ClawLineKind[];

/** A pre-written line is this many words or fewer. */
export const LINE_WORDS_MAX = 14;
/** The message of the day: this many words or fewer, in one or two sentences (one during a rupture). */
export const NOTE_WORDS_MAX = 30;
export const NOTE_CURT_WORDS_MAX = 14;
/**
 * Characters a stored note may hold, and so the quote a Reply from Home may carry: the word limits above do not bound
 * scripts written without spaces (Thai, Khmer, …), so the note and its quote share this one limit.
 */
export const NOTE_TEXT_MAX = 600;
/** The mood chip's reason: this many words or fewer. */
export const MOOD_REASON_WORDS_MAX = 4;
/** The notes before today that the note prompt sees, so he does not repeat himself. */
export const RECENT_NOTES = 7;

/** The part of the day an hour (0–23, local) falls in: morning 5–11, day 12–17, night 18–4. */
export function timeOfDayOf(hour: number): TimeOfDay {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  return h >= 5 && h < 12 ? "morning" : h >= 12 && h < 18 ? "day" : "night";
}

// Han, kana and Hangul are written without spaces, so each two of their characters count as one word.
const UNSPACED = /[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]/gu;

/** Words in `text`: space-separated words, plus one per two CJK characters. */
export function wordCount(text: string): number {
  const unspaced = text.match(UNSPACED)?.length ?? 0;
  const words = text
    .replace(UNSPACED, " ")
    .split(/\s+/u)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  return words + Math.ceil(unspaced / 2);
}

/**
 * Sentences in `text`, counted by their closing punctuation: Latin marks before a space, a quote or the end, CJK marks
 * anywhere. An unclosed last sentence counts too.
 */
export function sentenceCount(text: string): number {
  const value = text.trim();
  if (!value) return 0;
  const latin = value.match(/[.!?…]+(?=\s|$|["'”’」』)])/gu)?.length ?? 0;
  const cjk = value.match(/[。！？]+/gu)?.length ?? 0;
  return latin + cjk + (/[.!?…。！？]["'”’」』)]*$/u.test(value) ? 0 : 1);
}
