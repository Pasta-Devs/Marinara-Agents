/**
 * Talkativeness: use generated schedule personality traits to shape reply behavior.
 *
 * Generated schedules (from slurp-conversation-schedule-generation.ts) include:
 * - talkativeness (0-100): how chatty/verbose this Creator is
 * - inactivityThresholdMinutes (15-360): how long before they "wander off" from a conversation
 *
 * This module bridges the generated schedule data into the pacing and generation systems.
 */

export type TalkativenessProfile = {
  /** How chatty this Creator is, 0-100. Affects reply length, multi-bubble likelihood, typing speed. */
  talkativeness: number;
  /** Minutes of fan inactivity before Creator "loses interest" and goes back to schedule-based availability. */
  inactivityThresholdMinutes: number;
};

export const DEFAULT_TALKATIVENESS_PROFILE: TalkativenessProfile = {
  talkativeness: 50, // Medium chattiness
  inactivityThresholdMinutes: 120, // 2 hours
};

/**
 * Read talkativeness profile from generated schedule or character data.
 */
export function readTalkativenessProfile(data: unknown): TalkativenessProfile {
  const obj = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};

  const talkativeness =
    typeof obj.talkativeness === "number" && obj.talkativeness >= 0 && obj.talkativeness <= 100
      ? obj.talkativeness
      : DEFAULT_TALKATIVENESS_PROFILE.talkativeness;

  const inactivityThresholdMinutes =
    typeof obj.inactivityThresholdMinutes === "number" &&
    obj.inactivityThresholdMinutes >= 15 &&
    obj.inactivityThresholdMinutes <= 360
      ? obj.inactivityThresholdMinutes
      : DEFAULT_TALKATIVENESS_PROFILE.inactivityThresholdMinutes;

  return { talkativeness, inactivityThresholdMinutes };
}

/**
 * Should reply be split into multiple bubbles?
 *
 * Terse Creators (low talkativeness) send single messages.
 * Chatty Creators (high talkativeness) send multi-bubble bursts.
 */
export function allowMultiBubbleSplit(talkativeness: number, mood: number): boolean {
  // Low talkativeness = single messages
  if (talkativeness < 30) return false;

  // High talkativeness = always split (when content is long enough)
  if (talkativeness > 70) return true;

  // Medium talkativeness = split when mood is good
  return mood >= 0;
}

/**
 * Typing speed multiplier based on talkativeness.
 *
 * Chatty people type faster (thoughts flow easily).
 * Terse people type slower (more deliberate, choosing words carefully).
 */
export function talkativenessTypingMultiplier(talkativeness: number): number {
  // 0 talkativeness = 0.5x speed (very slow, deliberate)
  // 50 talkativeness = 1.0x speed (normal)
  // 100 talkativeness = 1.5x speed (rapid-fire typing)
  return 0.5 + (talkativeness / 100) * 1.0;
}

/**
 * Has the fan been inactive long enough that Creator "wanders off"?
 *
 * If fan hasn't replied within the inactivity threshold, Creator stops
 * extending their availability and reverts to schedule-based replies.
 *
 * @param lastFanMessageAt ISO timestamp of fan's most recent message
 * @param inactivityThresholdMinutes From generated schedule
 * @param now Current time
 */
export function hasConversationGoneIdle(
  lastFanMessageAt: string | null,
  inactivityThresholdMinutes: number,
  now: Date = new Date(),
): boolean {
  if (!lastFanMessageAt) return true;

  const idleMinutes = (now.getTime() - Date.parse(lastFanMessageAt)) / 60_000;
  return idleMinutes >= inactivityThresholdMinutes;
}

/**
 * Describe talkativeness tier for debug/display.
 */
export function describeTalkativeness(talkativeness: number): string {
  if (talkativeness < 30) return "terse";
  if (talkativeness < 70) return "balanced";
  return "chatty";
}
