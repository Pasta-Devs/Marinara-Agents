/**
 * The world moving while you watch it.
 *
 * Pure and deterministic, like the other Slurp rule modules.
 *
 * ## Why this exists
 *
 * A review found the world alive between sessions and inert during them. Fan activity runs four
 * times a day, and the world tick needs elapsed *days* to do anything, so a three-hour session saw
 * roughly one batch of comments and no world actions at all. For a roleplay product that is
 * backwards: immersion happens inside the session, and a reaction landing while you are reading is
 * worth more than a hundred that arrived while you were away.
 *
 * The design rule was already written down — "the trickle must be visible, likes must arrive while
 * the player watches" — and the implementation did the opposite.
 *
 * ## What it does
 *
 * Likes and follows only. No text, so no model call, so this can run on a session cadence without
 * costing anything. The expensive, interesting reactions stay on their own slower schedule; this
 * is the texture underneath them.
 *
 * Rate is driven by elapsed **minutes** rather than days, and capped per pulse, so reading the
 * page every few seconds does not farm reactions and coming back after a week does not dump a
 * hundred at once.
 */

/** Posts older than this no longer collect new reactions. A week-old post is finished. */
export const SLURP_PULSE_POST_MAX_AGE_HOURS = 48;

/** Nothing arrives faster than this, however large the audience. Six at once reads as a glitch. */
export const SLURP_PULSE_MAX_PER_TICK = 6;

/** Minutes of elapsed time that buy one reaction for a creator of reference size. */
const MINUTES_PER_REACTION = 4;

/** Audience size at which a Creator earns reactions at the reference rate. */
const REFERENCE_REACH = 3_000;

export type SlurpPulseTarget = {
  creatorAccountId: string;
  postId: string;
  /** Hours since the post was published. */
  ageHours: number;
  creatorReach: number;
};

export type SlurpPulseAction = {
  creatorAccountId: string;
  postId: string;
  actorAccountId: string;
  /** A follow is rarer than a like and is what actually moves the funnel. */
  kind: "like" | "follow";
};

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value: string): number {
  let out = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  out ^= out >>> 16;
  out = Math.imul(out, 0x85ebca6b);
  out ^= out >>> 13;
  return out >>> 0;
}

/**
 * How many reactions a stretch of time has earned.
 *
 * Scales with audience, but sub-linearly and against a cap: a large Creator feels busier without
 * making the feed unreadable, and the number the player can absorb in one sitting did not scale
 * with their follower count.
 */
export function slurpPulseBudget(elapsedMinutes: number, totalReach: number): number {
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0) return 0;
  const reach = Number.isFinite(totalReach) ? Math.max(0, totalReach) : 0;
  if (reach <= 0) return 0;
  const scale = Math.sqrt(reach / REFERENCE_REACH);
  return Math.min(SLURP_PULSE_MAX_PER_TICK, Math.floor((elapsedMinutes / MINUTES_PER_REACTION) * scale));
}

/**
 * What arrives in this pulse.
 *
 * Newer posts attract more than older ones, which is what makes a post you just made feel like it
 * landed. Returns an empty plan when there is nobody to act, nothing recent to act on, or too
 * little time has passed.
 */
export function planSlurpWorldPulse(input: {
  elapsedMinutes: number;
  targets: readonly SlurpPulseTarget[];
  audience: readonly string[];
  /** Anything already in this pulse's window, so a pulse never re-likes the same post twice. */
  seed: string;
  /** Activity multiplier. Zero means nothing arrives while you read, which is the point of "off". */
  activity?: number;
}): SlurpPulseAction[] {
  const activity = Number.isFinite(input.activity) ? Math.max(0, input.activity ?? 1) : 1;
  if (activity === 0) return [];
  const fresh = input.targets.filter(
    (target) =>
      Number.isFinite(target.ageHours) && target.ageHours >= 0 && target.ageHours <= SLURP_PULSE_POST_MAX_AGE_HOURS,
  );
  if (fresh.length === 0 || input.audience.length === 0) return [];

  const totalReach = fresh.reduce((sum, target) => sum + Math.max(0, target.creatorReach), 0) / fresh.length;
  const budget = slurpPulseBudget(input.elapsedMinutes * activity, totalReach);
  if (budget <= 0) return [];

  const random = mulberry32(hashSeed(input.seed));
  // Weight toward the newest posts: a reaction on something you published minutes ago is the whole
  // point, and one on a two-day-old post is noise.
  const weighted = fresh
    .map((target) => ({ target, weight: 1 / (1 + target.ageHours) }))
    .sort((left, right) => right.weight - left.weight);
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);

  const actions: SlurpPulseAction[] = [];
  const used = new Set<string>();
  for (let index = 0; index < budget * 3 && actions.length < budget; index += 1) {
    let roll = random() * totalWeight;
    const chosen = weighted.find((entry) => (roll -= entry.weight) <= 0) ?? weighted[0]!;
    const actor = input.audience[Math.floor(random() * input.audience.length)]!;
    const key = `${chosen.target.postId}:${actor}`;
    if (used.has(key)) continue;
    used.add(key);
    // Roughly one in six reactions is somebody deciding to follow rather than just tapping like.
    actions.push({
      creatorAccountId: chosen.target.creatorAccountId,
      postId: chosen.target.postId,
      actorAccountId: actor,
      kind: random() < 0.16 ? "follow" : "like",
    });
  }
  return actions;
}
