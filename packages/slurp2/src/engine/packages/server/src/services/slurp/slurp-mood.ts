/**
 * How this one conversation is going, right now.
 *
 * Pure, like `slurp-rapport.ts` and `slurp-messaging.ts`, so the rule can be tested without an
 * Engine checkout and the debug panel can show the exact number the prompt was built from.
 *
 * Rapport is a slow, economic number: it measures months and money, and it cannot move inside a
 * single conversation. So nothing in the model could express "she is annoyed with you right now",
 * and a creator answered the fortieth rude message exactly as warmly as the first.
 *
 * Mood is the fast layer. It runs from -100 to 100 and starts at zero.
 *
 * The model reports a direction, never a position. If the model set the value outright, one sharp
 * sentence could end a two-year relationship, and a fan could talk a creator back to delighted in
 * one line. A direction plus damping is what keeps the number fair in both directions.
 */

export const SLURP_MOOD_SHIFTS = ["up", "same", "down", "sharp_down"] as const;

export type SlurpMoodShift = (typeof SLURP_MOOD_SHIFTS)[number];

export const SLURP_MOOD_MIN = -100;
export const SLURP_MOOD_MAX = 100;

/** The named band. Bands are what the prompt and the panels read; the number stays internal. */
export type SlurpMoodTone = "warm" | "neutral" | "cool" | "cold";

/**
 * Points one shift is worth before damping.
 *
 * Down moves further than up, because that is how people work: goodwill is slow to build and quick
 * to lose. `sharp_down` is reserved for something a person would actually take offence at, and the
 * prompt says so.
 */
const STEP: Record<SlurpMoodShift, number> = { up: 12, same: 0, down: -14, sharp_down: -34 };

/** Points of drift back toward neutral per hour of silence. A day away clears most of a bad mood. */
const RECOVERY_PER_HOUR = 4;

/**
 * How much credit a relationship buys.
 *
 * A whale gets most of a bad message forgiven; a stranger gets none. This is the one place rapport
 * and mood meet, and it is deliberately one-directional: history softens a blow, it never makes
 * somebody more delighted than the conversation earned.
 */
const MAX_RAPPORT_DAMPING = 0.6;

export function slurpMoodTone(mood: number): SlurpMoodTone {
  if (mood >= 25) return "warm";
  if (mood >= -25) return "neutral";
  if (mood >= -65) return "cool";
  return "cold";
}

/**
 * Let silence heal. Applied before any shift, so a fan who comes back a day later is not still
 * being answered through yesterday's argument.
 */
export function recoverSlurpMood(mood: number, minutesSinceUpdate: number): number {
  if (!Number.isFinite(mood) || mood === 0) return 0;
  const minutes = Math.max(0, minutesSinceUpdate);
  const recovery = (minutes / 60) * RECOVERY_PER_HOUR;
  return mood > 0 ? Math.max(0, mood - recovery) : Math.min(0, mood + recovery);
}

export function applySlurpMood(input: {
  /** The stored value. Zero for a conversation that has never been scored. */
  mood: number;
  shift: SlurpMoodShift;
  /** 0-100 from `scoreSlurpRapport`. Only ever softens a fall. */
  rapportScore: number;
  minutesSinceUpdate: number;
}): number {
  const recovered = recoverSlurpMood(clamp(input.mood), input.minutesSinceUpdate);
  const step = STEP[input.shift] ?? 0;
  if (step === 0) return round(recovered);
  if (step > 0) {
    // Diminishing returns toward the top, for the same reason `scoreSlurpRapport` uses a curve:
    // otherwise four compliments pin the number and every warm conversation reads identically.
    const headroom = (SLURP_MOOD_MAX - recovered) / (SLURP_MOOD_MAX * 2);
    return round(clamp(recovered + step * Math.max(0.35, headroom)));
  }
  const credit = Math.min(MAX_RAPPORT_DAMPING, (Math.max(0, input.rapportScore) / 100) * MAX_RAPPORT_DAMPING);
  return round(clamp(recovered + step * (1 - credit)));
}

/** One clause for the prompt. Prose, because prose is what the model reads. */
export function describeSlurpMood(tone: SlurpMoodTone): string | null {
  switch (tone) {
    case "warm":
      return "This conversation is going well and you are enjoying it.";
    case "cool":
      return "This conversation has been going badly. You are short with them and not hiding it.";
    case "cold":
      return "This person has been rude or tiring, and you are close to done with the conversation.";
    default:
      return null;
  }
}

const clamp = (value: number) =>
  !Number.isFinite(value) ? 0 : Math.max(SLURP_MOOD_MIN, Math.min(SLURP_MOOD_MAX, value));

const round = (value: number) => Math.round(value * 10) / 10;
