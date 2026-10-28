/**
 * "How fast they answer": one choice on the Basic page that writes the ten reply-wait fields
 * the Messages page shows one by one. `normal` is the server's shipped waits
 * (`SLURP_DEFAULT_REPLY_DELAYS`); a regression keeps the two equal.
 */
export const SLP_REPLY_DELAY_KEYS = [
  "messagesHighRapportDelayMinMinutes",
  "messagesHighRapportDelayMaxMinutes",
  "messagesMediumRapportDelayMinMinutes",
  "messagesMediumRapportDelayMaxMinutes",
  "messagesUnknownReturnDelayMinutes",
  "messagesMaxReplyDelayMinutes",
  "messagesRecentPostAwayMinMinutes",
  "messagesRecentPostAwayMaxMinutes",
  "messagesStalePostAwayMinMinutes",
  "messagesStalePostAwayMaxMinutes",
] as const;
export type SlpReplyDelayKey = (typeof SLP_REPLY_DELAY_KEYS)[number];
export type SlpReplyDelays = Record<SlpReplyDelayKey, number>;

export const SLP_REPLY_SPEEDS = ["instant", "quick", "normal", "slow"] as const;
export type SlpReplySpeed = (typeof SLP_REPLY_SPEEDS)[number];

export const SLP_NORMAL_REPLY_DELAYS: SlpReplyDelays = {
  messagesHighRapportDelayMinMinutes: 10,
  messagesHighRapportDelayMaxMinutes: 20,
  messagesMediumRapportDelayMinMinutes: 30,
  messagesMediumRapportDelayMaxMinutes: 60,
  messagesUnknownReturnDelayMinutes: 45,
  messagesMaxReplyDelayMinutes: 90,
  messagesRecentPostAwayMinMinutes: 15,
  messagesRecentPostAwayMaxMinutes: 45,
  messagesStalePostAwayMinMinutes: 45,
  messagesStalePostAwayMaxMinutes: 120,
};

// Instant is a zero ceiling: the server answers at once when `messagesMaxReplyDelayMinutes` is 0.
const FACTOR: Record<SlpReplySpeed, number> = { instant: 0, quick: 0.5, normal: 1, slow: 3 };

export function slpReplySpeedPatch(speed: SlpReplySpeed): SlpReplyDelays {
  return Object.fromEntries(
    SLP_REPLY_DELAY_KEYS.map((key) => [key, Math.min(1440, Math.round(SLP_NORMAL_REPLY_DELAYS[key] * FACTOR[speed]))]),
  ) as SlpReplyDelays;
}

/** The choice the stored waits match, or null when they were set one by one. */
export function slpReplySpeedFor(settings: SlpReplyDelays): SlpReplySpeed | null {
  return (
    SLP_REPLY_SPEEDS.find((speed) => {
      const patch = slpReplySpeedPatch(speed);
      return SLP_REPLY_DELAY_KEYS.every((key) => settings[key] === patch[key]);
    }) ?? null
  );
}
