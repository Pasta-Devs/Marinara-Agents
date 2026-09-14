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

import {
  SLURP_REALISTIC_TUNING,
  SLURP_TUNING_PULSE_PER_TICK_CEILING,
  type SlurpSimulationTuning,
} from "./slurp-tuning.js";

type PulseTuning = SlurpSimulationTuning["pulse"];

/**
 * What one actor's Fan Type makes them do, for the caller that has resolved one.
 *
 * Optional throughout: passing nothing keeps the fixed 18/16/66 split the pulse has always used,
 * which is what every existing caller and test expects. With weights, a Lurker likes and almost
 * never comments, a Newcomer follows far more often, and a Troll does neither much.
 */
export type SlurpPulseActorWeights = {
  /** How often this person is picked to act at all. */
  activity: number;
  like: number;
  follow: number;
  comment: number;
  /** Share of their reactions that is a follow. `funnel.followChance`. */
  followChance: number;
};

/** The fixed split the pulse used before Fan Types: comments 18%, follows 16%, likes the rest. */
const DEFAULT_COMMENT_SHARE = 0.18;

function pickActor(
  audience: readonly string[],
  weights: ReadonlyMap<string, SlurpPulseActorWeights> | undefined,
  random: () => number,
): string {
  if (!weights) return audience[Math.floor(random() * audience.length)]!;
  const total = audience.reduce((sum, id) => sum + Math.max(0, weights.get(id)?.activity ?? 1), 0);
  if (!(total > 0)) return audience[Math.floor(random() * audience.length)]!;
  let roll = random() * total;
  for (const id of audience) {
    roll -= Math.max(0, weights.get(id)?.activity ?? 1);
    if (roll <= 0) return id;
  }
  return audience[audience.length - 1]!;
}

function pickKind(actorWeight: SlurpPulseActorWeights | undefined, roll: number): SlurpPulseAction["kind"] {
  if (!actorWeight) return roll < DEFAULT_COMMENT_SHARE ? "comment" : roll < 0.34 ? "follow" : "like";
  const followShare = Math.min(0.9, Math.max(0, actorWeight.followChance));
  const comment = DEFAULT_COMMENT_SHARE * Math.max(0, actorWeight.comment);
  const follow = followShare * Math.max(0, actorWeight.follow);
  const like = Math.max(0, 1 - DEFAULT_COMMENT_SHARE - followShare) * Math.max(0, actorWeight.like);
  const total = comment + follow + like;
  if (!(total > 0)) return "like";
  const scaled = roll * total;
  return scaled < comment ? "comment" : scaled < comment + follow ? "follow" : "like";
}

/** Posts older than this no longer collect new reactions (realistic default; see `pulse.postMaxAgeHours`). */
export const SLURP_PULSE_POST_MAX_AGE_HOURS = SLURP_REALISTIC_TUNING.pulse.postMaxAgeHours;

/** Nothing arrives faster than this, however large the audience (realistic default; see `pulse.maxPerTick`). */
export const SLURP_PULSE_MAX_PER_TICK = SLURP_REALISTIC_TUNING.pulse.maxPerTick;

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
  /**
   * A follow is rarer than a like and is what actually moves the funnel.
   *
   * `comment` is the noise floor of a comment section: three words from somebody who wanted to be
   * seen saying them. It comes from the Tier 1 bank, not the model — it is the highest-volume text
   * on the platform and the least worth reading, so generating it is the worst trade available.
   * The model's budget belongs to the batched run, which has actually seen the post.
   */
  kind: "like" | "follow" | "comment";
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
export function slurpPulseBudget(
  elapsedMinutes: number,
  totalReach: number,
  tuning: PulseTuning = SLURP_REALISTIC_TUNING.pulse,
): number {
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0) return 0;
  const reach = Number.isFinite(totalReach) ? Math.max(0, totalReach) : 0;
  if (reach <= 0) return 0;
  const scale = Math.sqrt(reach / tuning.referenceReach);
  const cap = Math.min(tuning.maxPerTick, SLURP_TUNING_PULSE_PER_TICK_CEILING);
  return Math.min(cap, Math.floor((elapsedMinutes / tuning.minutesPerReaction) * scale));
}

/**
 * A post that got lucky.
 *
 * Real feeds are not smooth: most posts do what the average says and one in fifty is seen by
 * people the creator never reached. Deterministic on the post id, so a post is either lucky or it
 * is not and it cannot flicker between two ticks, and time-boxed by `viralHours`, so the luck runs
 * out rather than making one post the permanent centre of the platform.
 */
export function slurpPostViralMultiplier(
  postId: string,
  ageHours: number,
  tuning: PulseTuning = SLURP_REALISTIC_TUNING.pulse,
): number {
  if (!(tuning.viralChance > 0) || ageHours > tuning.viralHours) return 1;
  return mulberry32(hashSeed(`viral:${postId}`))() < tuning.viralChance ? tuning.viralMultiplier : 1;
}

/**
 * What arrives in this pulse.
 *
 * Newer posts attract more than older ones, which is what makes a post you just made feel like it
 * landed. Returns an empty plan when there is nobody to act, nothing recent to act on, or too
 * little time has passed.
 */
export function planSlurpWorldPulse(
  input: {
    elapsedMinutes: number;
    targets: readonly SlurpPulseTarget[];
    audience: readonly string[];
    /** Anything already in this pulse's window, so a pulse never re-likes the same post twice. */
    seed: string;
    /** Activity multiplier. Zero means nothing arrives while you read, which is the point of "off". */
    activity?: number;
    /** Per-actor Fan Type behaviour, keyed by actor id. Absent keeps the old fixed split. */
    actorWeights?: ReadonlyMap<string, SlurpPulseActorWeights>;
  },
  tuning: PulseTuning = SLURP_REALISTIC_TUNING.pulse,
): SlurpPulseAction[] {
  const activity = Number.isFinite(input.activity) ? Math.max(0, input.activity ?? 1) : 1;
  if (activity === 0) return [];
  // Past `postMaxAgeHours` a post is silent, unless `oldPostTrickle` keeps a small share for it.
  const fresh = input.targets.filter(
    (target) =>
      Number.isFinite(target.ageHours) &&
      target.ageHours >= 0 &&
      (target.ageHours <= tuning.postMaxAgeHours || tuning.oldPostTrickle > 0),
  );
  if (fresh.length === 0 || input.audience.length === 0) return [];

  // Sum over distinct Creators rather than average over posts. This divided by `fresh.length`,
  // which made the name a lie and the dial useless: six Creators pulsed exactly as slowly as one,
  // and publishing more only diluted the mean, so the two things a player does to make the world
  // busier both did nothing. Reach belongs to a Creator, so one with eight fresh posts counts once.
  const reachByCreator = new Map(fresh.map((target) => [target.creatorAccountId, Math.max(0, target.creatorReach)]));
  const totalReach = [...reachByCreator.values()].reduce((sum, value) => sum + value, 0);
  const budget = slurpPulseBudget(input.elapsedMinutes * activity, totalReach, tuning);
  if (budget <= 0) return [];

  const random = mulberry32(hashSeed(input.seed));
  // Weight toward the newest posts: a reaction on something you published minutes ago is the whole
  // point, and one on a two-day-old post is noise.
  const weighted = fresh
    .map((target) => ({
      target,
      weight:
        (target.ageHours <= tuning.postMaxAgeHours
          ? 1 / (1 + target.ageHours)
          : (tuning.oldPostTrickle / (1 + target.ageHours)) * (tuning.postMaxAgeHours / target.ageHours)) *
        slurpPostViralMultiplier(target.postId, target.ageHours, tuning),
    }))
    .sort((left, right) => right.weight - left.weight);
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);

  const actions: SlurpPulseAction[] = [];
  const used = new Set<string>();
  for (let index = 0; index < budget * 3 && actions.length < budget; index += 1) {
    let roll = random() * totalWeight;
    const chosen = weighted.find((entry) => (roll -= entry.weight) <= 0) ?? weighted[0]!;
    const actor = pickActor(input.audience, input.actorWeights, random);
    const key = `${chosen.target.postId}:${actor}`;
    if (used.has(key)) continue;
    used.add(key);
    // Roughly one in six reactions is somebody deciding to follow rather than just tapping like.
    // Comments were one in ten, which at this budget is one free comment every two and a half
    // hours — the comment section is the part a player actually reads, and it was the rarest
    // thing the free tier produced. Likes are still the clear majority, as every real feed has
    // and as `slurp-reach.ts` already claims in its counts.
    const kindRoll = random();
    actions.push({
      creatorAccountId: chosen.target.creatorAccountId,
      postId: chosen.target.postId,
      actorAccountId: actor,
      kind: pickKind(input.actorWeights?.get(actor), kindRoll),
    });
  }

  // Word of mouth. A share of the people already following bring somebody new, so growth compounds
  // instead of depending entirely on the player publishing. Rolled on the same generator as the
  // rest of the plan, so it is deterministic per seed, and it takes the fractional part as a
  // chance rather than flooring it away — at a five-minute tick the whole expected value is the
  // fraction, so flooring would mean the rule never fired at all.
  const followsBefore = actions.filter((action) => action.kind === "follow").length;
  const days = (input.elapsedMinutes * activity) / 1440;
  const expected = totalReach * Math.max(0, tuning.wordOfMouth) * days;
  // Clamped to the hard ceiling before the loop, so a bad setting cannot ask for a million.
  const mouths = Math.min(
    SLURP_TUNING_PULSE_PER_TICK_CEILING,
    Math.floor(expected) + (random() < expected - Math.floor(expected) ? 1 : 0),
  );
  for (let index = 0; index < mouths * 3 && actions.length < SLURP_TUNING_PULSE_PER_TICK_CEILING; index += 1) {
    if (actions.filter((action) => action.kind === "follow").length >= followsBefore + mouths) break;
    let roll = random() * totalWeight;
    const chosen = weighted.find((entry) => (roll -= entry.weight) <= 0) ?? weighted[0]!;
    const actor = pickActor(input.audience, input.actorWeights, random);
    // A recommendation still has to land on somebody who follows people. A crowd of Lurkers hears
    // about the Creator and carries on lurking.
    const weight = input.actorWeights?.get(actor);
    if (weight && (weight.follow <= 0 || weight.followChance <= 0)) continue;
    const key = `${chosen.target.postId}:${actor}`;
    if (used.has(key)) continue;
    used.add(key);
    actions.push({
      creatorAccountId: chosen.target.creatorAccountId,
      postId: chosen.target.postId,
      actorAccountId: actor,
      kind: "follow",
    });
  }

  // Likes get their own budget. Scale 1 is the shared plan above, exactly; below 1 drops a share of
  // its likes, above 1 adds reach-scaled likes that only the hard ceiling bounds, never `maxPerTick`.
  if (tuning.likeBudgetScale < 1) {
    let keep = Math.floor(actions.filter((action) => action.kind === "like").length * tuning.likeBudgetScale);
    return actions.filter((action) => action.kind !== "like" || keep-- > 0);
  }
  const reachScale = Math.sqrt(totalReach / tuning.referenceReach);
  const earned = Math.floor(((input.elapsedMinutes * activity) / tuning.minutesPerReaction) * reachScale);
  const extra = Math.min(
    SLURP_TUNING_PULSE_PER_TICK_CEILING - actions.length,
    Math.floor(earned * (tuning.likeBudgetScale - 1)),
  );
  const target = actions.length + Math.max(0, extra);
  for (let index = 0; index < extra * 3 && actions.length < target; index += 1) {
    let roll = random() * totalWeight;
    const chosen = weighted.find((entry) => (roll -= entry.weight) <= 0) ?? weighted[0]!;
    const actor = pickActor(input.audience, input.actorWeights, random);
    const key = `${chosen.target.postId}:${actor}`;
    if (used.has(key)) continue;
    used.add(key);
    actions.push({
      creatorAccountId: chosen.target.creatorAccountId,
      postId: chosen.target.postId,
      actorAccountId: actor,
      kind: "like",
    });
  }
  return actions;
}

/**
 * How one applied reaction moves the tie. A follow also writes a like row, and that row may
 * already exist from an earlier like; the follow still counts, it just adds no interaction.
 * A like or comment that wrote nothing is not news.
 */
export function slurpPulseTieAdvance(
  kind: SlurpPulseAction["kind"],
  created: boolean,
): { stage: "follower" | "liker"; interactions: number } | null {
  if (kind === "follow") return { stage: "follower", interactions: created ? 1 : 0 };
  return created ? { stage: "liker", interactions: 1 } : null;
}
