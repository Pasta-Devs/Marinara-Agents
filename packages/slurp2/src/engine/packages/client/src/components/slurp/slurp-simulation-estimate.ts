/**
 * What a week under these settings would look like.
 *
 * Pure, and deliberately the same functions the tick itself runs (`slurp-reach`,
 * `slurp-world-pulse`, `slurp-world`, `slurp-audience-subscription`), imported from the server
 * rules rather than reimplemented — an estimate that models the simulation with its own arithmetic
 * is a second simulation to keep in step, and it would drift the first time a rule changed.
 *
 * The sample creator is fixed on purpose: the number the settings screen shows is a comparison
 * between settings, not a forecast for one particular roster.
 */
import {
  slurpAudiencePaidThrough,
  slurpAudienceSubscriptionDecision,
} from "../../../../server/src/services/slurp/slurp-audience-subscription.js";
import { generateSlurpPopulationMember } from "../../../../server/src/services/slurp/slurp-population.js";
import { slurpCreatorReach } from "../../../../server/src/services/slurp/slurp-reach.js";
import { slurpWorldTimerDue, type SlurpSimulationTuning } from "../../../../server/src/services/slurp/slurp-tuning.js";
import { planSlurpWorldPulse } from "../../../../server/src/services/slurp/slurp-world-pulse.js";
import { planSlurpWorldTick } from "../../../../server/src/services/slurp/slurp-world.js";

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
};

export const SLURP_ESTIMATE_SAMPLE: SlurpEstimateSample = {
  accountId: "estimate-creator",
  ageDays: 30,
  realFollowers: 10,
  price: 12,
  postsPerDay: 1,
};

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
): SlurpSimulationEstimate {
  const audience = Array.from({ length: tuning.pulse.poolSize }, (_, index) => `estimate-fan-${index}`);
  // Half the pool are ambient profiles, which hold no population row and pay only with
  // `funnel.ambientCanPay`, exactly as the tick treats them.
  const ambient = new Set(audience.filter((_, index) => index % 2 === 1));
  const createdAt = new Date(startMs - sample.ageDays * DAY_MS).toISOString();
  const spendTiers = new Map<string, ReturnType<typeof generateSlurpPopulationMember>["spendTier"]>();
  const spendTierFor = (memberId: string) => {
    let tier = spendTiers.get(memberId);
    if (!tier) {
      tier =
        ambient.has(memberId) && !tuning.funnel.ambientCanPay
          ? "none"
          : generateSlurpPopulationMember(memberId, new Date(startMs)).spendTier;
      spendTiers.set(memberId, tier);
    }
    return tier;
  };

  // One post a day, and the two days before the week so the pulse has something to land on at the
  // start rather than an empty feed.
  const posts: { id: string; at: number }[] = [];
  const perDay = Math.max(0, sample.postsPerDay);
  for (let day = -2; day < SLURP_ESTIMATE_DAYS; day += 1) {
    for (let index = 0; index < perDay; index += 1) {
      posts.push({ id: `estimate-post-${day}-${index}`, at: startMs + day * DAY_MS + (index + 1) * HOUR_MS * 10 });
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
      { elapsedMinutes: (nowMs - pulseSinceMs) / 60_000, targets, audience, seed: `${pulseSinceMs}:${nowMs}` },
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
        creators: [{ id: sample.accountId, followers, recentPostIds, openRequests: 0 }],
        audience,
        catchUpHours: tuning.clock.catchUpHours,
      },
      tuning.world,
    )) {
      if (action.kind === "commission") {
        counts.commissions += 1;
        counts.income += tuning.economy.audienceCommissionPrice;
      } else if (action.kind === "message") counts.messages += 1;
      else counts.questions += 1;
    }

    for (const [memberId, tie] of ties) {
      const decision = slurpAudienceSubscriptionDecision(
        {
          memberId,
          creatorAccountId: sample.accountId,
          stage: tie.stage,
          spendTier: spendTierFor(memberId),
          price: sample.price,
          paidThroughAt: tie.paidThroughAt,
          interactions: tie.interactions,
          followedAt: tie.followedAt,
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
  };
}
