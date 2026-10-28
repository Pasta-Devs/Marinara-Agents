/**
 * What a week under these settings would look like.
 *
 * Pure, and deliberately the same functions the tick itself runs (`slurp-reach`,
 * `slurp-world-pulse`, `slurp-world`, `slurp-audience-subscription`), imported from the server
 * rules rather than reimplemented — an estimate that models the simulation with its own arithmetic
 * is a second simulation to keep in step, and it would drift the first time a rule changed.
 *
 * The sample creator is fixed on purpose: the number the settings screen shows is a comparison
 * between settings, not a forecast for one particular roster. The rest of the world is the player's
 * own (`SlurpEstimateWorld`): Fan Types, the world dial, background profiles and AI-written runs.
 */
import {
  slurpAudiencePaidThrough,
  slurpAudienceSubscriptionDecision,
} from "../../../../../shared/src/slp/slp-audience-subscription.js";
import {
  SLURP_BUILTIN_FAN_TYPES,
  slurpFanTypeForPinnedOrSeed,
  slurpFanTypeSpendTier,
  slurpFanTypeWeeklyBudget,
  slurpResolveFanType,
  type SlurpFanType,
} from "../../../../../shared/src/slp/slp-fan-types.js";
import { generateSlurpPopulationMember } from "../../../../../shared/src/slp/slp-population.js";
import { slurpWorldActivityMultiplier, type SlurpWorldActivity } from "../../../../../shared/src/slp/slp-scale.js";
import { AMBIENT_SLP_ENTITY_IDS } from "../../../../../shared/src/slp/slp-social.schema.js";
import { slurpCreatorReach } from "../../../../../shared/src/slp/slp-reach.js";
import {
  slurpRhythmMultiplier,
  slurpWorldTimerDue,
  type SlurpSimulationTuning,
} from "../../../../../shared/src/slp/slp-tuning.js";
import { planSlurpWorldPulse } from "../../../../../shared/src/slp/slp-world-pulse.js";
import {
  planSlurpWorldTick,
  slurpAudienceTipAmount,
  type SlurpWorldActorWeights,
} from "../../../../../shared/src/slp/slp-world.js";
import type { SlurpPulseActorWeights } from "../../../../../shared/src/slp/slp-world-pulse.js";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** One creator, held still, so two settings can be compared on the same world. */
export type SlurpEstimateSample = {
  accountId: string;
  /** How long the creator has existed when the week starts. Drives the invented audience. */
  ageDays: number;
  realFollowers: number;
  /** Weekly subscription price, in coins. */
  price: number;
  postsPerDay: number;
  /** Every `lockedEvery`-th post is locked at `unlockPrice` coins, so unlocks have something to buy. */
  lockedEvery: number;
  unlockPrice: number;
};

export const SLURP_ESTIMATE_SAMPLE: SlurpEstimateSample = {
  accountId: "estimate-creator",
  ageDays: 30,
  realFollowers: 10,
  price: 12,
  postsPerDay: 1,
  lockedEvery: 3,
  unlockPrice: 3,
};

/**
 * The settings outside the tuning that change what the world does (R1-116): who the audience is
 * (Fan Types, the background profiles), how loud it is (the world dial) and the AI-written fan runs.
 * Each is optional and falls back to its install default, so the tuning alone still estimates.
 */
export type SlurpEstimateWorld = {
  fanTypes?: readonly SlurpFanType[];
  worldActivity?: SlurpWorldActivity;
  allowRandomUsers?: boolean;
  fanActivityEnabled?: boolean;
  fanActivityRunsPerDay?: number;
  fanLikesPerRefresh?: number;
  fanRepliesPerRefresh?: number;
  modelBudget?: { jobs: { thread: { maxPerDay: number } } };
};

/**
 * AI-written fan runs a day: the setting, capped by the budget row, as `slpCreatorFanActivityRunLimit`
 * decides it on the server (the regression test holds the two together). Occasions are left out.
 */
export function slurpEstimateModelRuns(world: SlurpEstimateWorld): number {
  if (!world.fanActivityEnabled) return 0;
  return Math.max(0, Math.min(world.fanActivityRunsPerDay ?? 0, world.modelBudget?.jobs.thread.maxPerDay ?? Infinity));
}

export const SLURP_ESTIMATE_DAYS = 7;

/** Averages per day over the simulated week. */
export type SlurpSimulationEstimate = {
  followers: number;
  likes: number;
  follows: number;
  comments: number;
  subscriptions: number;
  income: number;
  commissions: number;
  messages: number;
  questions: number;
  tips: number;
  unlocks: number;
};

type Tie = {
  stage: "liker" | "follower" | "subscriber";
  interactions: number;
  followedAt: string | null;
  paidThroughAt: string | null;
};

/**
 * Run the free clock over a week of a sample creator and average what it produced.
 *
 * Cheap enough to run on every settings edit: a few thousand ticks of pure arithmetic over a pool
 * of `pulse.poolSize` people, with no allocation per member beyond the tie it holds.
 */
export function estimateSlurpSimulation(
  tuning: SlurpSimulationTuning,
  sample: SlurpEstimateSample = SLURP_ESTIMATE_SAMPLE,
  startMs = Date.parse("2026-03-01T00:00:00Z"),
  world: SlurpEstimateWorld = {},
): SlurpSimulationEstimate {
  const fanTypes = world.fanTypes ?? SLURP_BUILTIN_FAN_TYPES;
  const activity = slurpWorldActivityMultiplier(world.worldActivity);
  // The generated pool, plus the shipped background profiles only when they are switched on, as the
  // tick builds its audience. Background profiles hold no population row and pay only with
  // `funnel.ambientCanPay`.
  const joinedAt = new Date(startMs);
  const members = Array.from({ length: tuning.pulse.poolSize }, (_, index) =>
    generateSlurpPopulationMember(`estimate-fan-${index}`, joinedAt, fanTypes),
  );
  const ambientIds = world.allowRandomUsers ? AMBIENT_SLP_ENTITY_IDS.map((id) => `estimate-${id}`) : [];
  const audience = [...members.map((member) => member.id), ...ambientIds];
  const ambient = new Set(ambientIds);
  const createdAt = new Date(startMs - sample.ageDays * DAY_MS).toISOString();
  // What each person's Fan Type makes them do, built the way the tick builds `actorWeights`.
  const typeOf = new Map<string, SlurpFanType>([
    ...members.map((member) => [member.id, slurpResolveFanType(fanTypes, member)] as const),
    ...ambientIds.map((id) => [id, slurpFanTypeForPinnedOrSeed(fanTypes, null, id)] as const),
  ]);
  const actorWeights = new Map<string, SlurpWorldActorWeights & SlurpPulseActorWeights>(
    audience.map((id) => {
      const type = typeOf.get(id)!;
      const weeklyBudget = slurpFanTypeWeeklyBudget(type, id);
      return [
        id,
        {
          activity: type.behavior.activity,
          like: type.behavior.like,
          follow: type.behavior.follow,
          comment: type.behavior.comment,
          followChance: type.funnel.followChance,
          question: type.behavior.question,
          dm: type.behavior.dm,
          commission: type.behavior.commission,
          tip: type.behavior.tip,
          unlock: type.behavior.unlock,
          tipChance: type.spend.tipChance,
          weeklyBudget,
          tipAmount: slurpAudienceTipAmount(weeklyBudget, tuning.economy.audienceTipShare),
        },
      ] as const;
    }),
  );
  /** Who can pay: a background profile only with `ambientCanPay`, as `payingFanTypeFor` decides. */
  const payingTypeOf = (memberId: string) =>
    ambient.has(memberId) && !tuning.funnel.ambientCanPay ? null : (typeOf.get(memberId) ?? null);

  // One post a day, and the two days before the week so the pulse has something to land on at the
  // start rather than an empty feed.
  const posts: { id: string; at: number; locked: boolean }[] = [];
  const perDay = Math.max(0, sample.postsPerDay);
  for (let day = -2; day < SLURP_ESTIMATE_DAYS; day += 1) {
    for (let index = 0; index < perDay; index += 1) {
      posts.push({
        id: `estimate-post-${day}-${index}`,
        at: startMs + day * DAY_MS + (index + 1) * HOUR_MS * 10,
        locked: sample.lockedEvery > 0 && posts.length % sample.lockedEvery === sample.lockedEvery - 1,
      });
    }
  }

  const ties = new Map<string, Tie>();
  const counts = {
    likes: 0,
    follows: 0,
    comments: 0,
    subscriptions: 0,
    income: 0,
    commissions: 0,
    messages: 0,
    questions: 0,
    tips: 0,
    unlocks: 0,
  };
  const tickMs = Math.max(1, tuning.clock.tickMinutes) * 60_000;
  const endMs = startMs + SLURP_ESTIMATE_DAYS * DAY_MS;
  let lastTickMs = startMs;
  let lastRunMs = startMs;
  let pulseSinceMs = startMs;
  let followers = 0;

  for (let nowMs = startMs + tickMs; nowMs <= endMs; nowMs += tickMs) {
    if (!slurpWorldTimerDue(tuning.clock, lastRunMs, nowMs)) continue;
    lastRunMs = nowMs;
    const at = new Date(nowMs);
    const rhythm = slurpRhythmMultiplier(at, tuning.rhythm);
    followers = slurpCreatorReach(
      { accountId: sample.accountId, createdAt, realFollowers: sample.realFollowers + counts.follows },
      at,
      tuning.reach,
    );
    const targets = posts
      .filter((post) => post.at <= nowMs)
      .map((post) => ({
        creatorAccountId: sample.accountId,
        postId: post.id,
        ageHours: (nowMs - post.at) / HOUR_MS,
        creatorReach: followers,
      }));

    // The pulse keeps its own mark, as the tick does: time too short to buy a whole reaction
    // carries into the next tick instead of being rounded away several hundred times a day.
    const pulse = planSlurpWorldPulse(
      {
        elapsedMinutes: (nowMs - pulseSinceMs) / 60_000,
        targets,
        audience,
        seed: `${pulseSinceMs}:${nowMs}`,
        // The platform's rhythm, exactly as the tick applies it: quiet at four in the morning,
        // busy in the evening, busier at the weekend. The world dial on top, as the tick applies it.
        activity: activity * rhythm,
        actorWeights,
      },
      tuning.pulse,
    );
    if (pulse.length > 0) pulseSinceMs = nowMs;
    for (const action of pulse) {
      const tie: Tie = ties.get(action.actorAccountId) ?? {
        stage: "liker",
        interactions: 0,
        followedAt: null,
        paidThroughAt: null,
      };
      tie.interactions += 1;
      if (action.kind === "follow") {
        if (tie.stage === "liker") tie.stage = "follower";
        tie.followedAt ??= at.toISOString();
        counts.follows += 1;
      } else if (action.kind === "comment") counts.comments += 1;
      else counts.likes += 1;
      ties.set(action.actorAccountId, tie);
    }

    const recentPostIds = targets
      .filter((target) => !tuning.world.questionNeedsRecentPost || target.ageHours <= tuning.pulse.postMaxAgeHours)
      .map((target) => target.postId);
    for (const action of planSlurpWorldTick(
      {
        since: new Date(lastTickMs),
        until: at,
        creators: [
          {
            id: sample.accountId,
            followers,
            recentPostIds,
            openRequests: 0,
            // The newest eight posts, as the tick reads them, and of those the locked ones.
            lockedPosts: targets
              .slice(-8)
              .filter((target) => posts.find((post) => post.id === target.postId)?.locked)
              .map((target) => ({ id: target.postId, price: sample.unlockPrice })),
          },
        ],
        audience,
        actorWeights,
        stageOf: (_creatorAccountId, actorAccountId) => ties.get(actorAccountId)?.stage,
        activity: activity * rhythm,
        catchUpHours: tuning.clock.catchUpHours,
      },
      tuning.world,
    )) {
      if (action.kind === "commission") {
        counts.commissions += 1;
        counts.income += tuning.economy.audienceCommissionPrice;
      } else if (action.kind === "message") counts.messages += 1;
      else if (action.kind === "tip") {
        counts.tips += 1;
        counts.income += action.amount;
      } else if (action.kind === "unlock") {
        counts.unlocks += 1;
        counts.income += action.amount;
      } else counts.questions += 1;
    }

    for (const [memberId, tie] of ties) {
      const fanType = payingTypeOf(memberId);
      if (!fanType) continue;
      const weeklyBudget = slurpFanTypeWeeklyBudget(fanType, memberId);
      const decision = slurpAudienceSubscriptionDecision(
        {
          memberId,
          creatorAccountId: sample.accountId,
          stage: tie.stage,
          spendTier: slurpFanTypeSpendTier(weeklyBudget),
          weeklyBudget,
          subConversionPerDay: fanType.funnel.subConversionPerDay,
          price: sample.price,
          paidThroughAt: tie.paidThroughAt,
          interactions: tie.interactions,
          followedAt: tie.followedAt,
          renewChance: fanType.funnel.renewChance,
        },
        at,
        tuning.funnel,
      );
      if (decision === "subscribe" || decision === "renew") {
        if (decision === "subscribe") {
          counts.subscriptions += 1;
          tie.stage = "subscriber";
        }
        tie.paidThroughAt = slurpAudiencePaidThrough(at);
        counts.income += sample.price;
      } else if (decision === "lapse") {
        tie.paidThroughAt = null;
        tie.stage = "follower";
      }
    }

    lastTickMs = nowMs;
  }

  const perDayOf = (total: number) => Math.round((total / SLURP_ESTIMATE_DAYS) * 100) / 100;
  // AI-written fan runs add their likes and replies on top of the free world, each run at its
  // ceiling. The runs are shared by every Creator, so for one Creator this is the most it gets.
  const modelRuns = slurpEstimateModelRuns(world) * SLURP_ESTIMATE_DAYS;
  counts.likes += modelRuns * (world.fanLikesPerRefresh ?? 0);
  counts.comments += modelRuns * (world.fanRepliesPerRefresh ?? 0);
  return {
    followers,
    likes: perDayOf(counts.likes),
    follows: perDayOf(counts.follows),
    comments: perDayOf(counts.comments),
    subscriptions: perDayOf(counts.subscriptions),
    income: perDayOf(counts.income),
    commissions: perDayOf(counts.commissions),
    messages: perDayOf(counts.messages),
    questions: perDayOf(counts.questions),
    tips: perDayOf(counts.tips),
    unlocks: perDayOf(counts.unlocks),
  };
}
