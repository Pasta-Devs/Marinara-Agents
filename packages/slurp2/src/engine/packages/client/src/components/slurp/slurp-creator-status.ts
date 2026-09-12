/**
 * Whether a Creator reads as around right now.
 *
 * Pure, and shared, which is the point. The rule lived inline in the profile header and nowhere
 * else, so the one surface where a player most wants to know whether somebody is about to answer —
 * the message thread — showed no status at all. Two copies of a rule like this drift; one copy
 * with two callers cannot.
 *
 * Derived from when the Creator last posted rather than from any real presence, because there is
 * no real presence to read: a Creator is a schedule, not a person at a keyboard. A Creator with
 * automatic posting switched on never falls all the way to offline, since they are still due to
 * act even if the last post is old.
 */
export type SlurpCreatorStatus = "online" | "away" | "offline";

/** Detailed status with availability information for UI display. */
export type SlurpCreatorDetailedStatus =
  | { state: "online"; activity: string | null }
  | { state: "away"; backInMinutes: number | null }
  | { state: "offline"; usuallyActiveAt: string | null };

/** Posted within this long and the Creator reads as present. */
const ONLINE_MS = 15 * 60_000;

/** Beyond this with nothing scheduled, the Creator reads as gone rather than merely quiet. */
const AWAY_MS = 24 * 60 * 60_000;

export function slurpCreatorStatus(
  input: {
    lastActiveAt: string | number | null | undefined;
    autoPostingEnabled: boolean;
    /** Schedule availability is authoritative when the Creator has one. */
    scheduledOnline?: boolean;
  },
  now: number = Date.now(),
): SlurpCreatorStatus {
  if (input.scheduledOnline === true) return "online";
  if (input.scheduledOnline === false) return "away";
  const parsed = typeof input.lastActiveAt === "number" ? input.lastActiveAt : Date.parse(input.lastActiveAt ?? "");
  // No posts at all is not the same as a stale one: a Creator who has never posted but is
  // scheduled to is waiting to start, not abandoned.
  const age = Number.isFinite(parsed) ? now - parsed : Number.POSITIVE_INFINITY;
  if (age <= ONLINE_MS) return "online";
  if (age <= AWAY_MS || input.autoPostingEnabled) return "away";
  return "offline";
}

/**
 * Get detailed status with availability timing for enhanced UI display.
 */
export function slurpCreatorDetailedStatus(
  input: {
    lastActiveAt: string | number | null | undefined;
    autoPostingEnabled: boolean;
    scheduledOnline?: boolean;
    activity?: string | null;
    minutesUntilOnline?: number | null;
  },
  now: number = Date.now(),
): SlurpCreatorDetailedStatus {
  const basicStatus = slurpCreatorStatus(input, now);

  if (basicStatus === "online") {
    return {
      state: "online",
      activity: input.activity ?? null,
    };
  }

  if (basicStatus === "away") {
    return {
      state: "away",
      backInMinutes: input.minutesUntilOnline ?? null,
    };
  }

  // Offline - try to infer usual active times
  return {
    state: "offline",
    usuallyActiveAt: null, // Could be enhanced with historical data
  };
}

/**
 * Format detailed status for UI display.
 */
export function formatCreatorStatus(status: SlurpCreatorDetailedStatus): string {
  switch (status.state) {
    case "online":
      return status.activity ? `Online • ${status.activity}` : "Online now";
    case "away":
      if (status.backInMinutes !== null) {
        if (status.backInMinutes < 60) {
          return `Away • Back in ~${Math.round(status.backInMinutes)}min`;
        }
        const hours = Math.round(status.backInMinutes / 60);
        return `Away • Back in ~${hours}hr`;
      }
      return "Away";
    case "offline":
      return status.usuallyActiveAt ? `Offline • Usually active ${status.usuallyActiveAt}` : "Offline";
  }
}
