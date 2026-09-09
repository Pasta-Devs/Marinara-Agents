/**
 * Check-in intervals: when Creators "check their phone" for messages.
 *
 * Even when offline, Creators periodically check messages. High rapport + subscribers
 * get checked more frequently. This simulates: "I wasn't online, but I saw your message
 * when I checked my phone, so I'm replying even though I'm not fully active right now."
 *
 * Pure and deterministic (seeded randomness) so the same Creator checks at consistent
 * times each day, preventing gaming the system.
 */
import type { SlurpRapport } from "./slurp-rapport.js";

/**
 * Calculate next check-in interval in minutes.
 *
 * Uses deterministic randomness based on creatorId + time block, so the same
 * Creator has consistent check-in patterns per day without being perfectly predictable.
 *
 * @param creatorId Unique Creator identifier for seeding
 * @param rapport Relationship score
 * @param subscribed Is fan subscribed to this Creator?
 * @param now Current time (for seeding the randomness)
 * @returns Minutes until Creator next checks messages
 */
export function nextCheckInMinutes(
  creatorId: string,
  rapport: SlurpRapport,
  subscribed: boolean,
  now: Date = new Date(),
): number {
  // Base interval: check every 60-120 minutes
  // Use hour of day as seed so check-ins are consistent within an hour
  const hourOfDay = now.getHours();
  const seed = simpleHash(creatorId + hourOfDay.toString());
  const baseVariance = (seed % 60) / 100; // 0.0 to 0.6
  const baseInterval = 60 + baseVariance * 60; // 60-120 minutes

  // Rapport multiplier: high rapport = checks more often
  // 0 rapport = 1.0x (full interval)
  // 100 rapport = 0.5x (half interval)
  const rapportMultiplier = 1.0 - rapport.score / 200;

  // Subscriber bonus: -20% interval (checks 20% more often)
  const subscriberMultiplier = subscribed ? 0.8 : 1.0;

  const finalInterval = baseInterval * rapportMultiplier * subscriberMultiplier;

  return Math.round(Math.max(10, finalInterval)); // Minimum 10 minutes between checks
}

/**
 * Should Creator reply during a check-in, or wait for schedule?
 *
 * When checking messages while offline, they might reply immediately (if rapport is high)
 * or just mark as read and reply later (if rapport is low).
 *
 * @param rapport Relationship score
 * @param subscribed Is fan subscribed?
 * @returns "instant" | "delayed" | "wait_for_schedule"
 */
export function checkInReplyDecision(
  rapport: SlurpRapport,
  subscribed: boolean,
): "instant" | "delayed" | "wait_for_schedule" {
  const reach = rapport.score / 100 + (subscribed ? 0.2 : 0);

  if (reach >= 0.6) {
    // High rapport + subscriber = reply right away during check-in
    return "instant";
  } else if (reach >= 0.4) {
    // Medium rapport = reply within 10-20 minutes
    return "delayed";
  } else {
    // Low rapport = just mark read, reply when schedule brings them online
    return "wait_for_schedule";
  }
}

/**
 * Delay in minutes for a "delayed" check-in reply.
 *
 * They saw it, they'll reply, but not instantly (they're in the middle of something).
 */
export function checkInDelayMinutes(): number {
  return Math.round(10 + Math.random() * 10); // 10-20 minutes
}

/**
 * Simple string hash for deterministic randomness.
 *
 * Not cryptographic, just needs to be consistent per input.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Describe check-in frequency tier for debug/display.
 */
export function describeCheckInFrequency(intervalMinutes: number): string {
  if (intervalMinutes <= 30) return "very frequent (high rapport)";
  if (intervalMinutes <= 60) return "frequent";
  if (intervalMinutes <= 90) return "occasional";
  return "rare (low rapport)";
}
