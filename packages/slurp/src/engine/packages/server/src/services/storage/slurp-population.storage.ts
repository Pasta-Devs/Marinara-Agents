/**
 * The audience, materialised.
 *
 * Members are generated from a seed and only written once they act somewhere the player can see.
 * That is what lets a Creator show thousands of followers while a few hundred rows exist: the
 * count is reach, and the rows are the people who did something.
 */
import { and, asc, desc, eq } from "../../db/file-query.js";
import { now } from "../../utils/id-generator.js";
import type { DB } from "../../db/connection.js";
import { slurpAudienceTies, slurpPopulation } from "../../db/schema/slurp.js";
import {
  generateSlurpPopulationMember,
  SLURP_FUNNEL_STAGES,
  SLURP_NAMED_CAST_LIMIT,
  type SlurpFunnelStage,
  type SlurpPopulationMember,
  type SlurpSpendTier,
} from "../slurp/slurp-population.js";

export { SLURP_FUNNEL_STAGES, SLURP_NAMED_CAST_LIMIT, type SlurpFunnelStage };

export type SlurpAudienceTie = {
  id: string;
  memberId: string;
  creatorAccountId: string;
  stage: SlurpFunnelStage;
  spent: number;
  interactions: number;
  firstSeenAt: string;
  lastSeenAt: string;
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
    interactions: int(row.interactions),
    firstSeenAt: String(row.firstSeenAt),
    lastSeenAt: String(row.lastSeenAt),
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
    async ensure(seed: string, at = new Date()): Promise<SlurpPopulationMember> {
      const generated = generateSlurpPopulationMember(seed, at);
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

    async touch(memberId: string): Promise<void> {
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
        interactions: "0",
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
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
      input: { stage?: SlurpFunnelStage; spent?: number; interactions?: number } = {},
    ): Promise<SlurpAudienceTie> {
      const tie = await storage.ensureTie(memberId, creatorAccountId);
      const currentIndex = SLURP_FUNNEL_STAGES.indexOf(tie.stage as (typeof SLURP_FUNNEL_STAGES)[number]);
      const nextIndex = input.stage
        ? SLURP_FUNNEL_STAGES.indexOf(input.stage as (typeof SLURP_FUNNEL_STAGES)[number])
        : -1;
      const stage = nextIndex > currentIndex && nextIndex >= 0 ? input.stage! : tie.stage;
      const next = {
        stage,
        spent: String(tie.spent + Math.max(0, Math.floor(input.spent ?? 0))),
        interactions: String(tie.interactions + Math.max(0, Math.floor(input.interactions ?? 0))),
        lastSeenAt: now(),
      };
      await db.update(slurpAudienceTies).set(next).where(eq(slurpAudienceTies.id, tie.id));
      return { ...tie, ...next, spent: int(next.spent), interactions: int(next.interactions) };
    },

    /** Drop a member back to `lapsed`. Used when a subscription ends or attention stops. */
    async lapseTie(memberId: string, creatorAccountId: string): Promise<void> {
      const tie = await storage.ensureTie(memberId, creatorAccountId);
      await db.update(slurpAudienceTies).set({ stage: "lapsed" }).where(eq(slurpAudienceTies.id, tie.id));
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
      const floor = SLURP_FUNNEL_STAGES.indexOf("follower");
      const wanted = new Set(creatorAccountIds);
      const counts = new Map<string, number>();
      for (const id of wanted) counts.set(id, 0);
      const rows = await db.select().from(slurpAudienceTies);
      for (const row of rows) {
        const tie = mapTie(row as Record<string, unknown>);
        if (!wanted.has(tie.creatorAccountId)) continue;
        const index = SLURP_FUNNEL_STAGES.indexOf(tie.stage as (typeof SLURP_FUNNEL_STAGES)[number]);
        if (index >= floor && index >= 0) counts.set(tie.creatorAccountId, (counts.get(tie.creatorAccountId) ?? 0) + 1);
      }
      return counts;
    },

    /** How many members sit at or above a stage for one Creator. This is a real follower count. */
    async countAtOrAbove(creatorAccountId: string, stage: (typeof SLURP_FUNNEL_STAGES)[number]): Promise<number> {
      const floor = SLURP_FUNNEL_STAGES.indexOf(stage);
      const ties = await storage.listTiesForCreator(creatorAccountId);
      return ties.filter((tie) => {
        const index = SLURP_FUNNEL_STAGES.indexOf(tie.stage as (typeof SLURP_FUNNEL_STAGES)[number]);
        return index >= floor && index >= 0;
      }).length;
    },
  };

  return storage;
}
