/**
 * What the world does when nobody is looking.
 *
 * Pure, like the other Slurp rule modules. Deciding is separate from applying so the rates can be
 * tested without a database, and so the same plan can be produced by the background tick and by
 * the catch-up on open — the two callers of `advanceWorld` the plan requires.
 *
 * ## Why the world has to ask for things
 *
 * A review found every planned mechanic was the world *acting*: likes landed, people subscribed,
 * someone lapsed. Nothing ever required a response. A world that never needs you is a screensaver.
 * These actions are the obligation layer: somebody asks the Creator for something, and the request
 * sits there until it is answered.
 *
 * ## Rates
 *
 * The maintainer set the volume at a readable handful — ten to twenty notable events a day across
 * every Creator. A commission request is the heaviest event there is, so it must be rare. Elapsed
 * time is **capped** rather than scaled linearly: coming back after a month must not produce a
 * month of backlog, because an inbox that cannot be cleared is the failure mode this rule exists
 * to prevent.
 */

import {
  SLURP_REALISTIC_TUNING,
  SLURP_TUNING_ACTIONS_PER_TICK_CEILING,
  type SlurpSimulationTuning,
} from "./slurp-tuning.js";

export type SlurpWorldAction =
  /** Somebody asks the Creator to make something. */
  | { kind: "commission"; creatorAccountId: string; actorAccountId: string }
  /** Somebody asks a question under a post and expects an answer. */
  | { kind: "question"; creatorAccountId: string; actorAccountId: string; postId: string }
  /** Somebody writes to the Creator without being written to first. */
  | { kind: "message"; creatorAccountId: string; actorAccountId: string }
  /** Somebody pays the Creator for nothing in particular. */
  | { kind: "tip"; creatorAccountId: string; actorAccountId: string; amount: number }
  /** Somebody buys one locked post. */
  | { kind: "unlock"; creatorAccountId: string; actorAccountId: string; postId: string; amount: number };

/**
 * What one actor's Fan Type makes them ask for.
 *
 * One per audience id, as `planSlurpWorldPulse` already takes. Missing reads as an ordinary fan
 * who never tips, which is exactly the behaviour before Fan Types reached this module.
 */
export type SlurpWorldActorWeights = {
  question: number;
  dm: number;
  commission: number;
  tip: number;
  unlock: number;
  /** Chance per day that this person tips one Creator they already pay attention to. */
  tipChance: number;
  /** Their free-simulation purchasing ceiling. */
  weeklyBudget: number;
  /** A precomputed share of that budget, so the pure planner can emit the payment amount. */
  tipAmount: number;
};

const NEUTRAL_WEIGHTS: SlurpWorldActorWeights = {
  question: 1,
  dm: 1,
  commission: 1,
  tip: 1,
  unlock: 1,
  tipChance: 0,
  weeklyBudget: 0,
  tipAmount: 1,
};

/** The funnel stages, in order. A tie the caller does not know about reads as a stranger. */
const STAGE_RANK: Record<string, number> = {
  stranger: 0,
  viewer: 1,
  liker: 2,
  lapsed: 2,
  follower: 3,
  subscriber: 4,
  regular: 5,
  whale: 6,
};

/**
 * How well somebody has to know a Creator before they ask for this.
 *
 * A stranger does not commission and does not tip: money and heavy asks come from people who have
 * been around, which is what the funnel stage has been recording all along.
 */
const MIN_STAGE: Record<SlurpWorldAction["kind"], number> = {
  question: 0,
  message: 0,
  commission: STAGE_RANK.liker!,
  tip: STAGE_RANK.follower!,
  unlock: STAGE_RANK.liker!,
};

/** Tries at finding somebody eligible before the world gives up on this kind of ask this tick. */
const ACTOR_ATTEMPTS = 4;

export type SlurpWorldCreator = {
  id: string;
  followers: number;
  /** Posts recent enough to still be drawing attention. Empty means nothing to ask about. */
  recentPostIds: readonly string[];
  /** Locked posts this audience can buy, newest first. */
  lockedPosts?: readonly { id: string; price: number }[];
  /**
   * Requests already waiting on this Creator: unanswered commissions and unanswered conversations
   * alike. A queue nobody has replied to gets no more, or an obligation layer becomes a chore.
   */
  openRequests: number;
};

/**
 * However long the player was away, the world only ever catches up this much.
 *
 * Three days of backlog is enough to feel that time passed and small enough to still read in one
 * sitting.
 */
export const SLURP_WORLD_MAX_CATCHUP_DAYS = 3;

/** Never start a new request while this many are already unanswered (realistic `world.maxOpenRequests`). */
export const SLURP_WORLD_MAX_OPEN_REQUESTS = SLURP_REALISTIC_TUNING.world.maxOpenRequests;

/** Ceiling per tick across every Creator (realistic `world.maxActionsPerTick`), so a roster cannot flood. */
export const SLURP_WORLD_MAX_ACTIONS = SLURP_REALISTIC_TUNING.world.maxActionsPerTick;

type WorldTuning = SlurpSimulationTuning["world"];
type ChanceCurve = WorldTuning["commission"];

function chancePerDay(followers: number, curve: ChanceCurve): number {
  const count = Number.isFinite(followers) ? Math.max(0, followers) : 0;
  if (count < curve.floor || count <= 0) return 0;
  return Math.min(curve.cap, Math.log10(count / Math.max(1, curve.floor)) * curve.curve);
}

const DAY_MS = 86_400_000;

/**
 * Audience a Creator needs before the world will do each thing.
 *
 * These used to be 50, 100 and 250 against a synthetic floor of 240 (`MIN_BASE_REACH`), so a new
 * Creator got a question about once a week and *could not receive an unprompted message at all* —
 * they were below the floor for it. The obligation layer only switched on for a Creator the
 * player had already grown, which is exactly backwards: a new Creator is the one who needs the
 * world to prove it is there.
 *
 * Set well under the synthetic floor so day one is not silent. The per-tick action ceiling
 * (`SLURP_WORLD_MAX_ACTIONS`) and the unanswered-queue limit still hold the volume down.
 */
// Floors, caps and coefficients now live in Simulation Tuning (`world.commission|message|question`).

/** Deterministic, so a plan can be asserted in a test and reproduced from a log. */
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
 * Chance per day that somebody asks this Creator for a commission.
 *
 * Scales with audience on a log curve: a Creator with ten times the followers gets more requests,
 * but not ten times as many, because the player's time to answer them did not scale at all.
 */
export function slurpCommissionChancePerDay(
  followers: number,
  curve: ChanceCurve = SLURP_REALISTIC_TUNING.world.commission,
): number {
  return chancePerDay(followers, curve);
}

/**
 * Chance per day that somebody writes to the Creator unprompted.
 *
 * The rarest thing the world does, and deliberately so. A stranger opening a conversation is the
 * strongest signal the world can send — somebody addressed *you* — and it stops being a signal the
 * moment it is routine.
 */
export function slurpMessageChancePerDay(
  followers: number,
  // Realistic holds the coefficient under the commission curve's, against a higher floor, so an
  // unprompted message stays the rarest thing the world does at every audience size.
  curve: ChanceCurve = SLURP_REALISTIC_TUNING.world.message,
): number {
  return chancePerDay(followers, curve);
}

/** Chance per day that somebody asks a question under a recent post. Commoner and lighter. */
export function slurpQuestionChancePerDay(
  followers: number,
  curve: ChanceCurve = SLURP_REALISTIC_TUNING.world.question,
): number {
  return chancePerDay(followers, curve);
}

/** Days of world time to apply, capped so a long absence does not become a backlog. */
export function slurpWorldElapsedDays(
  since: Date | null,
  until: Date,
  catchUpHours = SLURP_REALISTIC_TUNING.clock.catchUpHours,
): number {
  if (!since) return 0;
  const days = (until.getTime() - since.getTime()) / DAY_MS;
  if (!Number.isFinite(days) || days <= 0) return 0;
  return Math.min(catchUpHours / 24, days);
}

/**
 * Posts a question may land under. With `needsRecent` only posts newer than `cutoff`; without it
 * the creator's latest posts at any age. Drafts never.
 */
export function slurpQuestionPostIds(
  posts: readonly { id: string; createdAt: string; access: string }[],
  cutoff: string,
  needsRecent: boolean,
): string[] {
  return posts
    .filter((post) => post.access !== "draft" && (!needsRecent || post.createdAt >= cutoff))
    .map((post) => post.id);
}

/**
 * Decide what the world does for this stretch of time.
 *
 * Returns an empty plan when there is nobody to act, nothing to act on, or no time has passed.
 * A first ever tick (`since` is null) also does nothing: there is no stretch of time to simulate,
 * and inventing one would mean a brand-new install opens to a backlog it never earned.
 */
export function planSlurpWorldTick(
  input: {
    since: Date | null;
    until: Date;
    creators: readonly SlurpWorldCreator[];
    /** Account ids that may act. Empty means the world stays silent. */
    audience: readonly string[];
    /**
     * Per-actor Fan Type weights. Absent, or missing an id, reads as neutral: the volume and the
     * mix are exactly what they were before Fan Types decided who does what.
     */
    actorWeights?: ReadonlyMap<string, SlurpWorldActorWeights>;
    /**
     * This actor's funnel stage with this Creator. Absent means the caller does not track ties, so
     * nothing is gated on one — the estimate and the older tests keep their numbers.
     */
    stageOf?: (creatorAccountId: string, actorAccountId: string) => string | undefined;
    /**
     * Activity multiplier from the world-activity dial. Zero is a real off switch: somebody who
     * wants to write undisturbed gets exactly that, not a quieter version of being interrupted.
     */
    activity?: number;
    /** `clock.catchUpHours`: the longest stretch one tick simulates. */
    catchUpHours?: number;
  },
  tuning: WorldTuning = SLURP_REALISTIC_TUNING.world,
): SlurpWorldAction[] {
  const maxActions = Math.min(tuning.maxActionsPerTick, SLURP_TUNING_ACTIONS_PER_TICK_CEILING);
  const activity = Number.isFinite(input.activity) ? Math.max(0, input.activity ?? 1) : 1;
  if (activity === 0) return [];
  const days = slurpWorldElapsedDays(input.since, input.until, input.catchUpHours) * activity;
  if (days <= 0 || input.audience.length === 0 || input.creators.length === 0) return [];

  const random = mulberry32(hashSeed(`${input.until.toISOString()}:${input.creators.length}`));
  const actions: SlurpWorldAction[] = [];
  const pick = () => input.audience[Math.floor(random() * input.audience.length)]!;
  const weightsOf = (actorId: string) => input.actorWeights?.get(actorId) ?? NEUTRAL_WEIGHTS;
  const rankOf = (creatorAccountId: string, actorId: string) =>
    input.stageOf ? (STAGE_RANK[input.stageOf(creatorAccountId, actorId) ?? "stranger"] ?? 0) : STAGE_RANK.whale!;

  // Shuffle before walking. The action ceiling is reached by taking creators in order, so a fixed
  // order would spend the whole budget on whichever Creators happen to sort first and leave the
  // rest of a large roster permanently silent.
  const order = [...input.creators];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [order[index], order[swap]] = [order[swap]!, order[index]!];
  }

  for (const creator of order) {
    if (actions.length >= maxActions) break;
    if (creator.openRequests >= tuning.maxOpenRequests) continue;

    // The actor comes first now. Who turned up decides what gets asked for, so a world of Lurkers
    // is quiet in a way no per-Creator rate could express.
    /**
     * Somebody who may do this. A few draws keep a crowd of strangers from silently halving every
     * rate, while returning the chosen fan's weights ensures probability and identity never come
     * from two different people.
     */
    const actorFor = (kind: SlurpWorldAction["kind"]): { id: string; weights: SlurpWorldActorWeights } | null => {
      const key = kind === "message" ? "dm" : kind;
      for (let attempt = 0; attempt < ACTOR_ATTEMPTS; attempt += 1) {
        const actorAccountId = pick();
        const weights = weightsOf(actorAccountId);
        if (weights[key as "question" | "dm" | "commission" | "tip" | "unlock"] <= 0) continue;
        if (rankOf(creator.id, actorAccountId) < MIN_STAGE[kind]) continue;
        return { id: actorAccountId, weights };
      }
      return null;
    };

    const commissionActor = actorFor("commission");
    if (
      commissionActor &&
      random() <
        slurpCommissionChancePerDay(creator.followers, tuning.commission) * days * commissionActor.weights.commission
    ) {
      actions.push({ kind: "commission", creatorAccountId: creator.id, actorAccountId: commissionActor.id });
      // One heavy ask per Creator per tick. Two at once reads as a glitch, not as popularity.
      continue;
    }

    const messageActor = actorFor("message");
    if (
      messageActor &&
      random() < slurpMessageChancePerDay(creator.followers, tuning.message) * days * messageActor.weights.dm
    ) {
      actions.push({ kind: "message", creatorAccountId: creator.id, actorAccountId: messageActor.id });
      continue;
    }

    const questionActor = actorFor("question");
    if (
      questionActor &&
      creator.recentPostIds.length > 0 &&
      random() < slurpQuestionChancePerDay(creator.followers, tuning.question) * days * questionActor.weights.question
    ) {
      const postId = creator.recentPostIds[Math.floor(random() * creator.recentPostIds.length)]!;
      actions.push({ kind: "question", creatorAccountId: creator.id, actorAccountId: questionActor.id, postId });
      continue;
    }

    // Last, so a tip never takes the place of an ask. It is the cheapest thing here and the only
    // one that asks nothing of the player, so it fills a tick the rest of the rolls left empty.
    const tipActor = actorFor("tip");
    if (
      tipActor &&
      tipActor.weights.tipChance > 0 &&
      random() < tipActor.weights.tipChance * tipActor.weights.tip * days
    ) {
      actions.push({
        kind: "tip",
        creatorAccountId: creator.id,
        actorAccountId: tipActor.id,
        amount: tipActor.weights.tipAmount,
      });
      continue;
    }

    const unlockActor = actorFor("unlock");
    const affordable = (creator.lockedPosts ?? []).filter(
      (post) => post.price > 0 && post.price <= (unlockActor?.weights.weeklyBudget ?? 0),
    );
    if (
      unlockActor &&
      affordable.length > 0 &&
      random() < tuning.unlockChancePerDay * unlockActor.weights.unlock * days
    ) {
      const post = affordable[Math.floor(random() * affordable.length)]!;
      actions.push({
        kind: "unlock",
        creatorAccountId: creator.id,
        actorAccountId: unlockActor.id,
        postId: post.id,
        amount: post.price,
      });
    }
  }

  return actions.slice(0, maxActions);
}

/**
 * What one tip is worth.
 *
 * A share of what this person spends on a Creator in a week, so a Whale tips like a Whale without
 * a second budget to keep in step. Never zero: a tip of nothing is not a tip.
 */
export function slurpAudienceTipAmount(weeklyBudget: number, share: number): number {
  const budget = Number.isFinite(weeklyBudget) ? Math.max(0, weeklyBudget) : 0;
  const portion = Number.isFinite(share) ? Math.max(0, share) : 0;
  return Math.max(1, Math.round(budget * portion));
}

/**
 * How likely a creator is to answer one comment.
 *
 * A creator who answers everything is a bot, and one who answers nothing is a wall. The number
 * that decides which comments get answered should be the one that already describes what somebody
 * is to this creator, so being a particular fan changes something visible rather than only
 * changing a prompt nobody sees.
 *
 * Nobody is at zero. A first comment from a stranger sometimes getting a reply is exactly the
 * thing that makes people comment again, and gating it entirely on history means only people who
 * already have history ever get anything.
 */
export function slurpCreatorReplyChance(tie: { stage: string; spent: number; interactions: number } | null): number {
  if (!tie) return 0.08;
  const byStage: Record<string, number> = {
    stranger: 0.08,
    viewer: 0.12,
    liker: 0.18,
    follower: 0.3,
    subscriber: 0.5,
    regular: 0.5,
    whale: 0.7,
    lapsed: 0.12,
  };
  const base = byStage[tie.stage] ?? 0.1;
  // Having paid, and having kept turning up, both earn attention on their own.
  const paid = tie.spent > 0 ? 0.15 : 0;
  const familiar = Math.min(0.12, Math.max(0, tie.interactions) * 0.01);
  return Math.min(0.8, base + paid + familiar);
}

/** Replies a creator writes in one tick. A wall of answers at once reads as a script, not a person. */
export const SLURP_MAX_CREATOR_REPLIES_PER_TICK = 3;

/**
 * Whether a creator writes to somebody who did not write first, and what kind of message it is.
 *
 * `null` is the usual answer, and has to stay the usual answer. A creator who opens conversations
 * freely is a mailing list, and the whole value of being messaged is that it does not happen much.
 *
 * Two paths, because a real platform has two. Somebody with history who has gone quiet gets
 * noticed, which is what the rapport model's silence decay was always measuring and what nothing
 * ever read. Everybody else gets a small flat chance — a creator with a slow afternoon says hello
 * to somebody ordinary. Without that second path only whales ever hear from anyone, which is both
 * bleak and untrue to how these places work.
 */
export function slurpCreatorOpenerKind(input: {
  tie: { stage: string; spent: number; interactions: number } | null;
  /** Days since this person last did anything with this creator. */
  daysSinceSeen: number;
  /** Whether a conversation already exists. A creator does not "open" one twice. */
  hasThread: boolean;
  /** Stable number in [0, 1) for this pair and stretch of time. */
  roll: number;
  mood?: number;
}): "missed" | "cold" | null {
  if (input.hasThread) return null;
  const tie = input.tie;
  // Somebody who was really here and stopped. Needs history, or every stranger reads as a loss.
  const wasPresent = tie !== null && tie.interactions >= 5 && (tie.spent > 0 || tie.interactions >= 12);
  if (wasPresent && input.daysSinceSeen >= 10 && input.daysSinceSeen <= 90) {
    return input.roll < 0.25 ? "missed" : null;
  }
  // The ordinary case. Deliberately small: at a couple of hundred ties this is still only a
  // handful of unprompted messages a month across the whole platform.
  if (tie !== null && tie.stage !== "stranger" && input.daysSinceSeen <= 30) {
    const moodBoost =
      input.mood !== undefined && input.mood >= 40 ? 0.02 : input.mood !== undefined && input.mood <= -40 ? -0.01 : 0;
    return input.roll < Math.max(0, 0.015 + moodBoost) ? "cold" : null;
  }
  return null;
}

/** Unprompted creator messages per tick. Being messaged stops meaning anything in bulk. */
export const SLURP_MAX_CREATOR_OPENERS_PER_TICK = 1;
