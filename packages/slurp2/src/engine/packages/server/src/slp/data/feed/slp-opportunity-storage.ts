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

/** Whether the Creator's last plan was a quiet slot, so the planner does not stack two. */
export async function slurpSkippedLastSlot(db: DB, creatorAccountId: string): Promise<boolean> {
  const [latest] = await listSlurpOpportunities(db, creatorAccountId, 1);
  return latest?.workflow === "skip";
}

async function pruneSlurpOpportunities(db: DB, creatorAccountId: string): Promise<void> {
  const rows = await listSlurpOpportunities(db, creatorAccountId, KEEP_PER_CREATOR + 25);
  for (const row of rows.slice(KEEP_PER_CREATOR)) {
    await db.delete(slurpContentOpportunities).where(eq(slurpContentOpportunities.id, row.id));
  }
}
