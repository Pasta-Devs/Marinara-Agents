import type { DB } from "../../../db/connection.js";
import { desc, eq } from "../../../db/file-query.js";
import { slurpContentOpportunities } from "../../../db/schema/slurp.js";
import { newId } from "../../../utils/id-generator.js";
import type {
  SlurpContentDelivery,
  SlurpContentIntent,
  SlurpContentWorkflow,
} from "../../../../../shared/src/slp/slp-content-axes.js";
import type { SlurpSkipReason } from "../../modules/feed/slp-planner.js";
import {
  parseSlurpBeat,
  type SlurpBeat,
  type SlurpBeatHistory,
  type SlurpBeatType,
} from "../../modules/feed/slp-post-beat.js";

export type SlurpContentOpportunity = {
  id: string;
  creatorAccountId: string;
  slotId: string | null;
  sequence: number;
  intent: SlurpContentIntent | null;
  delivery: SlurpContentDelivery | null;
  workflow: SlurpContentWorkflow;
  access: string;
  skipReason: SlurpSkipReason | null;
  postId: string | null;
  sourceEventId: string | null;
  topic: string | null;
  beat: SlurpBeat | null;
  plannedAt: string;
  dueAt: string | null;
  completedAt: string | null;
};

/** How many plans one Creator keeps. Enough to see a recent run of quiet slots, not a history. */
const KEEP_PER_CREATOR = 40;

function mapOpportunity(row: Record<string, unknown>): SlurpContentOpportunity {
  const sequence = Number.parseInt(String(row.sequence ?? "0"), 10);
  return {
    id: String(row.id),
    creatorAccountId: String(row.creatorAccountId),
    slotId: row.slotId ? String(row.slotId) : null,
    sequence: Number.isFinite(sequence) ? sequence : 0,
    intent: (String(row.intent ?? "") || null) as SlurpContentIntent | null,
    delivery: (String(row.delivery ?? "") || null) as SlurpContentDelivery | null,
    workflow: String(row.workflow) as SlurpContentWorkflow,
    access: String(row.access ?? ""),
    skipReason: (row.skipReason ? String(row.skipReason) : null) as SlurpSkipReason | null,
    postId: row.postId ? String(row.postId) : null,
    sourceEventId: row.sourceEventId ? String(row.sourceEventId) : null,
    topic: row.topic ? String(row.topic) : null,
    beat: row.beat ? parseSlurpBeat(row.beat) : null,
    plannedAt: String(row.plannedAt),
    dueAt: row.dueAt ? String(row.dueAt) : null,
    completedAt: row.completedAt ? String(row.completedAt) : null,
  };
}

/**
 * Record one planner decision.
 *
 * Written before the model is called, so a run that dies between the decision and the post does
 * not lose the decision. A slot that already has a plan returns it rather than drawing a new one:
 * a retry must repeat the decision, not reconsider it.
 */
export async function planSlurpOpportunity(
  db: DB,
  input: {
    creatorAccountId: string;
    slotId?: string | null;
    sequence: number;
    workflow: SlurpContentWorkflow;
    intent?: SlurpContentIntent;
    delivery?: SlurpContentDelivery;
    access?: string;
    skipReason?: SlurpSkipReason;
    sourceEventId?: string | null;
    topic?: string | null;
    beat?: SlurpBeat | null;
    at: Date;
    dueAt?: Date | null;
  },
): Promise<SlurpContentOpportunity> {
  if (input.slotId) {
    const existing = await findSlurpOpportunityBySlot(db, input.slotId);
    if (existing) return existing;
  }
  const row = {
    id: newId(),
    creatorAccountId: input.creatorAccountId,
    slotId: input.slotId ?? null,
    sequence: String(input.sequence),
    intent: input.intent ?? "",
    delivery: input.delivery ?? "",
    workflow: input.workflow,
    access: input.access ?? "",
    skipReason: input.skipReason ?? null,
    postId: null,
    sourceEventId: input.sourceEventId ?? null,
    topic: input.topic ?? null,
    beat: input.beat ? JSON.stringify(input.beat) : null,
    plannedAt: input.at.toISOString(),
    dueAt: input.dueAt ? input.dueAt.toISOString() : null,
    // A skip is over the moment it is made. Nothing else happens to it.
    completedAt: input.workflow === "skip" ? input.at.toISOString() : null,
  };
  await db.insert(slurpContentOpportunities).values(row);
  await pruneSlurpOpportunities(db, input.creatorAccountId);
  return mapOpportunity(row);
}

export async function findSlurpOpportunityBySlot(db: DB, slotId: string): Promise<SlurpContentOpportunity | null> {
  const rows = await db.select().from(slurpContentOpportunities).where(eq(slurpContentOpportunities.slotId, slotId));
  return rows[0] ? mapOpportunity(rows[0]) : null;
}

/** Mark a plan as done and link what it produced. */
export async function completeSlurpOpportunity(
  db: DB,
  id: string,
  input: { postId?: string | null; at: Date },
): Promise<void> {
  await db
    .update(slurpContentOpportunities)
    .set({
      workflow: "completed",
      ...(input.postId ? { postId: input.postId } : {}),
      completedAt: input.at.toISOString(),
    })
    .where(eq(slurpContentOpportunities.id, id));
}

export async function listSlurpOpportunities(
  db: DB,
  creatorAccountId: string,
  limit = 10,
): Promise<SlurpContentOpportunity[]> {
  const rows = await db
    .select()
    .from(slurpContentOpportunities)
    .where(eq(slurpContentOpportunities.creatorAccountId, creatorAccountId))
    .orderBy(desc(slurpContentOpportunities.plannedAt))
    .limit(limit);
  return rows.map(mapOpportunity);
}

/**
 * The oldest promise that is due and fits this slot, or null.
 *
 * A promise is a planned opportunity with a source event and no slot. Oldest first, so a promise
 * that keeps missing its slot moves to the front instead of being passed over forever. A teaser
 * promise needs a public slot; anything else fits any slot.
 */
export async function findDueSlurpPromise(
  db: DB,
  creatorAccountId: string,
  input: { at: Date; access: string },
): Promise<SlurpContentOpportunity | null> {
  const rows = await db
    .select()
    .from(slurpContentOpportunities)
    .where(eq(slurpContentOpportunities.creatorAccountId, creatorAccountId));
  return (
    rows
      .map(mapOpportunity)
      .filter((row) => row.workflow === "planned" && !row.slotId && row.sourceEventId)
      .filter((row) => !row.dueAt || Date.parse(row.dueAt) <= input.at.getTime())
      .filter((row) => row.intent !== "teaser" || input.access === "public")
      .sort((left, right) => left.plannedAt.localeCompare(right.plannedAt))[0] ?? null
  );
}

/** Hand a promise the slot and decision that will fulfil it. The promise row is the plan. */
export async function claimSlurpPromise(
  db: DB,
  id: string,
  input: {
    slotId?: string | null;
    workflow: SlurpContentWorkflow;
    delivery: SlurpContentDelivery;
    access: string;
  },
): Promise<SlurpContentOpportunity | null> {
  await db
    .update(slurpContentOpportunities)
    .set({ slotId: input.slotId ?? null, workflow: input.workflow, delivery: input.delivery, access: input.access })
    .where(eq(slurpContentOpportunities.id, id));
  const [row] = await db.select().from(slurpContentOpportunities).where(eq(slurpContentOpportunities.id, id));
  return row ? mapOpportunity(row) : null;
}

const SLURP_BEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Editorial memory for the beats planner: this Creator's last beats and every Creator's beat types
 * in the last day. One read of the plan table, which keeps only 40 plans per Creator.
 */
export async function readSlurpBeatHistory(db: DB, creatorAccountId: string, at: Date): Promise<SlurpBeatHistory> {
  const since = new Date(at.getTime() - SLURP_BEAT_WINDOW_MS).toISOString();
  const rows = (await db.select().from(slurpContentOpportunities))
    .map(mapOpportunity)
    .filter((row): row is SlurpContentOpportunity & { beat: SlurpBeat } => Boolean(row.beat))
    .sort((left, right) => right.plannedAt.localeCompare(left.plannedAt));
  const own = rows.filter((row) => row.creatorAccountId === creatorAccountId).slice(0, 6);
  const globalCounts: Partial<Record<SlurpBeatType, number>> = {};
  const sharedToday: Record<string, number> = {};
  for (const row of rows.filter((entry) => entry.plannedAt >= since)) {
    globalCounts[row.beat.type] = (globalCounts[row.beat.type] ?? 0) + 1;
    if (row.beat.sharedId) sharedToday[row.beat.sharedId] = (sharedToday[row.beat.sharedId] ?? 0) + 1;
  }
  return {
    recentOwn: own.map((row) => row.beat.type),
    recentAnchors: own.map((row) => row.beat.anchor),
    recentReferences: own.flatMap((row) => (row.beat.reference ? [row.beat.reference.id] : [])),
    globalCounts,
    sharedToday,
  };
}

/** Whether the Creator's last plan was a quiet slot, so the planner does not stack two. */
export async function slurpSkippedLastSlot(db: DB, creatorAccountId: string): Promise<boolean> {
  const [latest] = await listSlurpOpportunities(db, creatorAccountId, 1);
  return latest?.workflow === "skip";
}

async function pruneSlurpOpportunities(db: DB, creatorAccountId: string): Promise<void> {
  const rows = await listSlurpOpportunities(db, creatorAccountId, KEEP_PER_CREATOR + 25);
  // An unkept promise is never pruned: losing it would be exactly the silent broken promise
  // the planner exists to prevent.
  for (const row of rows
    .slice(KEEP_PER_CREATOR)
    .filter((entry) => !(entry.workflow === "planned" && entry.sourceEventId))) {
    await db.delete(slurpContentOpportunities).where(eq(slurpContentOpportunities.id, row.id));
  }
}
