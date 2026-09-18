/**
 * The audience, materialised.
 *
 * Members are generated from a seed and only written once they act somewhere the player can see.
 * That is what lets a Creator show thousands of followers while a few hundred rows exist: the
 * count is reach, and the rows are the people who did something.
 */
import { tolerateMissingTables } from "./slurp-host-tables.js";
import { and, asc, desc, eq, inArray } from "../../db/file-query.js";
import { now } from "../../utils/id-generator.js";
import type { DB } from "../../db/connection.js";
import { noodleAccountSubscriptions, slurpAudienceTies, slurpPopulation } from "../../db/schema/slurp.js";
import { SLURP_AUDIENCE_ARCS, type SlurpAudienceArc } from "../slurp/slurp-audience-arc.js";
import {
  generateSlurpPopulationMember,
  isSlurpPopulationMemberId,
  SLURP_FUNNEL_STAGES,
  SLURP_NAMED_CAST_LIMIT,
  slurpReactivationStage,
  type SlurpFunnelStage,
  type SlurpPopulationMember,
  type SlurpSpendTier,
} from "../slurp/slurp-population.js";
import type { SlurpFanType } from "../slurp/slurp-fan-types.js";
import { slurpAudienceWeeklySpend } from "../slurp/slurp-audience-subscription.js";

export { SLURP_FUNNEL_STAGES, SLURP_NAMED_CAST_LIMIT, type SlurpFunnelStage };

export type SlurpAudienceTie = {
  id: string;
  memberId: string;
  creatorAccountId: string;
  stage: SlurpFunnelStage;
  spent: number;
  /** The `spent` split. Rapport weighs a tip and an unlock differently, so they are kept apart. */
  tipped: number;
  unlocked: number;
  weeklySpent: number;
  weeklySpendStartedAt: string | null;
  interactions: number;
  firstSeenAt: string;
  lastSeenAt: string;
  audienceArc: SlurpAudienceArc;
  /** When the current arc was set. Null for a tie that predates arcs. */
  audienceArcSince: string | null;
  /** When this member's subscription is paid up to. Null for anybody who has never subscribed. */
  paidThroughAt: string | null;
  /** When they first reached follower. Null for anybody who never did, or a tie that predates it. */
  followedAt: string | null;
};

const int = (value: unknown): number => {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

function mapMember(row: Record<string, unknown>): SlurpPopulationMember & { lastActiveAt: string } {
  let traits: string[] = [];
  try {
    const parsed = JSON.parse(String(row.traits ?? "[]"));
    if (Array.isArray(parsed)) traits = parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    traits = [];
  }
  return {
    id: String(row.id),
    handle: String(row.handle),
    displayName: String(row.displayName),
    archetype: String(row.archetype) as SlurpPopulationMember["archetype"],
    fanTypeId: (row.fanTypeId as string | null) ?? null,
    traits,
    spendTier: String(row.spendTier) as SlurpSpendTier,
    activeHour: int(row.activeHour),
    joinedAt: String(row.joinedAt),
    lastActiveAt: String(row.lastActiveAt),
  };
}

function mapTie(row: Record<string, unknown>): SlurpAudienceTie {
  return {
    id: String(row.id),
    memberId: String(row.memberId),
    creatorAccountId: String(row.creatorAccountId),
    stage: String(row.stage) as SlurpFunnelStage,
    spent: int(row.spent),
    // `int` reads a missing column as zero, so a tie written before the split existed reads as
    // unsplit rather than as NaN poisoning every score derived from it.
    tipped: int(row.tipped),
    unlocked: int(row.unlocked),
    weeklySpent: int(row.weeklySpent),
    weeklySpendStartedAt: (row.weeklySpendStartedAt as string | null) ?? null,
    interactions: int(row.interactions),
    firstSeenAt: String(row.firstSeenAt),
    lastSeenAt: String(row.lastSeenAt),
    audienceArc: (SLURP_AUDIENCE_ARCS as readonly string[]).includes(String(row.audienceArc))
      ? (String(row.audienceArc) as SlurpAudienceArc)
      : "steady",
    audienceArcSince: (row.audienceArcSince as string | null) ?? null,
    paidThroughAt: (row.paidThroughAt as string | null) ?? null,
    followedAt: (row.followedAt as string | null) ?? null,
  };
}

export function createSlurpPopulationStorage(db: DB) {
  const storage = {
    /**
     * Get a member, writing them into existence if this is the first time they acted.
     *
     * The seed is the identity. Two calls with the same seed return the same person whether or not
     * a row existed, so nothing has to be materialised before it is interesting.
     */
    async ensure(seed: string, at = new Date(), fanTypes?: readonly SlurpFanType[]): Promise<SlurpPopulationMember> {
      const generated = generateSlurpPopulationMember(seed, at, fanTypes);
      const existing = await db.select().from(slurpPopulation).where(eq(slurpPopulation.id, generated.id));
      if (existing[0]) return mapMember(existing[0] as Record<string, unknown>);
      const timestamp = now();
      try {
        await db.insert(slurpPopulation).values({
          id: generated.id,
          seed,
          handle: generated.handle,
          displayName: generated.displayName,
          archetype: generated.archetype,
          fanTypeId: generated.fanTypeId,
          traits: JSON.stringify(generated.traits),
          spendTier: generated.spendTier,
          activeHour: String(generated.activeHour),
          joinedAt: generated.joinedAt,
          lastActiveAt: timestamp,
        });
      } catch {
        // A handle collision means somebody already took that name. The generated member is still
        // valid to use in memory; only the row is skipped, and the next seed will differ.
        return generated;
      }
      return generated;
    },

    async get(memberId: string): Promise<(SlurpPopulationMember & { lastActiveAt: string }) | null> {
      const rows = await db.select().from(slurpPopulation).where(eq(slurpPopulation.id, memberId));
      return rows[0] ? mapMember(rows[0] as Record<string, unknown>) : null;
    },

    async listAll(limit = 500): Promise<Array<SlurpPopulationMember & { lastActiveAt: string }>> {
      const rows = await db.select().from(slurpPopulation).orderBy(desc(slurpPopulation.lastActiveAt)).limit(limit);
      return rows.map((row) => mapMember(row as Record<string, unknown>));
    },

    /** Move one member onto another Fan Type. Used by the rebalance; nothing else rewrites this. */
    async setFanType(memberId: string, fanTypeId: string): Promise<void> {
      await db.update(slurpPopulation).set({ fanTypeId }).where(eq(slurpPopulation.id, memberId));
    },

    /**
     * Mark a member as recently active, so `listAll` keeps drawing whoever actually shows up.
     *
     * Only a generated member has a row here. The audience also contains account-backed people —
     * ambient profiles and invited characters — and every world applier touches its actor without
     * knowing which kind it is. Their ids match nothing, so the write was a silent no-op UPDATE
     * against the whole table. Skipping it here fixes all six callers at once.
     */
    async touch(memberId: string): Promise<void> {
      if (!isSlurpPopulationMemberId(memberId)) return;
      await db.update(slurpPopulation).set({ lastActiveAt: now() }).where(eq(slurpPopulation.id, memberId));
    },

    /** The tie between one member and one Creator, created at `stranger` if it did not exist. */
    async ensureTie(memberId: string, creatorAccountId: string): Promise<SlurpAudienceTie> {
      const rows = await db
        .select()
        .from(slurpAudienceTies)
        .where(and(eq(slurpAudienceTies.memberId, memberId), eq(slurpAudienceTies.creatorAccountId, creatorAccountId)));
      if (rows[0]) return mapTie(rows[0] as Record<string, unknown>);
      const timestamp = now();
      const row = {
        id: `${memberId}::${creatorAccountId}`,
        memberId,
        creatorAccountId,
        stage: "stranger",
        spent: "0",
        tipped: "0",
        unlocked: "0",
        weeklySpent: "0",
        weeklySpendStartedAt: null,
        interactions: "0",
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        audienceArc: "steady",
        audienceArcSince: timestamp,
      };
      await db.insert(slurpAudienceTies).values(row);
      return mapTie(row);
    },

    /**
     * Move a member along the funnel, and record what they did.
     *
     * A stage is never lowered here — that is churn's job, and it has its own reasons. Passing a
     * stage already behind the current one only updates the activity counters.
     */
    async advanceTie(
      memberId: string,
      creatorAccountId: string,
      input: {
        stage?: SlurpFunnelStage;
        spent?: number;
        /** Part of `spent` that was a tip. Callers that know the kind should say so. */
        tipped?: number;
        /** Part of `spent` that unlocked something: a locked post, or a locked direct message. */
        unlocked?: number;
        interactions?: number;
        hasSubscription?: boolean;
      } = {},
    ): Promise<SlurpAudienceTie> {
      const tie = await storage.ensureTie(memberId, creatorAccountId);
      const currentIndex = SLURP_FUNNEL_STAGES.indexOf(tie.stage as (typeof SLURP_FUNNEL_STAGES)[number]);
      const nextIndex = input.stage
        ? SLURP_FUNNEL_STAGES.indexOf(input.stage as (typeof SLURP_FUNNEL_STAGES)[number])
        : -1;
      const stage =
        tie.stage === "lapsed"
          ? slurpReactivationStage(input.stage, input.hasSubscription === true)
          : nextIndex > currentIndex && nextIndex >= 0
            ? input.stage!
            : tie.stage;
      const next = {
        stage,
        spent: String(tie.spent + Math.max(0, Math.floor(input.spent ?? 0))),
        tipped: String(tie.tipped + Math.max(0, Math.floor(input.tipped ?? 0))),
        unlocked: String(tie.unlocked + Math.max(0, Math.floor(input.unlocked ?? 0))),
        interactions: String(tie.interactions + Math.max(0, Math.floor(input.interactions ?? 0))),
        lastSeenAt: now(),
        ...(tie.stage === "lapsed" && stage !== "lapsed" ? { audienceArc: "returning", audienceArcSince: now() } : {}),
        ...(!tie.followedAt &&
        SLURP_FUNNEL_STAGES.indexOf(stage as (typeof SLURP_FUNNEL_STAGES)[number]) >=
          SLURP_FUNNEL_STAGES.indexOf("follower")
          ? { followedAt: now() }
          : {}),
      };
      await db.update(slurpAudienceTies).set(next).where(eq(slurpAudienceTies.id, tie.id));
      return {
        ...tie,
        ...next,
        spent: int(next.spent),
        tipped: int(next.tipped),
        unlocked: int(next.unlocked),
        interactions: int(next.interactions),
      };
    },

    /**
     * Drop a member back to `lapsed`. Used when a subscription ends or attention stops.
     *
     * Does nothing when there is no tie. Creating one first — which it used to, via `ensureTie` —
     * invented a relationship at the moment it ended, so unfollowing somebody you had never
     * engaged with wrote a row saying you had drifted away from them.
     */
    async lapseTie(memberId: string, creatorAccountId: string, stage: "lapsed" | "follower" = "lapsed"): Promise<void> {
      const rows = await db
        .select()
        .from(slurpAudienceTies)
        .where(and(eq(slurpAudienceTies.memberId, memberId), eq(slurpAudienceTies.creatorAccountId, creatorAccountId)));
      if (!rows[0]) return;
      await db
        .update(slurpAudienceTies)
        .set({ stage, paidThroughAt: null })
        .where(eq(slurpAudienceTies.id, String(rows[0].id)));
    },

    /** Set somebody's direction. Stamped, because an arc that has run its course must expire. */
    async setTieAudienceArc(tieId: string, arc: SlurpAudienceArc): Promise<void> {
      await db
        .update(slurpAudienceTies)
        .set({ audienceArc: arc, audienceArcSince: now() })
        .where(eq(slurpAudienceTies.id, tieId));
    },

    /**
     * Record that a subscription is paid up to a date.
     *
     * Separate from `advanceTie` because it is the only write here that is not about attention.
     * An audience member holds no wallet, so this column is the whole of their billing state.
     */
    async setTiePaidThrough(tieId: string, paidThroughAt: string | null): Promise<void> {
      await db.update(slurpAudienceTies).set({ paidThroughAt }).where(eq(slurpAudienceTies.id, tieId));
    },

    /** Reserve one audience payment inside its seven-day budget window. */
    async reserveWeeklySpend(
      memberId: string,
      creatorAccountId: string,
      amount: number,
      budget: number,
      at = new Date(),
    ): Promise<boolean> {
      if (!Number.isInteger(amount) || amount <= 0 || !Number.isFinite(budget) || amount > budget) return false;
      await storage.ensureTie(memberId, creatorAccountId);
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(slurpAudienceTies)
          .where(
            and(eq(slurpAudienceTies.memberId, memberId), eq(slurpAudienceTies.creatorAccountId, creatorAccountId)),
          );
        if (!rows[0]) return false;
        const tie = mapTie(rows[0] as Record<string, unknown>);
        const reservation = slurpAudienceWeeklySpend(
          { spent: tie.weeklySpent, startedAt: tie.weeklySpendStartedAt },
          amount,
          budget,
          at,
        );
        if (!reservation) return false;
        await tx
          .update(slurpAudienceTies)
          .set({
            weeklySpent: String(reservation.spent),
            weeklySpendStartedAt: reservation.startedAt,
          })
          .where(eq(slurpAudienceTies.id, tie.id));
        return true;
      });
    },

    async releaseWeeklySpend(
      memberId: string,
      creatorAccountId: string,
      amount: number,
      at = new Date(),
    ): Promise<void> {
      if (!Number.isInteger(amount) || amount <= 0) return;
      const tie = await storage.ensureTie(memberId, creatorAccountId);
      const started = tie.weeklySpendStartedAt ? Date.parse(tie.weeklySpendStartedAt) : Number.NaN;
      if (!Number.isFinite(started) || at.getTime() - started >= 7 * 86_400_000) return;
      await db
        .update(slurpAudienceTies)
        .set({ weeklySpent: String(Math.max(0, tie.weeklySpent - amount)) })
        .where(eq(slurpAudienceTies.id, tie.id));
    },

    async listTiesForCreator(creatorAccountId: string): Promise<SlurpAudienceTie[]> {
      const rows = await db
        .select()
        .from(slurpAudienceTies)
        .where(eq(slurpAudienceTies.creatorAccountId, creatorAccountId))
        .orderBy(asc(slurpAudienceTies.firstSeenAt));
      return rows.map((row) => mapTie(row as Record<string, unknown>));
    },

    /**
     * The named cast for one Creator: the people worth showing by name.
     *
     * Ranked by what they have paid, then by how much they have done. Capped, because the player
     * can only keep track of about thirty people and a longer list is a worse read than a number.
     */
    async listNamedCast(
      creatorAccountId: string,
      limit = SLURP_NAMED_CAST_LIMIT,
    ): Promise<Array<{ tie: SlurpAudienceTie; member: SlurpPopulationMember & { lastActiveAt: string } }>> {
      const ties = (await storage.listTiesForCreator(creatorAccountId))
        .filter((tie) => tie.stage !== "stranger")
        .sort((left, right) => right.spent - left.spent || right.interactions - left.interactions)
        .slice(0, Math.max(0, limit));
      const out: Array<{ tie: SlurpAudienceTie; member: SlurpPopulationMember & { lastActiveAt: string } }> = [];
      for (const tie of ties) {
        const member = await storage.get(tie.memberId);
        if (member) out.push({ tie, member });
      }
      return out;
    },

    /**
     * Real follower counts for several Creators at once.
     *
     * The Creator home, the feed projection, and the connection counts all need this, and each
     * doing its own scan is how a page of posts turns into a table scan per post.
     */
    async countFollowersForCreators(creatorAccountIds: readonly string[]): Promise<Map<string, number>> {
      return countTiesAtOrAbove(creatorAccountIds, "follower");
    },

    /**
     * Real subscriber counts for several Creators at once.
     *
     * The audience holds no subscription rows — an audience member is not a viewer and cannot be
     * one — so a count taken from `slurp2_account_subscriptions` alone reports only the personas on
     * this install. Callers add the two together; both halves are exact, and neither is reach.
     */
    async countSubscribersForCreators(creatorAccountIds: readonly string[]): Promise<Map<string, number>> {
      return countTiesAtOrAbove(creatorAccountIds, "subscriber");
    },
  };

  /** One scan, one floor. `lapsed` is not in the ordered stages, so it never counts. */
  async function countTiesAtOrAbove(
    creatorAccountIds: readonly string[],
    from: (typeof SLURP_FUNNEL_STAGES)[number],
  ): Promise<Map<string, number>> {
    const floor = SLURP_FUNNEL_STAGES.indexOf(from);
    const wanted = new Set(creatorAccountIds);
    const counts = new Map<string, number>();
    for (const id of wanted) counts.set(id, 0);
    // Only the subscriber count can double-count, and only when there is a Creator to count for.
    const personaSubscriptions = new Set(
      from !== "subscriber" || wanted.size === 0
        ? []
        : (
            await db
              .select()
              .from(noodleAccountSubscriptions)
              .where(inArray(noodleAccountSubscriptions.creatorAccountId, [...wanted]))
          ).map((subscription) => `${subscription.viewerAccountId}:${subscription.creatorAccountId}`),
    );
    const rows = await db.select().from(slurpAudienceTies);
    for (const row of rows) {
      const tie = mapTie(row as Record<string, unknown>);
      if (!wanted.has(tie.creatorAccountId)) continue;
      if (from === "subscriber" && personaSubscriptions.has(`${tie.memberId}:${tie.creatorAccountId}`)) continue;
      const index = SLURP_FUNNEL_STAGES.indexOf(tie.stage as (typeof SLURP_FUNNEL_STAGES)[number]);
      if (index >= floor && index >= 0) counts.set(tie.creatorAccountId, (counts.get(tie.creatorAccountId) ?? 0) + 1);
    }
    return counts;
  }

  // An Engine without `registerTables` rejects every package-owned table, and the funnel is read
  // by surfaces that predate it. Behave as an empty audience there rather than failing the page.
  return tolerateMissingTables(storage, {
    ensure: (seed: string, at = new Date(), fanTypes?: readonly SlurpFanType[]) =>
      generateSlurpPopulationMember(seed, at, fanTypes),
    get: () => null,
    listAll: () => [],
    listTiesForCreator: () => [],
    listNamedCast: () => [],
    countFollowersForCreators: (creatorAccountIds: readonly string[]) =>
      new Map(creatorAccountIds.map((id) => [id, 0])),
    countSubscribersForCreators: (creatorAccountIds: readonly string[]) =>
      new Map(creatorAccountIds.map((id) => [id, 0])),
  });
}
