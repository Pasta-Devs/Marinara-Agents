// ──────────────────────────────────────────────
// Otome Forge: overused phrases every prompt that writes prose bans (plan §1.7)
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles. Prompt text: English, never localized.

/**
 * Copied from Marinara Engine packages/server/src/services/game/gm-prompts.ts:1864 (the narrator's "zero tolerance
 * for lazy AI writing" line) and :2560 (the world overview's cliché list), Engine a3ceb0162.
 */
export const ENGINE_BANNED_PHRASES = [
  "doesn't X, doesn't Y",
  "not X, not Y",
  "not X, but Y",
  "if X, then Y",
  "negative parallelisms",
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

export const BANNED_PHRASES: readonly string[] = [...ENGINE_BANNED_PHRASES, ...ROMANCE_BANNED_PHRASES];
