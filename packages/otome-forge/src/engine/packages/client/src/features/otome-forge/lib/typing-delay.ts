// ──────────────────────────────────────────────
// Otome Forge: how long he "types" a phone message before it appears (plan M3): 40 ms per character, at most 4 s.
// The first message of a reply counts the time the player already waited for the model, so a slow reply never waits
// twice. Pure.
// ──────────────────────────────────────────────

export const TYPING_MS_PER_CHARACTER = 40;
export const TYPING_MAX_MS = 4_000;

export function typingDelay(text: string, waitedMs = 0): number {
  const characters = Array.from(text.trim()).length;
  const typing = Math.min(TYPING_MAX_MS, characters * TYPING_MS_PER_CHARACTER);
  return Math.max(0, typing - Math.max(0, waitedMs));
}
