// ──────────────────────────────────────────────
// Otome Forge: overused phrases every prompt that writes prose bans (plan §1.7)
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles. Prompt text: English, never localized.

/**
 * Copied from Marinara Engine packages/server/src/services/game/gm-prompts.ts:1864 (the narrator's "zero tolerance
 * for lazy AI writing" line) and :2560 (the world overview's cliché list), Engine a3ceb0162. Its sentence patterns are
 * banned in narration only (the maintainer's, 2026-11-23): people say them all the time, and a model that kept them
 * out of speech twisted its dialogue around them.
 */
export const NARRATION_BANNED_PATTERNS = [
  "doesn't X, doesn't Y",
  "not X, not Y",
  "not X, but Y",
  "if X, then Y",
  "negative parallelisms",
] as const;

/**
 * #2513 (the maintainer's, 2026-11-27): constructions nobody says on the spot, which made characters sound composed and
 * theatrical, and which read just as stiff in narration, so they are banned everywhere, with the phrases below.
 * Schematic, like the patterns above, so no wording is primed.
 */
export const STIFF_PATTERNS = ["counting off points (one: X, two: Y)", "mirrored pairs (you X, I Y)"] as const;

export const ENGINE_BANNED_PHRASES = [
  "jaw working",
  "mechanical precision",
  "ozone",
  "somewhere outside",
  "physical punches",
  "practiced ease",
  "predatory instincts",
  "lets out a breath",
] as const;

/** Romance clichés and the comfort lines that flatten a love interest into a therapist. */
export const ROMANCE_BANNED_PHRASES = [
  "a breath he didn't know he was holding (with any pronoun)",
  "voice a low rumble",
  "ministrations",
  "orbs",
  "claimed her lips (with any pronoun)",
  "something shifted",
  '"mine" as a stock line',
  "I'll always protect you",
  "you're safe with me",
  "I'm not going anywhere",
  "your feelings are valid",
  "therapy-speak",
  "instant apologies",
] as const;

export const BANNED_PHRASES: readonly string[] = [
  ...ENGINE_BANNED_PHRASES,
  ...ROMANCE_BANNED_PHRASES,
  ...STIFF_PATTERNS,
];

/** The longest list of the player's own banned phrases kept (Settings → Content), in characters. */
export const OWN_BANNED_PHRASES_MAX = 2000;

/**
 * The player's own banned phrases as typed: split at commas, semicolons and line breaks, quotes and doubled spaces
 * dropped, each kept once (case-insensitively). Story Writer's parseBannedPhrases, the same rule.
 */
export function parseBannedPhrases(value: string | undefined): string[] {
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const raw of (value ?? "").split(/[,;\n]/)) {
    const phrase = raw
      .trim()
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const lower = phrase.toLocaleLowerCase();
    if (!phrase || seen.has(lower)) continue;
    seen.add(lower);
    phrases.push(phrase);
  }
  return phrases;
}
