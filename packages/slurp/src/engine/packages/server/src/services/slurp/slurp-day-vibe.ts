/**
 * What kind of day this creator is having.
 *
 * The scoring half is pure, like every other Slurp rule module, and deliberately reads state
 * instead of rolling dice. `slurp-audience-arc.ts` states the reason and it applies here without change: "a
 * trajectory the player cannot account for is worse than no trajectory, because they would learn
 * to distrust the ones that are real."
 *
 * So a bad day is never random. It is a quiet ledger, or a week with nothing posted, and the
 * player can see the same numbers the creator is reacting to. That is what makes a tip on a bad
 * day mean something. A dice roll could never earn that.
 *
 * The day vibe only ever colours a reply. `slurp-stance.ts` will not let it decide one, because
 * somebody having a hard morning is still pleased to hear from a fan they like.
 */
import type { SlurpEarnings } from "./slurp-earnings.js";

export const SLURP_DAY_VIBES = ["good", "ordinary", "quiet", "flat"] as const;

export type SlurpDayVibe = (typeof SLURP_DAY_VIBES)[number];

export type SlurpDayVibeFacts = {
  /** Coins earned since the start of the creator's day. */
  earnedToday: number;
  /** Mean coins per day over the recent ledger, for comparison. */
  averageDaily: number;
  /** Days since anything was posted. */
  daysSinceLastPost: number | null;
};

/**
 * Score the day.
 *
 * The comparison is against this creator's own recent average, never a fixed number of coins. A
 * quiet day for somebody earning four hundred a week is a good day for somebody earning ten, and
 * a shared threshold would have told the second creator they were failing.
 */
export function slurpDayVibe(facts: SlurpDayVibeFacts): SlurpDayVibe {
  const daysSincePost = facts.daysSinceLastPost;
  // Nothing posted for over a week is the loudest signal available, and it outranks the money:
  // somebody who has stopped working is not cheered up by yesterday's residuals.
  if (daysSincePost !== null && daysSincePost >= 7) return "flat";
  // A creator with no history yet has no bad days. Everything is still the first week.
  if (facts.averageDaily <= 0) return facts.earnedToday > 0 ? "good" : "ordinary";
  if (facts.earnedToday >= facts.averageDaily * 1.8) return "good";
  if (facts.earnedToday <= facts.averageDaily * 0.25) return "quiet";
  return "ordinary";
}

/** One clause for the prompt. Null on an ordinary day, because an ordinary day is not news. */
export function slurpDayVibeDescription(vibe: SlurpDayVibe): string | null {
  switch (vibe) {
    case "good":
      return "Today has gone well for you. The money came in and you are in a good mood.";
    case "quiet":
      return "Today has been quiet. Barely anything came in, and you have noticed.";
    case "flat":
      return "You have not posted in over a week and you are not feeling much about any of it right now.";
    default:
      return null;
  }
}

/** Day boundaries are UTC, matching every other dated key in Slurp. */
const dayKey = (at: Date) => at.toISOString().slice(0, 10);

export function slurpDayVibeFacts(earnings: SlurpEarnings, lastPostAt: string | null, at: Date): SlurpDayVibeFacts {
  const today = dayKey(at);
  const dated = earnings.ledger.filter((entry) => entry.amount > 0 && typeof entry.at === "string");
  const earnedToday = dated
    .filter((entry) => entry.at.slice(0, 10) === today)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const earlier = dated.filter((entry) => entry.at.slice(0, 10) !== today);
  const days = new Set(earlier.map((entry) => entry.at.slice(0, 10)));
  const averageDaily = days.size > 0 ? earlier.reduce((sum, entry) => sum + entry.amount, 0) / days.size : 0;
  const daysSinceLastPost = lastPostAt
    ? Math.max(0, Math.floor((at.getTime() - Date.parse(lastPostAt)) / 86_400_000))
    : null;
  return { earnedToday, averageDaily, daysSinceLastPost };
}
