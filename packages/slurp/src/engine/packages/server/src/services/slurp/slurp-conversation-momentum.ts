/**
 * Conversation momentum: tracks whether a thread is in active flow or has gone cold.
 *
 * Pure function module like slurp-rapport.ts and slurp-messaging.ts. Momentum affects:
 * - Availability: hot conversations keep Creator online longer
 * - Pacing: replies during hot flow are faster
 * - Mood recovery: paused during active conflict
 *
 * A conversation with momentum feels alive. One without feels like checking voicemail.
 */

export type ConversationMomentum = "hot" | "warm" | "cold" | "frozen";

export type MomentumAnalysis = {
  momentum: ConversationMomentum;
  /** Minutes since last message in thread. */
  lastActivityAge: number;
  /** Messages exchanged in last 24 hours. */
  messageCount24h: number;
  /** True if conversation shows back-and-forth pattern (not one-sided). */
  isFlowing: boolean;
};

/**
 * Calculate conversation momentum from thread activity.
 *
 * @param lastMessageAt ISO timestamp of most recent message (any role)
 * @param messageHistory Recent messages for flow analysis (optional, improves accuracy)
 * @param now Current time for age calculation
 */
export function calculateConversationMomentum(
  lastMessageAt: string,
  messageHistory?: Array<{ role: "viewer" | "creator"; createdAt: string }>,
  now: Date = new Date(),
): MomentumAnalysis {
  const lastActivityAge = Math.max(0, (now.getTime() - Date.parse(lastMessageAt)) / 60_000);

  // Momentum thresholds
  let momentum: ConversationMomentum;
  if (lastActivityAge <= 5) {
    momentum = "hot"; // Active chat happening NOW
  } else if (lastActivityAge <= 60) {
    momentum = "warm"; // Recent conversation
  } else if (lastActivityAge <= 1440) {
    momentum = "cold"; // Within 24 hours
  } else {
    momentum = "frozen"; // Days old
  }

  // Count recent messages
  const oneDayAgo = now.getTime() - 24 * 60 * 60_000;
  const messageCount24h = messageHistory
    ? messageHistory.filter((m) => Date.parse(m.createdAt) >= oneDayAgo).length
    : 0;

  // Detect back-and-forth flow pattern
  const isFlowing = messageHistory ? detectFlowPattern(messageHistory) : false;

  return {
    momentum,
    lastActivityAge,
    messageCount24h,
    isFlowing,
  };
}

/**
 * Detect if conversation shows healthy back-and-forth pattern.
 *
 * A flowing conversation has alternating turns, not one person monologuing.
 * Requires at least 4 messages with at least 2 role switches in recent history.
 */
function detectFlowPattern(messages: Array<{ role: "viewer" | "creator"; createdAt: string }>): boolean {
  if (messages.length < 4) return false;

  // Take last 10 messages
  const recent = messages.slice(-10);

  // Count role switches
  let switches = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i]!.role !== recent[i - 1]!.role) switches++;
  }

  // At least 2 switches = conversation, not monologue
  return switches >= 2;
}

/**
 * How long a Creator should stay online during an active conversation.
 *
 * Hot momentum extends availability: they're in the flow and will stick around
 * for a while even if their schedule says they should be offline.
 *
 * @param momentum Current conversation state
 * @param rapport Relationship score (0-100+)
 * @returns Minutes the Creator stays engaged, or null if momentum doesn't extend availability
 */
export function extendedOnlineDurationMinutes(momentum: ConversationMomentum, rapport: number): number | null {
  if (momentum !== "hot") return null;

  // Hot conversation = stay online 20-40 minutes
  // Higher rapport = stays longer (they enjoy talking to you)
  const base = 20;
  const rapportBonus = Math.min(20, Math.round((rapport / 100) * 20));

  // Add some variance so it's not exactly predictable
  const variance = Math.round(Math.random() * 10) - 5; // ±5 minutes

  return base + rapportBonus + variance;
}

/**
 * Typing speed multiplier based on momentum.
 *
 * Hot conversations = faster typing (already in the flow, thoughts ready).
 * Cold threads = slower, more considered replies.
 */
export function typingSpeedMultiplier(momentum: ConversationMomentum): number {
  switch (momentum) {
    case "hot":
      return 1.25; // 25% faster typing
    case "warm":
      return 1.0; // Normal speed
    case "cold":
      return 0.85; // 15% slower
    case "frozen":
      return 0.75; // 25% slower (rusty, need to reread context)
  }
}

/**
 * Should mood recovery be paused during active conversation?
 *
 * If you had an argument and keep chatting immediately, the mood stays tense
 * until the conversation cools down. You can't heal from conflict while still in it.
 *
 * @returns true if mood should NOT recover right now
 */
export function shouldPauseMoodRecovery(momentum: ConversationMomentum, mood: number): boolean {
  // Only pause if conversation is hot AND mood is negative
  // (No point pausing positive mood recovery)
  return momentum === "hot" && mood < 0;
}
